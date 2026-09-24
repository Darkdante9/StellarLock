# Emergency Response: Pause / Unpause

This is the operator runbook for `pause()`/`unpause()` on both `token-locker`
and `lp-locker`. Read this *before* an incident — the scope of what pausing
does and doesn't stop should not be discovered live.

## What `pause()` blocks

Both contracts gate the same set of state-mutating, non-admin entry points
behind `require_not_paused()`:

| Contract | Blocked while paused |
|---|---|
| `token-locker` | `create_lock`, `withdraw`, `extend`, `transfer_beneficiary`, `create_split_lock` |
| `lp-locker` | `create_lock`, `withdraw`, `extend`, `transfer_beneficiary`, `create_split_lock` |

Any call to these while paused fails with `ContractError::ContractPaused`.

## What `pause()` does NOT block

- **Admin/governance functions**: `propose_admin`, `accept_admin`,
  `propose_upgrade`, `execute_upgrade`, `cancel_upgrade`, and `pause`/`unpause`
  themselves are **not** gated by `require_not_paused`. In particular,
  **`execute_upgrade` can still fire during a pause** — pausing does not
  prevent an already-proposed contract upgrade from completing once its
  `UPGRADE_DELAY` timelock elapses.
- **All read-only queries** (`get_lock`, `get_locks_by_creator`,
  `get_global_stats`, etc.) continue to work normally — pausing only affects
  writes, so Explorer/dashboards/the indexer keep functioning (on already-
  indexed data) during an incident.

## Operator workflow

1. **Assess**: confirm the incident actually requires pausing lock creation
   and lifecycle operations (not, say, an indexer-only issue — pausing the
   contract does nothing for indexer bugs, since read queries aren't gated).
2. **Pause**: call `pause()` on the affected contract(s) as admin. This emits
   `contract_paused`. Do this on `token-locker` and `lp-locker`
   independently — pausing one does not pause the other.
3. **If the incident involves a compromised admin key or a bad pending
   upgrade**: also call `cancel_upgrade()` if a malicious `propose_upgrade`
   is in flight — pausing alone will not stop it from executing once its
   timelock elapses.
4. **Communicate**: users can still read existing lock state (queries aren't
   blocked) but cannot create, withdraw, extend, or transfer locks. Update
   status pages accordingly.
5. **Resolve**: once the underlying issue is fixed, call `unpause()`. This
   emits `contract_unpaused`.
6. **Post-incident**: review whether the incident exposed a gap in this list
   (e.g. an operation that should have been gated but wasn't) and update both
   the contract and this document together.
