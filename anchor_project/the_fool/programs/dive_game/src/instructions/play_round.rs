use anchor_lang::prelude::*;

use crate::errors::GameError;
use crate::events::{RoundPlayedEvent, SessionLostEvent};
use crate::game_math;
use crate::rng;
use crate::states::*;

/// Play a round with secure on-chain outcome computation
///
/// This implementation:
/// - Computes outcome from stored RNG seed (user cannot manipulate)
/// - Calculates treasure deterministically based on dive number
/// - Applies probability curve for win/loss determination
///
/// # Security
/// The user can only choose WHEN to play a round, not the OUTCOME.
/// All randomness and treasure calculations happen on-chain.
pub fn play_round(ctx: Context<PlayRound>) -> Result<()> {
    let config = &ctx.accounts.config;
    let session = &mut ctx.accounts.session;
    let house_vault = &mut ctx.accounts.house_vault;
    let clock = Clock::get()?;

    // Verify session is active
    require!(
        session.status == SessionStatus::Active,
        GameError::InvalidSessionStatus
    );

    // Validate dive number is within limits (strict < to prevent off-by-one)
    require!(
        session.dive_number < config.max_dives,
        GameError::MaxDivesReached
    );

    // Generate random roll from stored seed + current dive number
    // rng_seed is now a fixed [u8; 32], no length check needed
    let roll = rng::random_roll_bps(&session.rng_seed, session.dive_number);

    // Get survival probability for current dive from config
    let survival_prob = game_math::survival_probability_bps(config, session.dive_number);

    // Determine outcome
    if roll < survival_prob {
        // SURVIVED: Player continues to next dive
        session.dive_number += 1;

        // Calculate new treasure based on dive number using config
        session.current_treasure =
            game_math::treasure_for_dive(config, session.bet_amount, session.dive_number);

        // Emit round played event
        emit!(RoundPlayedEvent {
            session: session.key(),
            user: session.user,
            dive_number: session.dive_number,
            current_treasure: session.current_treasure,
            timestamp: clock.unix_timestamp,
        });
    } else {
        // LOST: Player loses the session
        session.status = SessionStatus::Lost;

        // Release reserved funds
        require!(
            house_vault.total_reserved >= session.max_payout,
            GameError::Overflow
        );
        house_vault.total_reserved = house_vault
            .total_reserved
            .checked_sub(session.max_payout)
            .ok_or(GameError::Overflow)?;

        // Emit lost event
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

    /// Game configuration account
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
