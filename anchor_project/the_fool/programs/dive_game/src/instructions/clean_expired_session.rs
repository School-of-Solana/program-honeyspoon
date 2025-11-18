use crate::errors::GameError;
use crate::events::SessionCleanedEvent;
use crate::states::*;
use anchor_lang::prelude::*;

/// Timeout duration in slots
/// Approximately 1 hour at 400ms per slot (9000 slots)
pub const TIMEOUT_SLOTS: u64 = 9_000;

/// Cleans up an expired session that was abandoned by the player
///
/// This is a permissionless instruction that:
/// 1. Checks if session has been inactive for TIMEOUT_SLOTS
/// 2. Releases reserved funds back to house vault
/// 3. Closes the session account
/// 4. Sends rent to the caller as incentive
///
/// This prevents capital from being locked forever in abandoned sessions
pub fn clean_expired_session(ctx: Context<CleanExpired>) -> Result<()> {
    let session = &ctx.accounts.session;
    let house_vault = &mut ctx.accounts.house_vault;
    let clock = Clock::get()?;

    // Verify session has expired
    let slots_inactive = clock
        .slot
        .checked_sub(session.last_active_slot)
        .ok_or(GameError::Overflow)?;

    require!(slots_inactive > TIMEOUT_SLOTS, GameError::SessionNotExpired);

    // Only clean Active sessions (Lost/CashedOut already closed)
    require!(
        session.status == SessionStatus::Active,
        GameError::InvalidSessionStatus
    );

    // Release reserved funds
    house_vault.release(session.max_payout)?;

    // Emit cleanup event for monitoring
    emit!(SessionCleanedEvent {
        session: session.key(),
        user: session.user,
        crank: ctx.accounts.crank.key(),
        released_amount: session.max_payout,
        slots_inactive,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct CleanExpired<'info> {
    /// The crank/keeper calling this instruction
    /// Receives the rent as incentive
    #[account(mut)]
    pub crank: Signer<'info>,

    /// The house vault to release funds to
    #[account(mut)]
    pub house_vault: Account<'info, HouseVault>,

    /// The expired session to clean up
    /// Account closes automatically and rent goes to crank
    #[account(
        mut,
        has_one = house_vault,
        close = crank,
    )]
    pub session: Account<'info, GameSession>,
}
