use anchor_lang::prelude::*;

use crate::states::*;

/// Initialize game configuration with default or custom parameters
///
/// This creates the single source of truth for all game parameters.
/// Both on-chain instructions and off-chain clients will read from this account.
pub fn init_config(
    ctx: Context<InitializeConfig>,
    base_survival_ppm: Option<u32>,
    decay_per_dive_ppm: Option<u32>,
    min_survival_ppm: Option<u32>,
    treasure_multiplier_num: Option<u16>,
    treasure_multiplier_den: Option<u16>,
    max_payout_multiplier: Option<u16>,
    max_dives: Option<u16>,
    min_bet: Option<u64>,
    max_bet: Option<u64>,
) -> Result<()> {
    let config = &mut ctx.accounts.config;

    // Get defaults
    let defaults = GameConfig::default_config();

    // Initialize with provided values or defaults
    config.admin = ctx.accounts.admin.key();
    config.base_survival_ppm = base_survival_ppm.unwrap_or(defaults.0);
    config.decay_per_dive_ppm = decay_per_dive_ppm.unwrap_or(defaults.1);
    config.min_survival_ppm = min_survival_ppm.unwrap_or(defaults.2);
    config.treasure_multiplier_num = treasure_multiplier_num.unwrap_or(defaults.3);
    config.treasure_multiplier_den = treasure_multiplier_den.unwrap_or(defaults.4);
    config.max_payout_multiplier = max_payout_multiplier.unwrap_or(defaults.5);
    config.max_dives = max_dives.unwrap_or(defaults.6);
    config.min_bet = min_bet.unwrap_or(defaults.7);
    config.max_bet = max_bet.unwrap_or(defaults.8);
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
