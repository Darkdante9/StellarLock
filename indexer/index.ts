import { pathToFileURL } from "node:url"
import { Server } from "@stellar/stellar-sdk/rpc"
import { scValToNative, xdr } from "@stellar/stellar-sdk"
import { initDb, db, getMeta, setMeta, deleteMeta } from "./db"

export interface IndexedLock {
  id: string
  kind: "token" | "lp"
  creator: string
  beneficiary: string
  token: string
  token_a?: string | null
  token_b?: string | null
  dex?: string | null
  pool_share?: string | null
  amount: bigint
  /** Cumulative amount released across all withdrawals so far (== amount once fully withdrawn). */
  released: bigint
  unlockAt: number
  status: "locked" | "withdrawn"
  createdAt: number
  extendedCount?: number
  withdrawn?: boolean
}

interface AggregateStats {
  totalLocks: number
  totalValue: bigint
  uniqueTokens: number
  recentLocks: IndexedLock[]
  upcomingUnlocks: IndexedLock[]
}

const RPC_URL = process.env.SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org"
const TOKEN_LOCKER_ID = process.env.TOKEN_LOCKER_CONTRACT || ""
const LP_LOCKER_ID = process.env.LP_LOCKER_CONTRACT || ""
const POLL_INTERVAL_MS = Number(process.env.INDEXER_POLL_INTERVAL_MS || 10_000)
const EVENTS_PAGE_LIMIT = 100

const META_CURSOR = "cursor"
const META_LAST_LEDGER = "last_indexed_ledger"

let dbReady = false
function ensureDb() {
  if (!dbReady) {
    initDb()
    dbReady = true
  }
}

interface LockRow {
  id: string
  kind: string
  creator: string
  beneficiary: string
  token: string
  token_a: string | null
  token_b: string | null
  dex: string | null
  pool_share: string | null
  amount: string
  released: string
  unlock_at: number
  status: string
  created_at: number
  extended_count: number
  withdrawn: number
}

function buildStatements() {
  return {
    upsertLock: db.prepare(`
      INSERT INTO locks (id, kind, creator, beneficiary, token, token_a, token_b, dex, pool_share, amount, unlock_at, status, created_at)
      VALUES (@id, @kind, @creator, @beneficiary, @token, @token_a, @token_b, @dex, @pool_share, @amount, @unlock_at, 'locked', @created_at)
      ON CONFLICT(id) DO UPDATE SET
        creator = excluded.creator,
        beneficiary = excluded.beneficiary,
        token = excluded.token,
        token_a = excluded.token_a,
        token_b = excluded.token_b,
        dex = excluded.dex,
        pool_share = excluded.pool_share,
        amount = excluded.amount,
        unlock_at = excluded.unlock_at
    `),
    markWithdrawn: db.prepare(`UPDATE locks SET status = 'withdrawn', withdrawn = 1 WHERE id = ?`),
    getAmountAndReleased: db.prepare(`SELECT amount, released FROM locks WHERE id = ?`),
    recordRelease: db.prepare(`
      UPDATE locks SET released = @released, status = @status, withdrawn = @withdrawn WHERE id = @id
    `),
    extendUnlock: db.prepare(`UPDATE locks SET unlock_at = ?, extended_count = extended_count + 1 WHERE id = ?`),
    setBeneficiary: db.prepare(`UPDATE locks SET beneficiary = ? WHERE id = ?`),
    insertEvent: db.prepare(
      `INSERT OR IGNORE INTO lock_events (id, ledger_seq, event_type, lock_id) VALUES (?, ?, ?, ?)`,
    ),
  }
}

let statements: ReturnType<typeof buildStatements> | null = null

function stmts() {
  ensureDb()
  statements ??= buildStatements()
  return statements
}

