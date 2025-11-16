use anchor_lang::prelude::*;

use crate::errors::GameError;
use crate::events::SessionLostEvent;
use crate::states::*;

pub fn lose_session(ctx: Context<LoseSession>) -> Result<()> {
    let session = &mut ctx.accounts.session;
    let house_vault = &mut ctx.accounts.house_vault;
    let clock = Clock::get()?;

    // Verify session is active
    require!(
        session.status == SessionStatus::Active,
        GameError::InvalidSessionStatus
    );

    // Release reserved funds using helper method
    house_vault.release(session.max_payout)?;

    // Update session status
    session.status = SessionStatus::Lost;

    emit!(SessionLostEvent {
        session: session.key(),
        user: session.user,
        house_vault: session.house_vault,
        bet_amount: session.bet_amount,
        final_dive_number: session.dive_number,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct LoseSession<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        has_one = user,
        has_one = house_vault,
        close = user,
    )]
    pub session: Account<'info, GameSession>,

    #[account(mut)]
    pub house_vault: Account<'info, HouseVault>,
}
