/// Game mathematics and payout calculations
///
/// This module contains the core game logic for:
/// - Survival probability curves
/// - Treasure/payout calculations
/// - Maximum payout limits

/// Calculate survival probability for a given dive number
///
/// Probability decreases as dive_number increases using exponential decay:
/// - Dive 1: 99% survival
/// - Dive 10: 94.5% survival
/// - Dive 20: 90% survival
///
/// Returns: Probability in basis points (1_000_000 = 100%)
pub fn survival_probability_bps(dive_number: u16) -> u32 {
    const BASE_PROB_BPS: u32 = 990_000; // 99% at dive 1
    const DECAY_FACTOR: u32 = 5_000; // -0.5% per dive
    const MIN_PROB_BPS: u32 = 100_000; // Minimum 10%

    let reduction = (dive_number.saturating_sub(1) as u32).saturating_mul(DECAY_FACTOR);

    BASE_PROB_BPS.saturating_sub(reduction).max(MIN_PROB_BPS)
}

/// Calculate treasure amount for a given bet and dive number
///
/// Uses exponential growth: treasure = bet * (1.1 ^ dive_number)
/// This gives approximately:
/// - Dive 1: 1.1x bet
/// - Dive 5: 1.61x bet
/// - Dive 10: 2.59x bet
/// - Dive 20: 6.73x bet
///
/// Capped at max_payout_for_bet()
///
/// Uses u128 intermediate values to prevent overflow during multiplication
pub fn treasure_for_dive(bet_amount: u64, dive_number: u16) -> u64 {
    if dive_number == 0 {
        return bet_amount;
    }

    const SCALE: u128 = 10;
    const MULT: u128 = 11; // 1.1x multiplier

    let max = max_payout_for_bet(bet_amount);
    let mut result = bet_amount as u128;

    for _ in 0..dive_number {
        // Use checked operations on u128 to prevent overflow
        result = result
            .checked_mul(MULT)
            .and_then(|v| v.checked_div(SCALE))
            .unwrap_or(max as u128);

        // Early return if we've hit the cap
        if result >= max as u128 {
            return max;
        }
    }

    // Safely convert back to u64, clamping to max
    result.min(max as u128) as u64
}

/// Calculate maximum possible payout for a given bet amount
///
/// Set to 100x the bet amount as a reasonable cap
/// This prevents overflow and limits house risk per session
pub fn max_payout_for_bet(bet_amount: u64) -> u64 {
    bet_amount.saturating_mul(100)
}

/// Calculate the expected number of dives to reach max payout
///
/// Returns the dive number where treasure >= max_payout
/// Useful for displaying "max rounds" in UI
pub fn max_dives_for_bet(bet_amount: u64) -> u16 {
    let max = max_payout_for_bet(bet_amount);
    let mut dive = 1u16;

    while treasure_for_dive(bet_amount, dive) < max && dive < 200 {
        dive += 1;
    }

    dive
}

#[cfg(test)]
mod tests {
    use super::*;
    use rstest::rstest;

    // ============================================================================
    // Survival Probability Tests
    // ============================================================================

    #[rstest]
    #[case(1, 990_000)] // 99% at dive 1
    #[case(2, 985_000)] // 98.5% at dive 2
    #[case(5, 970_000)] // 97% at dive 5
    #[case(10, 945_000)] // 94.5% at dive 10
    #[case(20, 895_000)] // 89.5% at dive 20
    #[case(50, 745_000)] // 74.5% at dive 50 (corrected)
    #[case(100, 495_000)] // 49.5% at dive 100 (corrected)
    #[case(180, 100_000)] // Floor at 10% (dive 180 hits floor)
    #[case(200, 100_000)] // Floor at 10% (dive 181+)
    #[case(1000, 100_000)] // Still floored
    fn test_survival_probability_specific_dives(#[case] dive: u16, #[case] expected_bps: u32) {
        let prob = survival_probability_bps(dive);
        assert_eq!(
            prob, expected_bps,
            "Dive {} should have {}bps probability",
            dive, expected_bps
        );
    }

    #[test]
    fn test_survival_probability_monotonic_decrease() {
        let mut prev_prob = u32::MAX;

        for dive in 1..=180 {
            let prob = survival_probability_bps(dive);
            assert!(
                prob <= prev_prob,
                "Probability should decrease or stay same (dive {}: {} vs prev {})",
                dive,
                prob,
                prev_prob
            );
            prev_prob = prob;
        }
    }

    #[test]
    fn test_survival_probability_floor_maintained() {
        // After hitting floor, should stay there
        for dive in 181..=1000 {
            let prob = survival_probability_bps(dive);
            assert_eq!(prob, 100_000, "Dive {} should maintain 10% floor", dive);
        }
    }

    #[rstest]
    #[case(0)]
    #[case(1)]
    #[case(u16::MAX)]
    fn test_survival_probability_no_panic(#[case] dive: u16) {
        let _ = survival_probability_bps(dive);
    }

    // ============================================================================
    // Treasure Calculation Tests
    // ============================================================================

