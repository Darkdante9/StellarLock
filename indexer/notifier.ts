/**
 * Notification cron worker.
 *
 * Call `runNotifier()` on a schedule (e.g. every hour via setInterval or an
 * external cron trigger). It scans `notification_subscriptions` for locks that
 * are approaching their unlock date and dispatches email + webhook reminders at
 * three thresholds: 7 days, 1 day, and at unlock (0 days).
 *
 * Required environment variables:
 *   RESEND_API_KEY   – Resend API key for transactional email
 *   EMAIL_FROM       – Sender address, e.g. "StellarLock <notify@stellarlock.xyz>"
 *   WEBHOOK_SECRET   – HMAC secret used to sign outbound webhook payloads
 *
 * Optional:
 *   NOTIFIER_INTERVAL_MS – how often to run in self-hosted mode (default 3600000 = 1h)
 */

import { createHmac } from 'node:crypto'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { pathToFileURL } from 'node:url'
import { db, initDb } from './db.js'
import { safeLookup, validateWebhookUrl } from './ssrf.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubscriptionRow {
  id: string
  lock_id: string
  address: string
  email: string | null
  webhook_url: string | null
  reminded_7d: number
  reminded_1d: number
  reminded_0d: number
}

interface LockRow {
  id: string
  token: string
  amount: string
  beneficiary: string
  unlock_at: number
}

type ReminderTier = '7d' | '1d' | '0d'

interface ReminderJob {
  sub: SubscriptionRow
  lock: LockRow
  tier: ReminderTier
  reminderDays: number
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? ''
const EMAIL_FROM = process.env.EMAIL_FROM ?? 'StellarLock <notify@stellarlock.xyz>'
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? ''
const NOTIFIER_INTERVAL_MS = Number(process.env.NOTIFIER_INTERVAL_MS ?? 3_600_000)
const APP_BASE_URL = process.env.PUBLIC_APP_URL ?? 'https://app.stellarlock.xyz'
const WEBHOOK_TIMEOUT_MS = 10_000

const ONE_DAY_S = 86_400
const SEVEN_DAYS_S = 7 * ONE_DAY_S

// ---------------------------------------------------------------------------
// Email via Resend
// ---------------------------------------------------------------------------

async function sendEmail(to: string, lock: LockRow, tier: ReminderTier): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn('[notifier] RESEND_API_KEY not set — skipping email to', to)
    return
  }

  const unlockDate = new Date(lock.unlock_at * 1000).toUTCString()
  const lockUrl = `${APP_BASE_URL}/app/lock/${lock.id}`

  const subject =
    tier === '0d'
      ? `Your lock #${lock.id} has unlocked`
      : `Reminder: lock #${lock.id} unlocks in ${tier === '7d' ? '7 days' : '1 day'}`

  const body =
    tier === '0d'
      ? `Your StellarLock (ID: ${lock.id}) has reached its unlock date (${unlockDate}). You can now withdraw your tokens.\n\n${lockUrl}`
      : `Your StellarLock (ID: ${lock.id}) will unlock on ${unlockDate}.\n\nVisit ${lockUrl} to view details or extend the lock.`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to,
      subject,
      text: body,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`[notifier] Resend error for ${to} (lock ${lock.id}):`, text)
  }
}

// ---------------------------------------------------------------------------
// Webhook dispatch
// ---------------------------------------------------------------------------

function signPayload(payload: string): string {
  if (!WEBHOOK_SECRET) return ''
  return createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex')
}

async function sendWebhookReminder(url: string, lock: LockRow, tier: ReminderTier): Promise<void> {
  const reminderDays = tier === '7d' ? 7 : tier === '1d' ? 1 : 0
  const payload = JSON.stringify({
    event: tier === '0d' ? 'unlocked' : 'unlock_reminder',
    lockId: lock.id,
    unlockAt: lock.unlock_at,
    reminderDays,
    token: lock.token,
    amount: lock.amount,
    beneficiary: lock.beneficiary,
  })

  const sig = signPayload(payload)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (sig) headers['X-StellarLock-Signature'] = sig

  // Re-validate at dispatch time: the URL was checked at subscribe time, but
  // its DNS may have changed since (or the row predates the resolving check).
  const urlErr = await validateWebhookUrl(url)
  if (urlErr) {
    console.error(`[notifier] webhook ${url} rejected: ${urlErr}`)
    return
  }

  try {
    const status = await postWebhook(url, headers, payload)
    if (status >= 300 && status < 400) {
      console.error(`[notifier] webhook POST to ${url} returned redirect ${status} — not followed`)
    } else if (status < 200 || status >= 300) {
      console.error(`[notifier] webhook POST to ${url} failed: ${status}`)
    }
  } catch (err) {
    console.error(`[notifier] webhook POST to ${url} threw:`, err)
  }
}

/**
 * POST via node:http(s) rather than fetch so the connection goes through
 * `safeLookup`: the address actually connected to is SSRF-checked (closing the
 * DNS-rebinding window between validation and connect), and redirects are
 * never followed, so a validated endpoint can't 3xx-pivot to an internal host.
 * Resolves with the response status code.
 */
