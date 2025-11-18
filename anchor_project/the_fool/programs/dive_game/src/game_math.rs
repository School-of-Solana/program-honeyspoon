use crate::states::GameConfig;
pub fn survival_probability_bps(config: &GameConfig, dive_number: u16) -> u32 {
    let reduction =
        (dive_number.saturating_sub(1) as u32).saturating_mul(config.decay_per_dive_ppm);
    config
        .base_survival_ppm
        .saturating_sub(reduction)
        .max(config.min_survival_ppm)
}
pub fn treasure_for_dive(config: &GameConfig, bet_amount: u64, dive_number: u16) -> u64 {
    if dive_number == 0 {
        return bet_amount;
    }
    let scale = config.treasure_multiplier_den as u128;
    let mult = config.treasure_multiplier_num as u128;
    let max = max_payout_for_bet(config, bet_amount);
    let mut result = bet_amount as u128;
    for _ in 0..dive_number {
        result = result
            .checked_mul(mult)
            .and_then(|v| v.checked_div(scale))
            .unwrap_or(max as u128);
        if result >= max as u128 {
            return max;
        }
    }
    result.min(max as u128) as u64
}
pub fn max_payout_for_bet(config: &GameConfig, bet_amount: u64) -> u64 {
    bet_amount.saturating_mul(config.max_payout_multiplier as u64)
}
pub fn max_dives_for_bet(config: &GameConfig, bet_amount: u64) -> u16 {
    let max = max_payout_for_bet(config, bet_amount);
    let mut dive = 1u16;
    while treasure_for_dive(config, bet_amount, dive) < max && dive < config.max_dives {
        dive += 1;
    }
    dive
}
#[cfg(test)]
mod tests {
    use super::*;
    use anchor_lang::prelude::Pubkey;
    use rstest::rstest;
    fn test_config() -> GameConfig {
        let (base, decay, min, num, den, max_mult, max_dives, min_bet, max_bet) =
            GameConfig::default_config();
        GameConfig {
            admin: Pubkey::default(),
            base_survival_ppm: base,
            decay_per_dive_ppm: decay,
            min_survival_ppm: min,
            treasure_multiplier_num: num,
            treasure_multiplier_den: den,
            max_payout_multiplier: max_mult,
            max_dives,
            min_bet,
            max_bet,
            bump: 0,
        }
    }
    #[rstest]
    #[case(1, 990_000)] 
    #[case(2, 985_000)] 
    #[case(5, 970_000)] 
    #[case(10, 945_000)] 
    #[case(20, 895_000)] 
    #[case(50, 745_000)] 
    #[case(100, 495_000)] 
    #[case(180, 100_000)] 
    #[case(200, 100_000)] 
    #[case(1000, 100_000)] 
    fn test_survival_probability_specific_dives(#[case] dive: u16, #[case] expected_bps: u32) {
        let config = test_config();
        let prob = survival_probability_bps(&config, dive);
        assert_eq!(
            prob, expected_bps,
            "Dive {} should have {}bps probability",
            dive, expected_bps
        );
    }
    #[test]
    fn test_survival_probability_monotonic_decrease() {
        let config = test_config();
        let mut prev_prob = u32::MAX;
        for dive in 1..=180 {
            let prob = survival_probability_bps(&config, dive);
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
        let config = test_config();
        for dive in 181..=1000 {
            let prob = survival_probability_bps(&config, dive);
            assert_eq!(prob, 100_000, "Dive {} should maintain 10% floor", dive);
        }
    }
    #[rstest]
    #[case(0)]
    #[case(1)]
    #[case(u16::MAX)]
    fn test_survival_probability_no_panic(#[case] dive: u16) {
        let config = test_config();
        let _ = survival_probability_bps(&config, dive);
    }
    #[rstest]
    #[case(1_000_000, 1, 1_100_000)] 
    #[case(1_000_000, 2, 1_210_000)] 
    #[case(1_000_000, 5, 1_610_510)] 
    #[case(1_000_000, 10, 2_593_742)] 
    #[case(10_000_000, 1, 11_000_000)] 
    #[case(500_000, 3, 665_500)] 
    fn test_treasure_for_dive_specific_values(
        #[case] bet: u64,
        #[case] dive: u16,
        #[case] expected: u64,
    ) {
        let config = test_config();
        let treasure = treasure_for_dive(&config, bet, dive);
        let diff = treasure.abs_diff(expected);
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
        let config = test_config();
        let bet = 1_000_000;
        let max = max_payout_for_bet(&config, bet);
        let mut prev_treasure = 0;
        for dive in 0..=100 {
            let treasure = treasure_for_dive(&config, bet, dive);
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
    #[case(1_000_000, 100_000_000)] 
    #[case(10_000_000, 1_000_000_000)] 
    #[case(100_000_000, 10_000_000_000)] 
    #[case(1, 100)] 
    fn test_max_payout_for_bet_values(#[case] bet: u64, #[case] expected: u64) {
        let config = test_config();
        let max = max_payout_for_bet(&config, bet);
        assert_eq!(
            max, expected,
            "Max payout for bet {} should be {}",
            bet, expected
        );
    }
    #[test]
    fn test_max_payout_large_bet() {
        let config = test_config();
        let huge_bet = u64::MAX / 1000;
        let max = max_payout_for_bet(&config, huge_bet);
        assert!(max > 0);
    }
    #[rstest]
    #[case(0, 1_000_000, 1_000_000)] 
    #[case(1, 0, 0)] 
    #[case(5, 0, 0)] 
    fn test_treasure_edge_cases(#[case] dive: u16, #[case] bet: u64, #[case] expected: u64) {
        let config = test_config();
        let treasure = treasure_for_dive(&config, bet, dive);
        assert_eq!(treasure, expected);
    }
    #[rstest]
    #[case(u64::MAX / 1000, 10)]
    #[case(u64::MAX / 100, 5)]
    #[case(1_000_000, u16::MAX)]
    fn test_treasure_no_overflow(#[case] bet: u64, #[case] dive: u16) {
        let config = test_config();
        let _ = treasure_for_dive(&config, bet, dive);
    }
    #[test]
    fn test_max_payout_saturating() {
        let config = test_config();
        let huge_bet = u64::MAX / 99;
        let max = max_payout_for_bet(&config, huge_bet);
        assert!(max > 0);
    }
    #[rstest]
    #[case(1_000_000, 49)] 
    #[case(10_000_000, 49)] 
    #[case(100, 49)] 
    fn test_max_dives_for_bet(#[case] bet: u64, #[case] expected_approx: u16) {
        let config = test_config();
        let max_dive = max_dives_for_bet(&config, bet);
        assert!(
            (max_dive as i32 - expected_approx as i32).abs() <= 2,
            "Max dives for bet {} should be ~{} (got {})",
            bet,
            expected_approx,
            max_dive
        );
        let treasure_at_max = treasure_for_dive(&config, bet, max_dive);
        let max_payout = max_payout_for_bet(&config, bet);
        assert_eq!(treasure_at_max, max_payout);
    }
    #[test]
    fn test_full_game_progression() {
        let config = test_config();
        let bet = 1_000_000;
        let max = max_payout_for_bet(&config, bet);
        let mut treasures = Vec::new();
        let mut probabilities = Vec::new();
        for dive in 1..=50 {
            let treasure = treasure_for_dive(&config, bet, dive);
            let prob = survival_probability_bps(&config, dive);
            treasures.push(treasure);
            probabilities.push(prob);
            assert!(treasure <= max, "Treasure should never exceed max");
            assert!(prob >= 100_000, "Probability should never be below 10%");
            assert!(prob <= 1_000_000, "Probability should never exceed 100%");
        }
        assert_eq!(treasures.len(), 50);
        assert_eq!(probabilities.len(), 50);
    }
    #[test]
    fn test_expected_value_properties() {
        let config = test_config();
        let bet = 1_000_000u64;
        let ev1 = (treasure_for_dive(&config, bet, 1) as u128
            * survival_probability_bps(&config, 1) as u128)
            / 1_000_000;
        let ev10 = (treasure_for_dive(&config, bet, 10) as u128
            * survival_probability_bps(&config, 10) as u128)
            / 1_000_000;
        assert!(ev1 > 0, "EV should be positive");
        assert!(ev10 > 0, "EV should be positive");
        assert!(
            ev1 > bet as u128,
            "Early rounds should have positive expected value for player"
        );
    }
    #[test]
    fn test_determinism_across_all_functions() {
        let config = test_config();
        let bet = 5_000_000;
        for dive in 0..=50 {
            assert_eq!(
                treasure_for_dive(&config, bet, dive),
                treasure_for_dive(&config, bet, dive)
            );
            assert_eq!(
                survival_probability_bps(&config, dive),
                survival_probability_bps(&config, dive)
            );
        }
        assert_eq!(
            max_payout_for_bet(&config, bet),
            max_payout_for_bet(&config, bet)
        );
        assert_eq!(
            max_dives_for_bet(&config, bet),
            max_dives_for_bet(&config, bet)
        );
    }
    #[test]
    fn test_survival_probability_always_in_bounds() {
        let config = test_config();
        for dive in 0..=300 {
            let p = survival_probability_bps(&config, dive);
            assert!(
                (100_000..=1_000_000).contains(&p),
                "Dive {dive} produced out-of-bounds prob {p}"
            );
        }
    }
    #[test]
    fn test_survival_probability_step_is_bounded() {
        let config = test_config();
        const DECAY: u32 = 5_000;
        let mut prev = survival_probability_bps(&config, 1);
        for dive in 2..=200 {
            let p = survival_probability_bps(&config, dive);
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
        let config = test_config();
        let bet = 1_000_000;
        let max = max_payout_for_bet(&config, bet);
        let mut reached = false;
        for d in 0..200 {
            let t = treasure_for_dive(&config, bet, d);
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
        let config = test_config();
        let bet = 1_000_000u64;
        let p = survival_probability_bps(&config, 1) as u128;
        let t = treasure_for_dive(&config, bet, 1) as u128;
        let ev = p * t / 1_000_000;
        assert!(ev >= (bet as u128) / 2, "EV should be at least 0.5x bet");
        assert!(ev <= (bet as u128) * 2, "EV should be at most 2x bet");
    }
    #[test]
    fn test_always_continue_strategy_is_house_edge() {
        let config = test_config();
        let bet = 1_000_000u64;
        let max_dive = max_dives_for_bet(&config, bet);
        let max_payout = max_payout_for_bet(&config, bet) as u128;
        let mut prob_survive_all = 1_000_000u128; 
        for d in 1..=max_dive {
            let p = survival_probability_bps(&config, d) as u128;
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
        let config = test_config();
        let sol_amounts = [
            100_000,        
            1_000_000,      
            10_000_000,     
            100_000_000,    
            1_000_000_000,  
            10_000_000_000, 
        ];
        for bet in sol_amounts {
            for dive in 0..=200 {
                let treasure = treasure_for_dive(&config, bet, dive);
                let max = max_payout_for_bet(&config, bet);
                assert!(
                    treasure <= max,
                    "Bet {bet}, dive {dive}: treasure {treasure} exceeds max {max}"
                );
                assert!(treasure > 0 || bet == 0, "Treasure should be positive");
            }
        }
    }
}