    #[rstest]
    #[case(1_000_000, 1, 1_100_000)] // 1.1x at dive 1
    #[case(1_000_000, 2, 1_210_000)] // 1.21x at dive 2 (1.1^2)
    #[case(1_000_000, 5, 1_610_510)] // ~1.61x at dive 5
    #[case(1_000_000, 10, 2_593_742)] // ~2.59x at dive 10
    #[case(10_000_000, 1, 11_000_000)] // Works with larger bets
    #[case(500_000, 3, 665_500)] // Works with smaller bets
    fn test_treasure_for_dive_specific_values(
        #[case] bet: u64,
        #[case] dive: u16,
        #[case] expected: u64,
    ) {
        let treasure = treasure_for_dive(bet, dive);
        // Allow small rounding differences (within 1%)
        let diff = if treasure > expected {
            treasure - expected
        } else {
            expected - treasure
        };
        let tolerance = expected / 100;

        assert!(
            diff <= tolerance,
            "Dive {} with bet {} should give ~{} (got {}, diff {})",
            dive,
            bet,
            expected,
            treasure,
            diff
        );
    }

    #[test]
    fn test_treasure_strictly_increases() {
        let bet = 1_000_000;
        let max = max_payout_for_bet(bet);

        let mut prev_treasure = 0;
        for dive in 0..=100 {
            let treasure = treasure_for_dive(bet, dive);

            if treasure < max {
                assert!(
                    treasure > prev_treasure,
                    "Treasure should increase (dive {}: {} vs prev {})",
                    dive,
                    treasure,
                    prev_treasure
                );
            }

            prev_treasure = treasure;
        }
    }

    #[rstest]
    #[case(1_000_000, 100_000_000)] // 0.001 SOL -> 0.1 SOL
    #[case(10_000_000, 1_000_000_000)] // 0.01 SOL -> 1 SOL
    #[case(100_000_000, 10_000_000_000)] // 0.1 SOL -> 10 SOL
    #[case(1, 100)] // Min bet
    fn test_max_payout_for_bet_values(#[case] bet: u64, #[case] expected: u64) {
        let max = max_payout_for_bet(bet);
        assert_eq!(
            max, expected,
            "Max payout for bet {} should be {}",
            bet, expected
        );
    }

    #[test]
    fn test_max_payout_large_bet() {
        // Test separately for large values that might have rounding
        let huge_bet = u64::MAX / 1000;
        let max = max_payout_for_bet(huge_bet);

        // Should saturate properly
        assert!(max > 0);
        assert!(max <= u64::MAX);
    }

    #[rstest]
    #[case(0, 1_000_000, 1_000_000)] // Dive 0 = bet
    #[case(1, 0, 0)] // Zero bet stays zero
    #[case(5, 0, 0)] // Zero bet stays zero
    fn test_treasure_edge_cases(#[case] dive: u16, #[case] bet: u64, #[case] expected: u64) {
        let treasure = treasure_for_dive(bet, dive);
        assert_eq!(treasure, expected);
    }

    #[rstest]
    #[case(u64::MAX / 1000, 10)]
    #[case(u64::MAX / 100, 5)]
    #[case(1_000_000, u16::MAX)]
    fn test_treasure_no_overflow(#[case] bet: u64, #[case] dive: u16) {
        // Should not panic on large values
        let _ = treasure_for_dive(bet, dive);
    }

    // ============================================================================
    // Max Payout Tests
    // ============================================================================

    #[test]
    fn test_max_payout_saturating() {
        // Should saturate instead of overflow
        let huge_bet = u64::MAX / 99;
        let max = max_payout_for_bet(huge_bet);

        // Should not panic and should be reasonable
        assert!(max > 0);
        assert!(max <= u64::MAX);
    }

    // ============================================================================
    // Max Dives Tests
    // ============================================================================

    #[rstest]
    #[case(1_000_000, 49)] // ~49 dives to reach 100x
    #[case(10_000_000, 49)] // Same ratio regardless of bet size
    #[case(100, 49)] // Tiny bet
    fn test_max_dives_for_bet(#[case] bet: u64, #[case] expected_approx: u16) {
        let max_dive = max_dives_for_bet(bet);

        // Allow ±2 dives tolerance
        assert!(
            (max_dive as i32 - expected_approx as i32).abs() <= 2,
            "Max dives for bet {} should be ~{} (got {})",
            bet,
            expected_approx,
            max_dive
        );

        // Verify the dive actually reaches max payout
        let treasure_at_max = treasure_for_dive(bet, max_dive);
        let max_payout = max_payout_for_bet(bet);
        assert_eq!(treasure_at_max, max_payout);
    }

    // ============================================================================
    // Integration Tests
    // ============================================================================

    #[test]
    fn test_full_game_progression() {
        let bet = 1_000_000;
        let max = max_payout_for_bet(bet);

        let mut treasures = Vec::new();
        let mut probabilities = Vec::new();

        for dive in 1..=50 {
            let treasure = treasure_for_dive(bet, dive);
            let prob = survival_probability_bps(dive);

            treasures.push(treasure);
            probabilities.push(prob);

            // Invariants
            assert!(treasure <= max, "Treasure should never exceed max");
            assert!(prob >= 100_000, "Probability should never be below 10%");
            assert!(prob <= 1_000_000, "Probability should never exceed 100%");
        }

        // Verify progression is sane
        assert_eq!(treasures.len(), 50);
        assert_eq!(probabilities.len(), 50);
    }