function rowToLock(row: LockRow): IndexedLock {
  return {
    id: row.id,
    kind: row.kind as "token" | "lp",
    creator: row.creator,
    beneficiary: row.beneficiary,
    token: row.token,
    token_a: row.token_a,
    token_b: row.token_b,
    dex: row.dex,
    pool_share: row.pool_share,
    amount: BigInt(row.amount),
    released: BigInt(row.released),
    unlockAt: row.unlock_at,
    status: row.status as "locked" | "withdrawn",
    createdAt: row.created_at,
    extendedCount: row.extended_count,
    withdrawn: row.withdrawn === 1,
  }
}

/**
 * A contract event with topics/data already decoded from ScVal to native JS
 * values (bigint for u64/i128, string for Symbol/Address).
 */
export interface ContractEvent {
  /** Unique RPC event id — used to deduplicate replayed ranges. */
  id: string
  ledger: number
  /** Ledger close time (unix seconds); used as the lock's created_at. */
  timestamp?: number
  topics: unknown[]
  data: unknown
}

/**
 * Apply one `lock_withdrawn` event's releasable amount to a lock's
 * cumulative `released` total, marking it fully withdrawn only once that
 * total reaches the lock's full amount. A lock with a linear vesting
 * schedule can emit several `lock_withdrawn` events — one per partial claim
 * — each carrying only the amount released in that particular withdrawal,
 * not the lock's total, so a single such event is never enough on its own
 * to tell whether the lock is now fully withdrawn.
 */
function applyRelease(s: ReturnType<typeof buildStatements>, lockId: string, releasable: bigint) {
  const row = s.getAmountAndReleased.get(lockId) as { amount: string; released: string } | undefined
  if (!row) return // withdrawal for a lock we never indexed a creation event for
  const released = BigInt(row.released) + releasable
  const fullyWithdrawn = released >= BigInt(row.amount)
  s.recordRelease.run({
    id: lockId,
    released: released.toString(),
    status: fullyWithdrawn ? "withdrawn" : "locked",
    withdrawn: fullyWithdrawn ? 1 : 0,
  })
}

/**
 * Parse a locker contract event and upsert it into the SQLite index.
 * Token-locker events carry their payload in the topics; lp-locker
 * withdraw/extend/transfer events carry it in the data tuple.
 * Already-seen event ids are skipped so replays are idempotent.
 */
