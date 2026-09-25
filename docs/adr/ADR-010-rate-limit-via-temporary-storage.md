# ADR-010: Per-creator rate limiting via temporary storage

## Status
Accepted

## Context
`create_lock` and `create_split_lock` (both token-locker and lp-locker) need
to reject rapid repeated calls from the same creator to limit spam — cheap,
same-account transaction floods that would otherwise inflate the on-chain
lock count and index/UI load for no legitimate purpose.

## Decision
Each contract stores the creator's last successful lock-creation timestamp
under `DataKey::LastLockAt(creator)` in Soroban's **temporary** storage
(`env.storage().temporary()`), not persistent storage. On each call:

1. Read the creator's last timestamp (defaulting to `0` if absent).
2. Reject with `ContractError::RateLimitExceeded` if fewer than
   `RATE_LIMIT_COOLDOWN` (60 seconds, `contracts/locker-common/src/lib.rs`)
   have elapsed since then.
3. On success, write the current timestamp back and extend the entry's TTL
   to `RATE_LIMIT_TTL_LEDGERS` (720 ledgers, ~1 hour at 5s/ledger).

Temporary storage was chosen over persistent storage because:

- **The data is inherently short-lived.** The only thing that ever matters is
  "did this creator lock something in the last 60 seconds?" — once the
  cooldown window has passed, the old timestamp has no further use.
- **No rent/TTL-bump cost for a value nobody needs to keep.** Persistent
  storage requires ongoing TTL extension (and the associated fees) to avoid
  archival; temporary entries expire on their own once their TTL lapses,
  which is exactly the lifecycle this data needs.
- **It naturally self-cleans.** An account that stops using the contract
  doesn't leave a `LastLockAt` entry lingering in persistent storage forever.

## Consequences
- If a `LastLockAt` entry expires (TTL lapses without a new lock) before a
  creator's next call, `last_at` reads back as `0` and the cooldown check
  passes trivially — this is intentional and harmless: the cooldown's job is
  only to throttle *rapid* repeated calls, not to remember creators forever.
- The exact cooldown is 60 seconds, not an approximate "few minutes" — user
  docs (`docs/troubleshooting.md`) and support guidance should state this
  precisely rather than round it up.
- Because the key is per-creator, this only throttles a single account
  spamming itself; it does not protect against spam spread across many
  distinct accounts (a different, unaddressed threat model).
