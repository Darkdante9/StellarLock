# ADR-008: Indexer-Backed Stats with Graceful Zeroed Fallback (Supersedes Mock Data Strategy)

## Status
Superseded (Mock data fallback removed; live indexer with zeroed fallback adopted)

## Context
Originally, Landing and Discover pages were seeded with a static `MOCK_LOCKS` array to avoid blank pages when testnet lock activity was sparse. However, as the indexer service was implemented, the application transitioned to live aggregated statistics.

## Decision
Landing and Discover pages fetch live indexer statistics over the network via `querySiteStats` (in `queryLocks.ts`) and `useDiscoverStats` (hitting `/api/indexer-stats`). If the indexer is unreachable or returns an error, the pages gracefully degrade to an empty / zeroed `SiteStats` object rather than falling back to static mock data. `MOCK_LOCKS` has been removed from page components and is effectively dead code outside unit/integration tests.

## Consequences
- Landing and Discover pages reflect actual on-chain activity indexed by the backend service.
- If the indexer is down or unreachable, pages display zeroed stats rather than simulated demo figures, ensuring users and contributors are not misled by artificial numbers.
- Network requests to `/api/indexer-stats` are required to populate statistics on these pages.
- `MOCK_LOCKS` is no longer imported or rendered by any production page component.