export function processEvent(event: ContractEvent): void {
  const name = typeof event.topics[0] === "string" ? event.topics[0] : undefined
  if (!name) return

  const s = stmts()
  const createdAt = event.timestamp ?? Math.floor(Date.now() / 1000)

  const apply = db.transaction(() => {
    switch (name) {
      case "lock_created": {
        const [, id, creator, token, amount, beneficiary, unlockAt] = event.topics
        const lockId = `token:${String(id)}`
        if (!s.insertEvent.run(event.id, event.ledger, name, lockId).changes) return
        s.upsertLock.run({
          id: lockId,
          kind: "token",
          creator: String(creator),
          beneficiary: String(beneficiary),
          token: String(token),
          token_a: null,
          token_b: null,
          dex: null,
          pool_share: null,
          amount: String(amount),
          unlock_at: Number(unlockAt),
          created_at: createdAt,
        })
        break
      }
      // Each split-group child now publishes its own `lock_created` event
      // (own id, beneficiary, amount) handled by the case above, including
      // the first child, whose id equals the group id. This event is only a
      // group-level summary — it must NOT upsert a lock row, since that
      // would clobber the correct per-child row (from the case above) with
      // the group's aggregate total and the creator standing in as
      // beneficiary.
      case "split_lock_created": {
        const [, groupId] = event.topics
        const lockId = `token:${String(groupId)}`
        s.insertEvent.run(event.id, event.ledger, name, lockId)
        break
      }
      case "lock_withdrawn": {
        const [, id, , , releasable] = event.topics
        const lockId = `token:${String(id)}`
        if (!s.insertEvent.run(event.id, event.ledger, name, lockId).changes) return
        applyRelease(s, lockId, BigInt(releasable as bigint))
        break
      }
      case "lock_extended": {
        const [, id, , , newUnlockAt] = event.topics
        const lockId = `token:${String(id)}`
        if (!s.insertEvent.run(event.id, event.ledger, name, lockId).changes) return
        s.extendUnlock.run(Number(newUnlockAt), lockId)
        break
      }
      case "beneficiary_transferred": {
        const [, id, , newBeneficiary] = event.topics
        const lockId = `token:${String(id)}`
        if (!s.insertEvent.run(event.id, event.ledger, name, lockId).changes) return
        s.setBeneficiary.run(String(newBeneficiary), lockId)
        break
      }
      case "lp_lock_created": {
        const [, id, creator, poolShare, amount, beneficiary, unlockAt] = event.topics
        const lockId = `lp:${String(id)}`
        if (!s.insertEvent.run(event.id, event.ledger, name, lockId).changes) return
        // The contract emits (dex, token_a, token_b) as the event data tuple.
        // scValToNative converts a Soroban enum variant like Dex::Aquarius to
        // { Aquarius: {} }, so extract the first key as the dex name string.
        const [dex, tokenA, tokenB] = Array.isArray(event.data) ? (event.data as unknown[]) : []
        const dexStr =
          dex != null && typeof dex === "object" ? (Object.keys(dex)[0] ?? null) : typeof dex === "string" ? dex : null
        s.upsertLock.run({
          id: lockId,
          kind: "lp",
          creator: String(creator),
          beneficiary: String(beneficiary),
          token: String(poolShare),
          token_a: typeof tokenA === "string" ? tokenA : null,
          token_b: typeof tokenB === "string" ? tokenB : null,
          dex: dexStr,
          pool_share: String(poolShare),
          amount: String(amount),
          unlock_at: Number(unlockAt),
          created_at: createdAt,
        })
        break
      }
      case "lp_lock_withdrawn": {
        // Contract emits topics=(symbol, id), data=(beneficiary, pool_share, releasable) —
        // a vesting LP lock can emit several of these (one per partial
        // claim), so cumulative tracking via applyRelease is required.
        const [, id] = event.topics
        const [, , releasable] = event.data as unknown[]
        const lockId = `lp:${String(id)}`
        if (!s.insertEvent.run(event.id, event.ledger, name, lockId).changes) return
        applyRelease(s, lockId, BigInt(releasable as bigint))
        break
      }
      case "lp_lock_extended": {
        // Contract emits topics=(symbol, id), data=(creator, old_unlock_at, new_unlock_at).
        const [, id] = event.topics
        const [, , newUnlockAt] = event.data as unknown[]
        const lockId = `lp:${String(id)}`
        if (!s.insertEvent.run(event.id, event.ledger, name, lockId).changes) return
        s.extendUnlock.run(Number(newUnlockAt), lockId)
        break
      }
      case "lp_beneficiary_transferred": {
        // Contract emits topics=(symbol, id), data=(old_beneficiary, new_beneficiary).
        const [, id] = event.topics
        const [, newBeneficiary] = event.data as unknown[]
        const lockId = `lp:${String(id)}`
        if (!s.insertEvent.run(event.id, event.ledger, name, lockId).changes) return
        s.setBeneficiary.run(String(newBeneficiary), lockId)
        break
      }
      default:
        // upgrade_proposed / upgrade_cancelled / unknown events — not lock state.
        return
    }
  })
  apply()
}

