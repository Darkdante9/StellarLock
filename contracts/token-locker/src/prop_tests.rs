//! Property-based (fuzz) tests for StellarLock token-locker invariants.
//!
//! Run with:  cargo test --package token-locker
//! Set PROPTEST_CASES=10000 for extended CI runs.

use proptest::prelude::*;

use crate::calculate_vested;

// ── Strategies ────────────────────────────────────────────────────────────────

// Keep amounts in a practical range: 1 stroop to 10 billion tokens.
fn amount_strategy() -> impl Strategy<Value = i128> {
    1_i128..=100_000_000_000_000_000_i128
}

// Timestamps in a realistic range (unix seconds, year 2020–2100).
fn ts_strategy() -> impl Strategy<Value = u64> {
    1_577_836_800_u64..=4_102_444_800_u64
}

// ── Invariant 1: vested amount is always within [0, total_amount] ─────────────

proptest! {
    #[test]
    fn vested_never_exceeds_total(
        amount in amount_strategy(),
        start in ts_strategy(),
        end in ts_strategy(),
        now in ts_strategy(),
    ) {
        let vested = calculate_vested(amount, start, end, now);
        prop_assert!(vested >= 0, "vested must be non-negative");
        prop_assert!(vested <= amount, "vested must not exceed total amount");
    }
}

// ── Invariant 2: vesting is monotonically non-decreasing over time ────────────

proptest! {
    #[test]
    fn vested_is_monotone(
        amount in amount_strategy(),
        start in ts_strategy(),
        end in ts_strategy(),
        t1 in ts_strategy(),
        t2 in ts_strategy(),
    ) {
        let (t_early, t_late) = if t1 <= t2 { (t1, t2) } else { (t2, t1) };
        let v_early = calculate_vested(amount, start, end, t_early);
        let v_late  = calculate_vested(amount, start, end, t_late);
        prop_assert!(
            v_late >= v_early,
            "later timestamp {t_late} vested {v_late} < earlier {t_early} vested {v_early}"
        );
    }
}

// ── Invariant 3: before vesting starts, nothing is vested ────────────────────

proptest! {
    #[test]
    fn nothing_vested_before_start(
        amount in amount_strategy(),
        start in ts_strategy(),
        end in ts_strategy(),
    ) {
        // now is strictly before start
        if start > 0 {
            let now = start - 1;
            let vested = calculate_vested(amount, start, end, now);
            prop_assert_eq!(vested, 0, "nothing should be vested before start");
        }
    }
}

// ── Invariant 4: at or after end, everything is vested ───────────────────────

proptest! {
    #[test]
    fn fully_vested_at_or_after_end(
        amount in amount_strategy(),
        start in ts_strategy(),
        extra_secs in 1_u64..=31_536_000_u64, // 1 second to 1 year
    ) {
        let end = start.saturating_add(extra_secs);
        // now at end or after: should be fully vested
        let vested_at_end = calculate_vested(amount, start, end, end);
        prop_assert_eq!(vested_at_end, amount, "should be fully vested at end");

        let vested_after = calculate_vested(amount, start, end, end + 1);
        prop_assert_eq!(vested_after, amount, "should remain fully vested after end");
    }
}

// ── Invariant 5: zero-duration vesting immediately vests everything ───────────

proptest! {
    #[test]
    fn zero_duration_vests_everything(
        amount in amount_strategy(),
        ts in ts_strategy(),
    ) {
        // start == end means 0-duration: should immediately return full amount
        let vested = calculate_vested(amount, ts, ts, ts);
        prop_assert_eq!(vested, amount);
    }
}

// ── Invariant 6: no overflow with extreme inputs ──────────────────────────────

proptest! {
    #[test]
    fn no_overflow_on_extreme_inputs(
        amount in 0_i128..=i128::MAX / 2,
        start in 0_u64..u64::MAX / 2,
        end   in 0_u64..u64::MAX / 2,
        now   in 0_u64..u64::MAX / 2,
    ) {
        // Should not panic regardless of inputs.
        let vested = calculate_vested(amount, start, end, now);
        prop_assert!(vested >= 0);
        prop_assert!(vested <= amount.max(0));
    }
}
