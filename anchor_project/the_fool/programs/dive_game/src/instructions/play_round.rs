use anchor_lang::prelude::*;
use crate::errors::GameError;
use crate::events::{RoundPlayedEvent, SessionLostEvent};
use crate::game_math;
use crate::rng;
use crate::states::*;
pub fn play_round(ctx: Context<PlayRound>) -> Result<()> {
    let config = &ctx.accounts.config;
    let session = &mut ctx.accounts.session;
    let house_vault = &mut ctx.accounts.house_vault;
    let clock = Clock::get()?;
    
    // Strict lock: house lock blocks all operations except lose_session
    require!(!house_vault.locked, GameError::HouseLocked);
    
    // Use helper method to ensure session is active
    session.ensure_active()?;
    
    require!(
        session.dive_number < config.max_dives,
        GameError::MaxDivesReached
    );
    let roll = rng::random_roll_bps(&session.rng_seed, session.dive_number);
    let survival_prob = game_math::survival_probability_bps(config, session.dive_number);
    if roll < survival_prob {
        session.dive_number += 1;
        session.current_treasure =
            game_math::treasure_for_dive(config, session.bet_amount, session.dive_number);
        emit!(RoundPlayedEvent {
            session: session.key(),
            user: session.user,
            dive_number: session.dive_number,
            current_treasure: session.current_treasure,
            timestamp: clock.unix_timestamp,
        });
    } else {
        // Use helper methods for state transition and fund release
        session.mark_lost()?;
        house_vault.release(session.max_payout)?;
        
        emit!(SessionLostEvent {
            session: session.key(),
            user: session.user,
            house_vault: session.house_vault,
            bet_amount: session.bet_amount,
            final_dive_number: session.dive_number,
            timestamp: clock.unix_timestamp,
        });
    }
    Ok(())
}
#[derive(Accounts)]
pub struct PlayRound<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        seeds = [GAME_CONFIG_SEED.as_bytes()],
        bump = config.bump,
    )]
    pub config: Account<'info, GameConfig>,
    #[account(
        mut,
        has_one = user,
        has_one = house_vault,
    )]
    pub session: Account<'info, GameSession>,
    #[account(mut)]
    pub house_vault: Account<'info, HouseVault>,
}