export function getStats(): AggregateStats {
  ensureDb()
  const now = Math.floor(Date.now() / 1000)

  const totals = db
    .prepare("SELECT COUNT(*) AS totalLocks, COUNT(DISTINCT token) AS uniqueTokens FROM locks")
    .get() as { totalLocks: number; uniqueTokens: number }

  const totalValue = (
    db.prepare("SELECT amount FROM locks WHERE status = 'locked'").all() as { amount: string }[]
  ).reduce((sum, r) => sum + BigInt(r.amount), BigInt(0))

  const recentLocks = (
    db.prepare("SELECT * FROM locks ORDER BY created_at DESC, id DESC LIMIT 10").all() as LockRow[]
  ).map(rowToLock)

  const upcomingUnlocks = (
    db
      .prepare("SELECT * FROM locks WHERE status = 'locked' AND unlock_at > ? ORDER BY unlock_at ASC LIMIT 10")
      .all(now) as LockRow[]
  ).map(rowToLock)

  return {
    totalLocks: totals.totalLocks,
    totalValue,
    uniqueTokens: totals.uniqueTokens,
    recentLocks,
    upcomingUnlocks,
  }
}

export function getLocksForToken(token: string): IndexedLock[] {
  ensureDb()
  const rows = db.prepare("SELECT * FROM locks WHERE token = ? ORDER BY created_at ASC").all(token) as LockRow[]
  return rows.map(rowToLock)
}

export interface LockPage {
  locks: IndexedLock[]
  total: number
}

/** Paginated variant of getLocksForToken, for the HTTP API's lock-list endpoint. */
export function getLocksForTokenPage(token: string, offset = 0, limit = 50): LockPage {
  ensureDb()
  const { total } = db.prepare("SELECT COUNT(*) AS total FROM locks WHERE token = ?").get(token) as { total: number }
  const rows = db
    .prepare("SELECT * FROM locks WHERE token = ? ORDER BY created_at ASC LIMIT ? OFFSET ?")
    .all(token, limit, offset) as LockRow[]
  return { locks: rows.map(rowToLock), total }
}

export interface TokenAggregate {
  token: string
  lockCount: number
  totalLocked: bigint
}

/**
 * Per-token totals across all still-locked locks, sorted by amount locked
 * (descending). Powers cross-token views (e.g. "top tokens by TVL") that a
 * direct RPC client can't answer without iterating every lock.
 */
export function getTopTokens(limit = 50): TokenAggregate[] {
  ensureDb()
  const rows = db.prepare("SELECT token, amount FROM locks WHERE status = 'locked'").all() as {
    token: string
    amount: string
  }[]

  const byToken = new Map<string, TokenAggregate>()
  for (const r of rows) {
    const entry = byToken.get(r.token) ?? { token: r.token, lockCount: 0, totalLocked: 0n }
    entry.lockCount++
    entry.totalLocked += BigInt(r.amount)
    byToken.set(r.token, entry)
  }

  return [...byToken.values()]
    .sort((a, b) => (a.totalLocked === b.totalLocked ? 0 : a.totalLocked < b.totalLocked ? 1 : -1))
    .slice(0, limit)
}

export function getLastIndexed(): number {
  ensureDb()
  return Number(getMeta(META_LAST_LEDGER) ?? 0)
}

/** Minimal surface of the Soroban RPC Server the poller needs (injectable in tests). */
export interface EventSource {
  getLatestLedger(): Promise<{ sequence: number }>
  getEvents(request: {
    startLedger?: number
    cursor?: string
    filters: { type: "contract"; contractIds: string[] }[]
    limit?: number
  }): Promise<{
    latestLedger: number
    cursor?: string
    events: {
      id: string
      ledger: number
      ledgerClosedAt?: string
      topic: xdr.ScVal[]
      value: xdr.ScVal
    }[]
  }>
}

/**
 * Fetch and index the next page of contract events, persisting the RPC
 * cursor / last ledger in index_meta so progress survives restarts.
 * Returns the number of events processed.
 */
