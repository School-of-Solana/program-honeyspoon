use crate::states::*;
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct UpdateConfigParams {
    pub base_survival_ppm: Option<u32>,
    pub decay_per_dive_ppm: Option<u32>,
    pub min_survival_ppm: Option<u32>,
    pub treasure_multiplier_num: Option<u16>,
    pub treasure_multiplier_den: Option<u16>,
    pub max_payout_multiplier: Option<u16>,
    pub max_dives: Option<u16>,
    pub fixed_bet: Option<u64>,
}

/// Update existing game configuration
/// Only the admin can call this
pub fn update_config(ctx: Context<UpdateConfig>, params: UpdateConfigParams) -> Result<()> {
    let config = &mut ctx.accounts.config;

    // Update only the fields that are provided
    if let Some(val) = params.base_survival_ppm {
        config.base_survival_ppm = val;
    }
    if let Some(val) = params.decay_per_dive_ppm {
        config.decay_per_dive_ppm = val;
    }
    if let Some(val) = params.min_survival_ppm {
        config.min_survival_ppm = val;
    }
    if let Some(val) = params.treasure_multiplier_num {
        config.treasure_multiplier_num = val;
    }
    if let Some(val) = params.treasure_multiplier_den {
        config.treasure_multiplier_den = val;
    }
    if let Some(val) = params.max_payout_multiplier {
        config.max_payout_multiplier = val;
    }
    if let Some(val) = params.max_dives {
        config.max_dives = val;
    }
    if let Some(val) = params.fixed_bet {
        config.fixed_bet = val;
    }

    // Validate the updated config
    config.validate()?;

    msg!("Game config updated successfully");
    msg!("  Max dives: {}", config.max_dives);
    msg!(
        "  Fixed bet: {} lamports ({} SOL)",
        config.fixed_bet,
        config.fixed_bet / 1_000_000_000
    );

    Ok(())
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        has_one = admin,
        seeds = [GAME_CONFIG_SEED.as_bytes()],
        bump = config.bump,
    )]
    pub config: Account<'info, GameConfig>,
}
