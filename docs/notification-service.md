# Notification Service Architecture

> **Status: Implemented.** The cron worker (`indexer/notifier.ts`), subscription API (`api/notifications/`), database schema (`notification_subscriptions` table in `indexer/db.ts`), and email UI (`src/components/locks/NotificationSettings.tsx`) are all shipped. Email delivery uses [Resend](https://resend.com). Set `RESEND_API_KEY`, `EMAIL_FROM`, and `WEBHOOK_SECRET` environment variables before deploying.

Backend service for monitoring lock timestamps and dispatching unlock notifications via email and webhook when locks approach their unlock dates.

## Components

### 1. Lock Monitor Worker

Runs on a cron schedule (every hour). For each registered notification subscription:

1. Read the lock's `unlock_at`, `token`, `amount`, and `beneficiary` directly from the local `locks` SQLite table (written by `indexer/index.ts`'s event poller)
2. Compare against current time to determine if a reminder threshold was crossed
3. Dispatch notifications for thresholds: 7 days, 1 day, and at unlock

> **Note:** The worker relies on the indexer's event-replay pipeline being up to date to have accurate lock state.

```
┌──────────────┐     ┌──────────────────────┐
│  Cron Worker  │────▶│ SQLite `locks` Table │◀──── (indexer/index.ts event poller)
│  (every 1h)  │     │ (read unlock_at etc.)│
└──────┬───────┘     └──────────────────────┘
       │
       ├──▶ Email (Resend)
       └──▶ Webhook (POST to user URL)
```

### 2. Subscription API

REST endpoints for the frontend to register/unregister notification preferences.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/notifications/subscribe` | Register for lock notifications |
| DELETE | `/api/notifications/unsubscribe?lockId=...&address=...` | Unsubscribe from a lock |
| GET | `/api/notifications/subscriptions` | List user's subscriptions |

#### Subscribe payload

```json
{
  "lockId": "token:1042",
  "address": "G...",
  "email": "user@example.com",
  "webhookUrl": "https://discord.com/api/webhooks/..."
}
```

At least one of `email` or `webhookUrl` must be provided.

#### Unsubscribe parameters

Query parameters:
- `lockId`: the lock id (e.g. `token:1042` or bare `1042`)
- `address`: subscriber's Stellar `G...` address

Example: `DELETE /api/notifications/unsubscribe?lockId=token:1042&address=G...`


### 3. Database Schema

```sql
CREATE TABLE IF NOT EXISTS notification_subscriptions (
  id          TEXT PRIMARY KEY,
  lock_id     TEXT NOT NULL,
  address     TEXT NOT NULL,
  email       TEXT,
  webhook_url TEXT,
  reminded_7d INTEGER DEFAULT 0,
  reminded_1d INTEGER DEFAULT 0,
  reminded_0d INTEGER DEFAULT 0,
  created_at  INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_subs_lock    ON notification_subscriptions(lock_id);
CREATE INDEX IF NOT EXISTS idx_subs_address ON notification_subscriptions(address);
CREATE INDEX IF NOT EXISTS idx_subs_pending ON notification_subscriptions(reminded_0d)
  WHERE reminded_0d = 0;
```

## Webhook Payload Format

```json
{
  "event": "unlock_reminder",
  "lockId": "1042",
  "unlockAt": 1735689600,
  "reminderDays": 7,
  "token": "CUSDC...",
  "amount": "10000.0000000",
  "beneficiary": "G..."
}
```

Events: `unlock_reminder` (7d, 1d before) and `unlocked` (at unlock time).

## Security Considerations

- Rate-limit subscription creation per address
- Validate webhook URLs (no internal IPs, SSRF prevention)
- Sign webhook payloads with HMAC so receivers can verify authenticity
- Encrypt email addresses at rest
- Authenticate subscription API with wallet signature verification