export async function pollOnce(server: EventSource): Promise<number> {
  ensureDb()

  const contractIds = [TOKEN_LOCKER_ID, LP_LOCKER_ID].filter(Boolean)
  if (contractIds.length === 0) {
    throw new Error(
      "[indexer] fatal: both TOKEN_LOCKER_CONTRACT and LP_LOCKER_CONTRACT are unset — refusing to poll with no contract filter (this would silently index every contract's events)",
    )
  }
  const filters = [{ type: "contract" as const, contractIds }]

  const cursor = getMeta(META_CURSOR)
  let request: Parameters<EventSource["getEvents"]>[0]
  if (cursor) {
    request = { cursor, filters, limit: EVENTS_PAGE_LIMIT }
  } else {
    const lastLedger = Number(getMeta(META_LAST_LEDGER) ?? 0)
    const startLedger = lastLedger > 0 ? lastLedger + 1 : (await server.getLatestLedger()).sequence
    request = { startLedger, filters, limit: EVENTS_PAGE_LIMIT }
  }

  let resp: Awaited<ReturnType<EventSource["getEvents"]>>
  try {
    resp = await server.getEvents(request)
  } catch (err) {
    // A stored cursor can age out of the RPC node's retention window (e.g.
    // after the indexer has been down for a while, or the node's retention
    // is shorter than expected). Recognize that specific failure and clear
    // the cursor so the *next* poll falls back to ledger-based resumption —
    // the same path used when no cursor exists yet — instead of retrying
    // the same dead cursor forever.
    if (cursor && /cursor/i.test(String((err as Error)?.message ?? err))) {
      console.error(`[indexer] cursor rejected by RPC, clearing it and resuming from the last indexed ledger:`, err)
      deleteMeta(META_CURSOR)
      return 0
    }
    throw err
  }

  let processed = 0
  for (const raw of resp.events) {
    try {
      processEvent({
        id: raw.id,
        ledger: raw.ledger,
        timestamp: raw.ledgerClosedAt ? Math.floor(Date.parse(raw.ledgerClosedAt) / 1000) : undefined,
        topics: raw.topic.map((t): unknown => scValToNative(t)),
        data: raw.value ? scValToNative(raw.value) : undefined,
      })
      processed++
    } catch (err) {
      console.error(`[indexer] failed to process event ${raw.id}:`, err)
    }
  }

  if (resp.cursor) setMeta(META_CURSOR, resp.cursor)
  const maxEventLedger = resp.events.reduce((max, e) => Math.max(max, e.ledger), 0)
  const pageFull = resp.events.length >= EVENTS_PAGE_LIMIT
  // If the page was full there may be more events in the same ledger that the
  // cursor would have reached. Record one ledger *before* maxEventLedger so
  // that if the cursor later expires the fallback (startLedger = lastIndexed + 1)
  // re-includes maxEventLedger rather than skipping its tail. Already-seen
  // event IDs are deduplicated by INSERT OR IGNORE, so the re-fetch is safe.
  // When the page is partial we've consumed everything up to latestLedger.
  const lastIndexed = pageFull
    ? Math.max(maxEventLedger - 1, 0)
    : Math.max(maxEventLedger, resp.latestLedger)
  if (lastIndexed > getLastIndexed()) setMeta(META_LAST_LEDGER, String(lastIndexed))

  return processed
}

export interface PollerHandle {
  stop(): void
}

/** Start polling every POLL_INTERVAL_MS (default 10 seconds). */
export function startPolling(options: { server?: EventSource; intervalMs?: number } = {}): PollerHandle {
  ensureDb()
  const server = options.server ?? new Server(RPC_URL, { allowHttp: RPC_URL.startsWith("http://") })
  const intervalMs = options.intervalMs ?? POLL_INTERVAL_MS

  let inFlight = false
  const tick = async () => {
    if (inFlight) return
    inFlight = true
    try {
      await pollOnce(server)
    } catch (err) {
      console.error("[indexer] poll failed:", err)
    } finally {
      inFlight = false
    }
  }

  void tick()
  const timer = setInterval(() => {
    void tick()
  }, intervalMs)
  return { stop: () => clearInterval(timer) }
}

const isMain =
  typeof process !== "undefined" && process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href

if (isMain) {
  console.log(`[indexer] polling ${RPC_URL} every ${POLL_INTERVAL_MS}ms`)
  startPolling()
}
