use crate::errors::GameError;
use crate::events::SessionCashedOutEvent;
use crate::states::*;
use anchor_lang::prelude::*;
pub fn cash_out(ctx: Context<CashOut>) -> Result<()> {
    let session = &mut ctx.accounts.session;
    let house_vault = &mut ctx.accounts.house_vault;
    let clock = Clock::get()?;

    // Use helper method to ensure session is active
    session.ensure_active()?;

    // Phase 2: Update activity tracking before closing
    session.last_active_slot = clock.slot;

    require!(!house_vault.locked, GameError::HouseLocked);
    require!(
        session.current_treasure > session.bet_amount,
        GameError::InsufficientTreasure
    );
    let vault_balance = house_vault.to_account_info().lamports();
    require!(
        vault_balance >= session.current_treasure,
        GameError::InsufficientVaultBalance
    );
    
    // Manual lamport transfer from vault to user
    // Cannot use system_program::transfer() because vault has data
    let vault_lamports = house_vault.to_account_info().lamports();
    let user_lamports = ctx.accounts.user.lamports();
    
    **house_vault.to_account_info().try_borrow_mut_lamports()? = vault_lamports
        .checked_sub(session.current_treasure)
        .ok_or(GameError::Overflow)?;
    
    **ctx.accounts.user.try_borrow_mut_lamports()? = user_lamports
        .checked_add(session.current_treasure)
        .ok_or(GameError::Overflow)?;

    // Use helper methods for fund release and state transition
    house_vault.release(session.max_payout)?;
    session.mark_cashed_out()?;

    emit!(SessionCashedOutEvent {
        session: session.key(),
        user: session.user,
        house_vault: session.house_vault,
        payout_amount: session.current_treasure,
        final_dive_number: session.dive_number,
        timestamp: clock.unix_timestamp,
    });

    // Manually close the session account by transferring its rent to user
    // This avoids the "from must not carry data" error from Anchor's close constraint
    let session_lamports = session.to_account_info().lamports();
    **session.to_account_info().try_borrow_mut_lamports()? = 0;
    **ctx
        .accounts
        .user
        .to_account_info()
        .try_borrow_mut_lamports()? += session_lamports;

    Ok(())
}
#[derive(Accounts)]
pub struct CashOut<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        has_one = user,
        has_one = house_vault,
    )]
    pub session: Account<'info, GameSession>,
    #[account(mut)]
    pub house_vault: Account<'info, HouseVault>,
}
