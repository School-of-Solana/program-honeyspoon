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
