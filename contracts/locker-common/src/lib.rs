#![cfg_attr(not(test), no_std)]
//! Shared types, constants, and helper functions for token-locker and lp-locker.

use soroban_sdk::{contracttype, vec, BytesN, Env, IntoVal, String, TryFromVal, Val, Vec};

// ── TTL constants ─────────────────────────────────────────────────────────────

pub const LEDGERS_PER_DAY: u32 = 17_280;
pub const PERSISTENT_BUMP: u32 = 365 * LEDGERS_PER_DAY;
pub const PERSISTENT_THRESHOLD: u32 = PERSISTENT_BUMP;
pub const INSTANCE_BUMP: u32 = 30 * LEDGERS_PER_DAY;
pub const INSTANCE_THRESHOLD: u32 = 7 * LEDGERS_PER_DAY;
pub const WITHDRAWN_BUMP: u32 = 30 * LEDGERS_PER_DAY;
pub const WITHDRAWN_THRESHOLD: u32 = 7 * LEDGERS_PER_DAY;

// ── Rate-limiting constants ───────────────────────────────────────────────────

/// Minimum seconds between two create_lock calls from the same creator.
pub const RATE_LIMIT_COOLDOWN: u64 = 60;
/// TTL in ledgers for the temporary LastLockAt entry (~1 hour at 5 s/ledger).
pub const RATE_LIMIT_TTL_LEDGERS: u32 = 720;

// ── Upgrade-timelock constant ─────────────────────────────────────────────────

/// Seconds an upgrade proposal must sit on-chain before it can be executed.
pub const UPGRADE_DELAY: u64 = 7 * 24 * 3600;

// ── Shared on-chain types ─────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub struct UpgradeProposal {
    pub new_wasm_hash: BytesN<32>,
    pub execute_after: u64,
}

/// Linear-vesting schedule. Sentinel for "no vesting": start == end == 0.
#[contracttype]
#[derive(Clone)]
pub struct Vesting {
    pub start: u64,
    pub end: u64,
    pub released: i128,
}

impl Vesting {
    pub fn none() -> Self {
        Vesting {
            start: 0,
            end: 0,
            released: 0,
        }
    }
    pub fn is_none(&self) -> bool {
        self.start == 0 && self.end == 0
    }
}

/// Optional public-facing project metadata stored with a lock.
/// "No metadata" = all fields are empty strings (see [`LockMetadata::empty`]).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LockMetadata {
    pub description: String,
    pub project_url: String,
    pub logo_url: String,
}

impl LockMetadata {
    pub fn is_empty(&self) -> bool {
        self.description.is_empty() && self.project_url.is_empty() && self.logo_url.is_empty()
    }

    pub fn empty(env: &Env) -> Self {
        LockMetadata {
            description: String::from_str(env, ""),
            project_url: String::from_str(env, ""),
            logo_url: String::from_str(env, ""),
        }
    }
}

// ── Generic storage helpers ───────────────────────────────────────────────────

/// Return the next monotonic id from instance storage keyed by `id_key`.
/// First call returns `initial_value`; subsequent calls increment by 1.
pub fn next_id<K>(env: &Env, id_key: K, initial_value: u64) -> u64
where
    K: IntoVal<Env, Val> + TryFromVal<Env, Val> + Clone,
{
    let id: u64 = env
        .storage()
        .instance()
        .get(&id_key)
        .unwrap_or(initial_value);
    let next = id.saturating_add(1);
    env.storage().instance().set(&id_key, &next);
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_THRESHOLD, INSTANCE_BUMP);
    id
}

/// Append `lock_id` to the persistent `Vec<u64>` under `index_key`.
pub fn push_index<K>(env: &Env, index_key: K, lock_id: u64, withdrawn: bool)
where
    K: IntoVal<Env, Val> + TryFromVal<Env, Val> + Clone,
{
    let mut ids: Vec<u64> = env
        .storage()
        .persistent()
        .get(&index_key)
        .unwrap_or(vec![env]);
    ids.push_back(lock_id);
    env.storage().persistent().set(&index_key, &ids);
    if withdrawn {
        env.storage()
            .persistent()
            .extend_ttl(&index_key, WITHDRAWN_THRESHOLD, WITHDRAWN_BUMP);
    } else {
        env.storage()
            .persistent()
            .extend_ttl(&index_key, PERSISTENT_THRESHOLD, PERSISTENT_BUMP);
    }
}

