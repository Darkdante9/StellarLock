# Indexer Architecture

The indexer turns Soroban contract events into the SQLite state consumed by the API, Explorer, and notification worker. Its design prioritizes safe restarts and replay: a process may stop between pages, an RPC response may be repeated, or a cursor may expire without causing a lock to be double-counted.

## Components and responsibilities

- `indexer/index.ts` polls Soroban RPC, decodes event topics and data, and applies supported events to SQLite.
- `indexer/db.ts` creates the file-backed SQLite database, lock tables, event ledger, metadata, and notification tables.
- `indexer/notifier.ts` reads indexed locks and sends unlock reminders; it does not own event ingestion.
- `LOCK_INDEX_DB_PATH` must point every indexer/API/notifier process at the same SQLite file.

The indexer requires at least one of `TOKEN_LOCKER_CONTRACT` and `LP_LOCKER_CONTRACT`. Refusing to poll without a contract filter prevents an unfiltered request from indexing unrelated contracts.

## Poll and restart model

`pollOnce()` requests at most `EVENTS_PAGE_LIMIT` (100) events and stores progress in the `index_meta` table.

### Cursor versus ledger resumption

The poller chooses its request in this order:

1. If `index_meta.cursor` exists, request the next page with that RPC cursor.
2. Otherwise, read `index_meta.last_indexed_ledger` and request from `last_indexed_ledger + 1`.
3. If no ledger has been recorded, use the latest ledger returned by the RPC as the starting point.

After a successful response, the returned cursor is saved when present. The last indexed ledger is advanced to the highest ledger represented by a full page. For a partial page, it advances to at least the RPC's `latestLedger`, since there are no more events below that point in the returned window.

RPC providers can expire old cursors. If a request made with a stored cursor is rejected with a cursor-related error, the indexer deletes the cursor and returns without retrying that dead cursor forever. The next poll takes the ledger-based path, resuming from the last recorded ledger. Other RPC errors are left for the normal polling error handler.

The first run intentionally starts at the current latest ledger when no progress metadata exists. Deployments that need historical backfill should seed the database with an appropriate `last_indexed_ledger` before starting the poller.

## Idempotent event application

`processEvent()` runs each event mutation inside a SQLite transaction. Before changing a lock, it inserts the RPC event id into `lock_events`:

```sql
INSERT OR IGNORE INTO lock_events (id, ledger_seq, event_type, lock_id)
VALUES (?, ?, ?, ?)
```

`lock_events.id` is the primary key. `INSERT OR IGNORE` therefore returns zero changed rows for an event id that has already been recorded, and the handler returns without applying the state mutation again. This makes replaying an overlapping RPC range safe for lock creation, withdrawals, extensions, and beneficiary transfers.

The event row and the corresponding lock update are committed together. A failed event is logged by `pollOnce()` and does not prevent later events in the same page from being attempted.

## Event mapping

The first decoded topic is the event name. Token-locker payloads are primarily carried in topics, while LP-locker withdrawal, extension, and beneficiary-transfer payloads use the event data tuple.

| Event | Indexed effect |
| --- | --- |
| `lock_created` | Upserts a `token:<id>` lock with creator, token, amount, beneficiary, and unlock time. |
| `split_lock_created` | Records the group event only. It does not create or overwrite a lock row. |
| `lock_withdrawn` | Adds the event's `releasable` amount to the token lock's cumulative `released` total. |
| `lock_extended` | Updates the token lock unlock time and increments `extended_count`. |
| `beneficiary_transferred` | Replaces the token lock beneficiary. |
| `lp_lock_created` | Upserts an `lp:<id>` lock and decodes the DEX/token pair from the data tuple. |
| `lp_lock_withdrawn` | Adds the data-tuple `releasable` amount to the LP lock's cumulative `released` total. |
| `lp_lock_extended` | Updates the LP lock unlock time and increments `extended_count`. |
| `lp_beneficiary_transferred` | Replaces the LP lock beneficiary from the data tuple. |
| Upgrade and unknown events | Ignored because they do not represent lock state. |

A withdrawal for a lock whose creation event has not been indexed is recorded as seen but cannot update a missing row. The indexer expects normal event ordering from the contract/RPC stream; a deployment with a pre-existing database should backfill the relevant creation events before relying on release accounting.

## Split-lock events

A token split emits one `lock_created` event for every child lock, including the child whose id matches the group id. It also emits a group-level `split_lock_created` summary.

The per-child `lock_created` events are authoritative for lock rows because they contain each child's id, beneficiary, and amount. The summary event is deliberately recorded in `lock_events` but does not upsert a row: treating it as a lock would overwrite the first child with aggregate group data and could assign the creator as the beneficiary. This distinction is also why replaying the group event is harmless.

LP split events follow the same principle at the contract level: the indexer relies on the individual `lp_lock_created` events for rows and does not synthesize a row from a split summary.

## Vesting and cumulative release accounting

`released` is stored as a decimal string because token amounts are `bigint` in the application. A linear-vesting lock can emit multiple withdrawal events, each containing only the amount released by that particular claim. `applyRelease()` reads the current total, adds the event amount, and writes the new total back:

- `released < amount` keeps the lock in `locked` status.
- `released >= amount` marks the lock `withdrawn` and sets the withdrawn flag.

The cumulative total is therefore required for correctness; marking a lock withdrawn from the first partial withdrawal would lose the remaining vesting state. The same accounting is used for token and LP locks.

## Operational failure modes

- **Duplicate page or replay:** the `lock_events` primary key suppresses the second mutation.
- **Indexer restart:** `cursor` and `last_indexed_ledger` provide the next request boundary.
- **Expired cursor:** the cursor is cleared and the next poll resumes by ledger.
- **Malformed or unknown event:** the event is ignored or logged according to its handler; it does not create a fabricated lock.
- **Missing contract configuration:** polling stops with an explicit error instead of scanning all contracts.
- **Partially indexed history:** create the database from a known ledger and verify creation events exist before relying on withdrawal totals.

For the event-to-state mapping and the exact SQL statements, see `indexer/index.ts` and `indexer/db.ts`. Changes to either the event schema or the index tables should update this document and the indexer tests together.