function postWebhook(url: string, headers: Record<string, string>, body: string): Promise<number> {
  const parsed = new URL(url)
  const request = parsed.protocol === 'https:' ? httpsRequest : httpRequest
  return new Promise((resolve, reject) => {
    const req = request(
      parsed,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Length': Buffer.byteLength(body) },
        lookup: safeLookup,
        // Fresh connection per webhook: no pooled sockets to user-controlled hosts.
        agent: false,
        timeout: WEBHOOK_TIMEOUT_MS,
      },
      (res) => {
        res.resume() // discard the body
        resolve(res.statusCode ?? 0)
      },
    )
    req.on('timeout', () => req.destroy(new Error(`timed out after ${WEBHOOK_TIMEOUT_MS}ms`)))
    req.on('error', reject)
    req.end(body)
  })
}

// ---------------------------------------------------------------------------
// Core scan logic
// ---------------------------------------------------------------------------

/**
 * Determine which reminder tiers are now due for a subscription.
 * Returns an array (possibly empty) of tiers the subscription hasn't been
 * notified for yet and whose window has been crossed.
 */
function dueTiers(sub: SubscriptionRow, lock: LockRow, nowS: number): ReminderTier[] {
  const due: ReminderTier[] = []
  const secondsUntil = lock.unlock_at - nowS

  // 7-day window: unlock is ≤7 days away and we haven't sent it
  if (!sub.reminded_7d && secondsUntil <= SEVEN_DAYS_S) due.push('7d')
  // 1-day window: unlock is ≤1 day away and we haven't sent it
  if (!sub.reminded_1d && secondsUntil <= ONE_DAY_S) due.push('1d')
  // At-unlock: unlock has passed (or is right now)
  if (!sub.reminded_0d && secondsUntil <= 0) due.push('0d')

  return due
}

const markStmt = {
  '7d': (id: string) =>
    db.prepare('UPDATE notification_subscriptions SET reminded_7d = 1 WHERE id = ?').run(id),
  '1d': (id: string) =>
    db.prepare('UPDATE notification_subscriptions SET reminded_1d = 1 WHERE id = ?').run(id),
  '0d': (id: string) =>
    db.prepare('UPDATE notification_subscriptions SET reminded_0d = 1 WHERE id = ?').run(id),
}

async function dispatchJob(job: ReminderJob): Promise<void> {
  const { sub, lock, tier } = job

  const dispatches: Promise<void>[] = []

  if (sub.email) {
    dispatches.push(sendEmail(sub.email, lock, tier))
  }
  if (sub.webhook_url) {
    dispatches.push(sendWebhookReminder(sub.webhook_url, lock, tier))
  }

  await Promise.allSettled(dispatches)

  // Mark as sent regardless of delivery outcome — avoids hammering on transient
  // failures. Operators should monitor Resend/webhook logs for delivery errors.
  markStmt[tier](sub.id)
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function runNotifier(): Promise<void> {
  initDb()

  const nowS = Math.floor(Date.now() / 1000)

  // Load all subscriptions that still have at least one reminder to send.
  // The index on reminded_0d = 0 keeps this fast even with many rows.
  const subs = db
    .prepare(
      `SELECT * FROM notification_subscriptions
       WHERE reminded_0d = 0`,
    )
    .all() as SubscriptionRow[]

  if (subs.length === 0) return

  const lockIds = [...new Set(subs.map((s) => s.lock_id))]

  // Fetch the corresponding lock rows in one query.
  const placeholders = lockIds.map(() => '?').join(',')
  const locks = db
    .prepare(`SELECT id, token, amount, beneficiary, unlock_at FROM locks WHERE id IN (${placeholders})`)
    .all(...lockIds) as LockRow[]

  const lockMap = new Map(locks.map((l) => [l.id, l]))

  const jobs: ReminderJob[] = []

  for (const sub of subs) {
    const lock = lockMap.get(sub.lock_id)
    if (!lock) continue // lock not yet indexed — skip

    const tiers = dueTiers(sub, lock, nowS)
    for (const tier of tiers) {
      jobs.push({ sub, lock, tier, reminderDays: tier === '7d' ? 7 : tier === '1d' ? 1 : 0 })
    }
  }

  if (jobs.length === 0) return

  console.log(`[notifier] dispatching ${jobs.length} reminder(s)`)

  // Run all jobs concurrently but cap parallelism to avoid hammering APIs.
  const CONCURRENCY = 10
  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    await Promise.allSettled(jobs.slice(i, i + CONCURRENCY).map(dispatchJob))
  }

  console.log(`[notifier] done`)
}

// ---------------------------------------------------------------------------
// Self-hosted runner (node indexer/notifier.ts)
// ---------------------------------------------------------------------------

const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] != null &&
  import.meta.url === pathToFileURL(process.argv[1]).href

if (isMain) {
  console.log(`[notifier] running every ${NOTIFIER_INTERVAL_MS / 1000}s`)
  void runNotifier()
  setInterval(() => {
    void runNotifier()
  }, NOTIFIER_INTERVAL_MS)
}