/// Remove `lock_id` from the persistent `Vec<u64>` under `index_key`.
pub fn remove_from_index<K>(env: &Env, index_key: K, lock_id: u64)
where
    K: IntoVal<Env, Val> + TryFromVal<Env, Val> + Clone,
{
    let ids: Vec<u64> = env
        .storage()
        .persistent()
        .get(&index_key)
        .unwrap_or(vec![env]);
    let mut filtered: Vec<u64> = vec![env];
    for existing in ids.iter() {
        if existing != lock_id {
            filtered.push_back(existing);
        }
    }
    env.storage().persistent().set(&index_key, &filtered);
    env.storage()
        .persistent()
        .extend_ttl(&index_key, PERSISTENT_THRESHOLD, PERSISTENT_BUMP);
}

/// Return the `Vec<u64>` stored under `index_key`, or an empty vec.
pub fn get_index<K>(env: &Env, index_key: K) -> Vec<u64>
where
    K: IntoVal<Env, Val> + TryFromVal<Env, Val>,
{
    env.storage()
        .persistent()
        .get(&index_key)
        .unwrap_or(vec![env])
}

/// Paginate over `ids` and collect lock values via `lock_key_fn(id)`.
pub fn collect_paginated<K, V, F>(
    env: &Env,
    ids: Vec<u64>,
    offset: u32,
    limit: u32,
    lock_key_fn: F,
) -> Vec<V>
where
    K: IntoVal<Env, Val> + TryFromVal<Env, Val>,
    V: IntoVal<Env, Val> + TryFromVal<Env, Val>,
    F: Fn(u64) -> K,
{
    let mut out: Vec<V> = vec![env];
    let len = ids.len();
    let start = offset.min(len);
    let end = start.saturating_add(limit).min(len);
    let mut i = start;
    while i < end {
        let id = ids.get(i).unwrap();
        if let Some(lock) = env.storage().persistent().get(&lock_key_fn(id)) {
            out.push_back(lock);
        }
        i += 1;
    }
    out
}

// ── Pure computation ──────────────────────────────────────────────────────────

/// Linear vesting: how much of `amount` has vested by `now`.
pub fn calculate_vested(amount: i128, start: u64, end: u64, now: u64) -> i128 {
    if now < start || amount <= 0 {
        return 0;
    }
    let elapsed = now.saturating_sub(start) as i128;
    let duration = end.saturating_sub(start) as i128;
    if duration <= 0 {
        return amount;
    }
    (amount.saturating_mul(elapsed) / duration)
        .min(amount)
        .max(0)
}

// ── Re-entrancy guard ─────────────────────────────────────────────────────────

/// Set the re-entrancy guard. Returns `detected_error` if already held.
pub fn enter_guard<K, E>(env: &Env, guard_key: &K, detected_error: E) -> Result<(), E>
where
    K: IntoVal<Env, Val> + TryFromVal<Env, Val>,
{
    if env.storage().temporary().has(guard_key) {
        return Err(detected_error);
    }
    env.storage().temporary().set(guard_key, &true);
    env.storage().temporary().extend_ttl(guard_key, 1, 1);
    Ok(())
}

