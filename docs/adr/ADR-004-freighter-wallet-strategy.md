# ADR-004: Freighter-First Wallet Strategy

## Status
Accepted

## Context
StellarLock needs users to sign transactions. Stellar has multiple wallet
extensions; choosing the wrong abstraction can lock out users or introduce
dependency risk.

## Decision
Use `@creit.tech/stellar-wallets-kit` (Stellar Wallets Kit) with `allowAllModules()`.
Freighter is the primary tested wallet, but the kit also supports other Stellar
wallets (xBull, Albedo, etc.) without code changes.

## Consequences
- Wallet connection UI is a single modal provided by the kit.
- `useWallet` exposes the connection lifecycle as `idle`, `connecting`, `retrying`, `failed`, and `success`. A connection makes at most four attempts, waiting 1, 2, and 4 seconds between attempts. The final failure is surfaced through the UI and a notification.
- A successful connection stores the public address under `localStorage["stellarlock:wallet"]` and the selected wallet identifier under `localStorage["stellarlock:wallet-id"]`. On startup, both values are required: the selected wallet must still return the same address before the session is restored. A missing, mismatched, or rejected value clears both keys.
- After restoration, the provider polls `getAddress()` every 10 seconds. A missing address, an address mismatch, or a thrown wallet error marks the session disconnected, clears the two storage keys, and leaves the application disconnected until the user connects again.
- Connection failures are mapped to actionable messages: cancellation or rejection prompts the user to approve the wallet prompt, network errors ask for the app's network, missing Freighter errors ask for an installed/unlocked extension, and other errors fall back to a retry message.
- `@stellar/freighter-api` is kept as a peer dependency for health checks.
- Future wallet additions require no frontend code changes.
