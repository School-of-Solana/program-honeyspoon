use anchor_lang::prelude::*;

use crate::errors::GameError;
use crate::events::SessionCashedOutEvent;
use crate::states::*;

pub fn cash_out(ctx: Context<CashOut>) -> Result<()> {
    let session = &mut ctx.accounts.session;
    let house_vault = &mut ctx.accounts.house_vault;
    let clock = Clock::get()?;

    // Verify session is active
    require!(
        session.status == SessionStatus::Active,
        GameError::InvalidSessionStatus
    );

    // Verify house not locked
    require!(!house_vault.locked, GameError::HouseLocked);

    // Verify profitable cash out
    require!(
        session.current_treasure > session.bet_amount,
        GameError::InsufficientTreasure
    );

    // Check vault has enough balance
    let vault_balance = house_vault.to_account_info().lamports();
    require!(
        vault_balance >= session.current_treasure,
        GameError::InsufficientVaultBalance
    );

    // Transfer payout from house vault to user
    **house_vault.to_account_info().try_borrow_mut_lamports()? -= session.current_treasure;
    **ctx
        .accounts
        .user
        .to_account_info()
        .try_borrow_mut_lamports()? += session.current_treasure;

    // Release reserved funds with safety check
    require!(
        house_vault.total_reserved >= session.max_payout,
        GameError::Overflow
    );
    house_vault.total_reserved = house_vault
        .total_reserved
        .checked_sub(session.max_payout)
        .ok_or(GameError::Overflow)?;

    // Update session status
    session.status = SessionStatus::CashedOut;

    emit!(SessionCashedOutEvent {
        session: session.key(),
        user: session.user,
        house_vault: session.house_vault,
        payout_amount: session.current_treasure,
        final_dive_number: session.dive_number,
        timestamp: clock.unix_timestamp,
    });

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
        close = user,
    )]
    pub session: Account<'info, GameSession>,

    #[account(mut)]
    pub house_vault: Account<'info, HouseVault>,
}
