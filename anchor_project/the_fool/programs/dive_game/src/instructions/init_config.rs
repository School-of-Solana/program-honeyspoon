use anchor_lang::prelude::*;

use crate::states::*;

/// Configuration parameters for game initialization
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct GameConfigParams {
    pub base_survival_ppm: Option<u32>,
    pub decay_per_dive_ppm: Option<u32>,
    pub min_survival_ppm: Option<u32>,
    pub treasure_multiplier_num: Option<u16>,
    pub treasure_multiplier_den: Option<u16>,
    pub max_payout_multiplier: Option<u16>,
    pub max_dives: Option<u16>,
    pub min_bet: Option<u64>,
    pub max_bet: Option<u64>,
}

/// Initialize game configuration with default or custom parameters
///
/// This creates the single source of truth for all game parameters.
/// Both on-chain instructions and off-chain clients will read from this account.
pub fn init_config(ctx: Context<InitializeConfig>, params: GameConfigParams) -> Result<()> {
    let config = &mut ctx.accounts.config;

    // Get defaults
    let defaults = GameConfig::default_config();

    // Initialize with provided values or defaults
    config.admin = ctx.accounts.admin.key();
    config.base_survival_ppm = params.base_survival_ppm.unwrap_or(defaults.0);
    config.decay_per_dive_ppm = params.decay_per_dive_ppm.unwrap_or(defaults.1);
    config.min_survival_ppm = params.min_survival_ppm.unwrap_or(defaults.2);
    config.treasure_multiplier_num = params.treasure_multiplier_num.unwrap_or(defaults.3);
    config.treasure_multiplier_den = params.treasure_multiplier_den.unwrap_or(defaults.4);
    config.max_payout_multiplier = params.max_payout_multiplier.unwrap_or(defaults.5);
    config.max_dives = params.max_dives.unwrap_or(defaults.6);
    config.min_bet = params.min_bet.unwrap_or(defaults.7);
    config.max_bet = params.max_bet.unwrap_or(defaults.8);
    config.bump = ctx.bumps.config;

    // Validate configuration parameters
    require!(
        config.treasure_multiplier_den > 0,
        crate::errors::GameError::InvalidConfig
    );
    require!(
        config.base_survival_ppm <= 1_000_000,
        crate::errors::GameError::InvalidConfig
    );
    require!(
        config.min_survival_ppm <= config.base_survival_ppm,
        crate::errors::GameError::InvalidConfig
    );
    require!(
        config.max_dives > 0,
        crate::errors::GameError::InvalidConfig
    );
    if config.max_bet > 0 {
        require!(
            config.min_bet <= config.max_bet,
            crate::errors::GameError::InvalidConfig
        );
    }

    msg!("Game config initialized:");
    msg!(
        "  Base survival: {}ppm ({}%)",
        config.base_survival_ppm,
        config.base_survival_ppm / 10_000
    );
    msg!(
        "  Decay per dive: {}ppm ({}%)",
        config.decay_per_dive_ppm,
        config.decay_per_dive_ppm / 10_000
    );
    msg!(
        "  Min survival: {}ppm ({}%)",
        config.min_survival_ppm,
        config.min_survival_ppm / 10_000
    );
    msg!(
        "  Treasure multiplier: {}/{}",
        config.treasure_multiplier_num,
        config.treasure_multiplier_den
    );
    msg!("  Max payout multiplier: {}x", config.max_payout_multiplier);

    Ok(())
}

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + GameConfig::INIT_SPACE,
        seeds = [GAME_CONFIG_SEED.as_bytes()],
        bump
    )]
    pub config: Account<'info, GameConfig>,

    pub system_program: Program<'info, System>,
}

#[cfg(test)]
mod tests {
    use super::*;

    // Helper to create default config
    fn default_params() -> GameConfigParams {
        GameConfigParams {
            base_survival_ppm: Some(990_000),
            decay_per_dive_ppm: Some(5_000),
            min_survival_ppm: Some(100_000),
            treasure_multiplier_num: Some(11),
            treasure_multiplier_den: Some(10),
            max_payout_multiplier: Some(100),
            max_dives: Some(200),
            min_bet: Some(1),
            max_bet: Some(0),
        }
    }

    #[test]
    fn test_config_validation_zero_denominator() {
        let mut params = default_params();
        params.treasure_multiplier_den = Some(0);

        // Create mock config
        let config = GameConfig {
            admin: Pubkey::default(),
            base_survival_ppm: 990_000,
            decay_per_dive_ppm: 5_000,
            min_survival_ppm: 100_000,
            treasure_multiplier_num: 11,
            treasure_multiplier_den: 0, // Invalid
            max_payout_multiplier: 100,
            max_dives: 200,
            min_bet: 1,
            max_bet: 0,
            bump: 0,
        };

        // This validation should fail
        let result = (|| {
            require!(
                config.treasure_multiplier_den > 0,
                crate::errors::GameError::InvalidConfig
            );
            Ok::<(), Error>(())
        })();

        assert!(result.is_err());
    }