/// Clear the re-entrancy guard set by [`enter_guard`].
pub fn exit_guard<K>(env: &Env, guard_key: &K)
where
    K: IntoVal<Env, Val> + TryFromVal<Env, Val>,
{
    env.storage().temporary().remove(guard_key);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{contract, contractimpl, Env};

    // Minimal contract needed so env.as_contract() has a valid address.
    #[contract]
    struct DummyContract;
    #[contractimpl]
    impl DummyContract {}

    #[contracttype]
    #[derive(Clone)]
    enum TestKey {
        NextId,
        Index(u64),
        Lock(u64),
        Guard,
    }

    #[test]
    fn vested_before_start_is_zero() {
        assert_eq!(calculate_vested(1_000, 100, 200, 50), 0);
    }

    #[test]
    fn vested_after_end_is_full_amount() {
        assert_eq!(calculate_vested(1_000, 100, 200, 300), 1_000);
    }

    #[test]
    fn vested_at_midpoint_is_half() {
        assert_eq!(calculate_vested(1_000, 0, 1_000, 500), 500);
    }

    #[test]
    fn next_id_increments() {
        let env = Env::default();
        let contract_id = env.register(DummyContract, ());
        env.as_contract(&contract_id, || {
            assert_eq!(next_id(&env, TestKey::NextId, 1_000), 1_000);
            assert_eq!(next_id(&env, TestKey::NextId, 1_000), 1_001);
            assert_eq!(next_id(&env, TestKey::NextId, 1_000), 1_002);
        });
    }

    #[test]
    fn push_and_get_index_round_trip() {
        let env = Env::default();
        let contract_id = env.register(DummyContract, ());
        env.as_contract(&contract_id, || {
            push_index(&env, TestKey::Index(1), 42, false);
            push_index(&env, TestKey::Index(1), 99, false);
            let ids = get_index(&env, TestKey::Index(1));
            assert_eq!(ids.len(), 2);
            assert!(ids.contains(42u64));
            assert!(ids.contains(99u64));
        });
    }

    #[test]
    fn remove_from_index_removes_only_target() {
        let env = Env::default();
        let contract_id = env.register(DummyContract, ());
        env.as_contract(&contract_id, || {
            push_index(&env, TestKey::Index(2), 10, false);
            push_index(&env, TestKey::Index(2), 20, false);
            push_index(&env, TestKey::Index(2), 30, false);
            remove_from_index(&env, TestKey::Index(2), 20);
            let ids = get_index(&env, TestKey::Index(2));
            assert_eq!(ids.len(), 2);
            assert!(!ids.contains(20u64));
        });
    }

    #[test]
    fn collect_paginated_pages_correctly() {
        let env = Env::default();
        let contract_id = env.register(DummyContract, ());
        env.as_contract(&contract_id, || {
            for i in 0u64..5 {
                env.storage()
                    .persistent()
                    .set(&TestKey::Lock(i), &(i * 10u64));
            }
            let ids = soroban_sdk::vec![&env, 0u64, 1u64, 2u64, 3u64, 4u64];
            let page0: Vec<u64> = collect_paginated(&env, ids.clone(), 0, 3, TestKey::Lock);
            assert_eq!(page0.len(), 3);
            let page1: Vec<u64> = collect_paginated(&env, ids.clone(), 3, 3, TestKey::Lock);
            assert_eq!(page1.len(), 2);
            let empty: Vec<u64> = collect_paginated(&env, ids, 10, 3, TestKey::Lock);
            assert_eq!(empty.len(), 0);
        });
    }

    #[test]
    fn guard_blocks_reentrant_call() {
        let env = Env::default();
        let contract_id = env.register(DummyContract, ());
        env.as_contract(&contract_id, || {
            assert!(enter_guard(&env, &TestKey::Guard, 99u32).is_ok());
            assert_eq!(
                enter_guard::<TestKey, u32>(&env, &TestKey::Guard, 99u32),
                Err(99u32)
            );
            exit_guard(&env, &TestKey::Guard);
            assert!(enter_guard(&env, &TestKey::Guard, 99u32).is_ok());
        });
    }

    #[test]
    fn vesting_none_sentinel() {
        let v = Vesting::none();
        assert!(v.is_none());
        let v2 = Vesting {
            start: 1,
            end: 100,
            released: 0,
        };
        assert!(!v2.is_none());
    }

    #[test]
    fn lock_metadata_empty_detection() {
        let env = Env::default();
        assert!(LockMetadata::empty(&env).is_empty());
        let m = LockMetadata {
            description: String::from_str(&env, "hello"),
            project_url: String::from_str(&env, ""),
            logo_url: String::from_str(&env, ""),
        };
        assert!(!m.is_empty());
    }
}
