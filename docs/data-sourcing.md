# Data sourcing: indexer-first, RPC fallback

The frontend has two ways to read lock data: the lock indexer's HTTP API
(fast, pre-aggregated, DB-backed) and direct Soroban RPC calls (always
correct, slower, no aggregation). This document is the single place
describing the convention that ties them together — previously this was
only discoverable by reading `src/lib/indexer-client.ts`,
`src/lib/queryLocks.ts`, and `src/hooks/useLocks.ts` separately.

## The convention: `null` means "fall back to RPC"

Every indexer-fetching function in `src/lib/indexer-client.ts`
(`fetchIndexerStats`, `fetchIndexerLocksForToken`) returns `T | null`:

- **Non-null** → the indexer answered successfully; use its data.
- **`null`** → the indexer is unreachable, timed out, or returned a non-OK
  response. The caller must fall back to a direct on-chain RPC call.

This is enforced at the lowest level, in `fetchJson` (`indexer-client.ts`):
any thrown error or non-OK HTTP status is caught and logged at `debug` level,
then converted to `null` — callers never see the underlying fetch error, only
the null/non-null signal.

Callers that build on `fetchIndexerStats`/`fetchIndexerLocksForToken`
(`src/lib/queryLocks.ts`, `src/hooks/useLocks.ts`) follow the same pattern one
level up: `queryLocksByToken`, `queryLockCountByToken`, and `querySiteStats`
all check for a null/empty indexer result and call the direct-RPC
equivalent (`getLocksByToken`, `getLockCountByToken`, etc.) instead.

**Exception — site-wide stats degrade to zeros, not RPC**:
`querySiteStats` cannot fall back to RPC (aggregating "total locks across
every token" would require scanning every contract) — when the indexer is
unavailable it returns a `source: "fallback"` result with all counts zeroed
and empty lists, rather than mock or partial data. Callers that want a
demo/mock overlay for local development check `stats.source === "fallback"`
themselves (see `Discover.tsx`'s use of `MOCK_LOCKS`) rather than the data
layer silently fabricating numbers.

## Timeout and cache constants

Both defined in `src/lib/indexer-client.ts`:

| Constant | Value | Purpose |
|---|---|---|
| `FETCH_TIMEOUT_MS` | 3000 (3s) | `AbortSignal.timeout` on the indexer fetch — the RPC fallback should be reached quickly, not after a long hang. |
| `CACHE_TTL_MS` | 10,000 (10s) | In-memory cache (keyed by request URL) for successful indexer responses, to avoid re-fetching the same stats/page on rapid re-renders. |

The cache is a plain in-memory `Map`, per browser tab/server instance — it is
not shared across requests in a serverless deployment and does not persist
across reloads. Failed lookups (the `null` case) are never cached, so a
transient indexer outage doesn't get "stuck" returning null for the TTL
window.

## Adding a new indexer-backed page

1. Add a fetch function to `indexer-client.ts` following the existing
   `fetchIndexerStats`/`fetchIndexerLocksForToken` pattern: return `T | null`,
   route through `fetchJson`, don't invent a separate timeout/cache constant.
2. In the consuming query/hook, check for `null` (or an empty/unusable
   result) and call the equivalent direct-RPC function.
3. If there's no sensible RPC fallback for what you're building (e.g. another
   cross-contract aggregate), follow the `querySiteStats` precedent: degrade
   to a clearly-marked empty/zeroed state rather than fabricating data.
