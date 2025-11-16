use anchor_lang::prelude::*;

use crate::errors::GameError;
use crate::events::RoundPlayedEvent;
use crate::states::*;

pub fn play_round(ctx: Context<PlayRound>, new_treasure: u64, new_dive_number: u16) -> Result<()> {
    let session = &mut ctx.accounts.session;
    let clock = Clock::get()?;

    // Verify session is active
    require!(
        session.status == SessionStatus::Active,
        GameError::InvalidSessionStatus
    );

    // Verify round number increments by 1
    require!(
        new_dive_number == session.dive_number + 1,
        GameError::RoundMismatch
    );

    // Verify treasure is monotonically increasing
    require!(
        new_treasure >= session.current_treasure,
        GameError::TreasureInvalid
    );

    // Verify treasure doesn't exceed max payout
    require!(
        new_treasure <= session.max_payout,
        GameError::TreasureInvalid
    );

    // Update session state
    session.current_treasure = new_treasure;
    session.dive_number = new_dive_number;

    emit!(RoundPlayedEvent {
        session: session.key(),
        user: session.user,
        dive_number: session.dive_number,
        current_treasure: session.current_treasure,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct PlayRound<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        has_one = user,
    )]
    pub session: Account<'info, GameSession>,
}