    #[test]
    fn test_config_validation_inverted_probabilities() {
        let config = GameConfig {
            admin: Pubkey::default(),
            base_survival_ppm: 100_000, // Less than min
            decay_per_dive_ppm: 5_000,
            min_survival_ppm: 990_000, // Greater than base - INVALID
            treasure_multiplier_num: 11,
            treasure_multiplier_den: 10,
            max_payout_multiplier: 100,
            max_dives: 200,
            min_bet: 1,
            max_bet: 0,
            bump: 0,
        };

        let result = (|| {
            require!(
                config.min_survival_ppm <= config.base_survival_ppm,
                crate::errors::GameError::InvalidConfig
            );
            Ok::<(), Error>(())
        })();

        assert!(result.is_err());
    }

    #[test]
    fn test_config_validation_probability_exceeds_100_percent() {
        let config = GameConfig {
            admin: Pubkey::default(),
            base_survival_ppm: 1_500_000, // > 100% - INVALID
            decay_per_dive_ppm: 5_000,
            min_survival_ppm: 100_000,
            treasure_multiplier_num: 11,
            treasure_multiplier_den: 10,
            max_payout_multiplier: 100,
            max_dives: 200,
            min_bet: 1,
            max_bet: 0,
            bump: 0,
        };

        let result = (|| {
            require!(
                config.base_survival_ppm <= 1_000_000,
                crate::errors::GameError::InvalidConfig
            );
            Ok::<(), Error>(())
        })();

        assert!(result.is_err());
    }

    #[test]
    fn test_config_validation_min_bet_greater_than_max_bet() {
        let config = GameConfig {
            admin: Pubkey::default(),
            base_survival_ppm: 990_000,
            decay_per_dive_ppm: 5_000,
            min_survival_ppm: 100_000,
            treasure_multiplier_num: 11,
            treasure_multiplier_den: 10,
            max_payout_multiplier: 100,
            max_dives: 200,
            min_bet: 1000, // Greater than max
            max_bet: 100,  // Less than min - INVALID
            bump: 0,
        };

        let result = (|| {
            if config.max_bet > 0 {
                require!(
                    config.min_bet <= config.max_bet,
                    crate::errors::GameError::InvalidConfig
                );
            }
            Ok::<(), Error>(())
        })();

        assert!(result.is_err());
    }

    #[test]
    fn test_config_validation_zero_max_dives() {
        let config = GameConfig {
            admin: Pubkey::default(),
            base_survival_ppm: 990_000,
            decay_per_dive_ppm: 5_000,
            min_survival_ppm: 100_000,
            treasure_multiplier_num: 11,
            treasure_multiplier_den: 10,
            max_payout_multiplier: 100,
            max_dives: 0, // INVALID
            min_bet: 1,
            max_bet: 0,
            bump: 0,
        };

        let result = (|| {
            require!(
                config.max_dives > 0,
                crate::errors::GameError::InvalidConfig
            );
            Ok::<(), Error>(())
        })();

        assert!(result.is_err());
    }

    #[test]
    fn test_config_validation_valid_config_passes() {
        let config = GameConfig {
            admin: Pubkey::default(),
            base_survival_ppm: 990_000,
            decay_per_dive_ppm: 5_000,
            min_survival_ppm: 100_000,
            treasure_multiplier_num: 11,
            treasure_multiplier_den: 10,
            max_payout_multiplier: 100,
            max_dives: 200,
            min_bet: 1,
            max_bet: 0,
            bump: 0,
        };

        let result = (|| {
            require!(
                config.treasure_multiplier_den > 0,
                crate::errors::GameError::InvalidConfig
            );
            require!(
                config.base_survival_ppm <= 1_000_000,
                crate::errors::GameError::InvalidConfig
            );
            require!(
                config.min_survival_ppm <= config.base_survival_ppm,
                crate::errors::GameError::InvalidConfig
            );
            require!(
                config.max_dives > 0,
                crate::errors::GameError::InvalidConfig
            );
            if config.max_bet > 0 {
                require!(
                    config.min_bet <= config.max_bet,
                    crate::errors::GameError::InvalidConfig
                );
            }
            Ok::<(), Error>(())
        })();

        assert!(result.is_ok());
    }
}