    #[test]
    fn test_expected_value_properties() {
        // Test EV properties for the game math
        let bet = 1_000_000u64;

        // Calculate some representative EVs
        let ev1 =
            (treasure_for_dive(bet, 1) as u128 * survival_probability_bps(1) as u128) / 1_000_000;
        let ev10 =
            (treasure_for_dive(bet, 10) as u128 * survival_probability_bps(10) as u128) / 1_000_000;

        // Basic sanity checks
        assert!(ev1 > 0, "EV should be positive");
        assert!(ev10 > 0, "EV should be positive");

        // Game should be generally favorable early on (player excitement)
        assert!(
            ev1 > bet as u128,
            "Early rounds should have positive expected value for player"
        );
    }

    #[test]
    fn test_determinism_across_all_functions() {
        let bet = 5_000_000;

        for dive in 0..=50 {
            // Multiple calls should return same results
            assert_eq!(treasure_for_dive(bet, dive), treasure_for_dive(bet, dive));
            assert_eq!(
                survival_probability_bps(dive),
                survival_probability_bps(dive)
            );
        }

        assert_eq!(max_payout_for_bet(bet), max_payout_for_bet(bet));
        assert_eq!(max_dives_for_bet(bet), max_dives_for_bet(bet));
    }

    // ============================================================================
    // Property-Based Tests (Broad Coverage)
    // ============================================================================

    #[test]
    fn test_survival_probability_always_in_bounds() {
        // Test a wide range of dive numbers
        for dive in 0..=300 {
            let p = survival_probability_bps(dive);
            assert!(
                p >= 100_000 && p <= 1_000_000,
                "Dive {dive} produced out-of-bounds prob {p}"
            );
        }
    }

    #[test]
    fn test_survival_probability_step_is_bounded() {
        const DECAY: u32 = 5_000;

        let mut prev = survival_probability_bps(1);
        for dive in 2..=200 {
            let p = survival_probability_bps(dive);
            // Difference per step should be at most DECAY (or 0 near floor)
            let step = prev.saturating_sub(p);
            assert!(
                step <= DECAY,
                "Dive {dive}: step too large (prev={prev}, curr={p}, step={step})"
            );
            prev = p;
        }
    }

    #[test]
    fn test_treasure_stays_at_cap_after_reaching_max() {
        let bet = 1_000_000;
        let max = max_payout_for_bet(bet);

        let mut reached = false;
        for d in 0..200 {
            let t = treasure_for_dive(bet, d);
            if t == max {
                reached = true;
            }
            if reached {
                assert_eq!(t, max, "Once capped, treasure stays capped (dive {d})");
            }
        }
        assert!(reached, "Curve must reach cap by 200 dives");
    }

    #[test]
    fn test_ev_of_single_round_is_sane() {
        let bet = 1_000_000u64;

        let p = survival_probability_bps(1) as u128;
        let t = treasure_for_dive(bet, 1) as u128;
        let ev = p * t / 1_000_000;

        assert!(ev >= (bet as u128) / 2, "EV should be at least 0.5x bet");
        assert!(ev <= (bet as u128) * 2, "EV should be at most 2x bet");
    }

    #[test]
    fn test_always_continue_strategy_is_house_edge() {
        let bet = 1_000_000u64;
        let max_dive = max_dives_for_bet(bet);
        let max_payout = max_payout_for_bet(bet) as u128;

        // Assume player always continues to max_dive
        // EV = product_over_rounds(p_survive) * max_payout
        let mut prob_survive_all = 1_000_000u128; // start at 1.0 in bps

        for d in 1..=max_dive {
            let p = survival_probability_bps(d) as u128;
            prob_survive_all = prob_survive_all * p / 1_000_000;
        }

        let ev = prob_survive_all * max_payout / 1_000_000;

        assert!(
            ev < bet as u128,
            "Always-continue strategy should be -EV for player (EV={ev}, bet={bet})"
        );
    }

    #[test]
    fn test_treasure_no_panic_on_realistic_bets() {
        // Test realistic SOL amounts (up to 10 SOL) for many dives
        let sol_amounts = [
            100_000,        // 0.0001 SOL
            1_000_000,      // 0.001 SOL
            10_000_000,     // 0.01 SOL
            100_000_000,    // 0.1 SOL
            1_000_000_000,  // 1 SOL
            10_000_000_000, // 10 SOL
        ];

        for bet in sol_amounts {
            for dive in 0..=200 {
                let treasure = treasure_for_dive(bet, dive);
                let max = max_payout_for_bet(bet);

                // Should never exceed max
                assert!(
                    treasure <= max,
                    "Bet {bet}, dive {dive}: treasure {treasure} exceeds max {max}"
                );

                // Should be reasonable
                assert!(treasure > 0 || bet == 0, "Treasure should be positive");
            }
        }
    }
}
