use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::errors::GameError;
use crate::events::SessionCashedOutEvent;
use crate::states::*;
pub fn cash_out(ctx: Context<CashOut>) -> Result<()> {
    let session = &mut ctx.accounts.session;
    let house_vault = &mut ctx.accounts.house_vault;
    let clock = Clock::get()?;
    
    // Use helper method to ensure session is active
    session.ensure_active()?;
    
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
    let house_authority_key = house_vault.house_authority;
    let seeds = &[
        HOUSE_VAULT_SEED.as_bytes(),
        house_authority_key.as_ref(),
        &[house_vault.bump],
    ];
    let signer_seeds = &[&seeds[..]];
    let transfer_ix = system_program::Transfer {
        from: house_vault.to_account_info(),
        to: ctx.accounts.user.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.system_program.to_account_info(),
        transfer_ix,
        signer_seeds,
    );
    system_program::transfer(cpi_ctx, session.current_treasure)?;
    
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
    pub system_program: Program<'info, System>,
}
