use crate::states::*;
use anchor_lang::prelude::*;

/// Emergency admin function to reset total_reserved when accounting gets out of sync
/// This should only be used when there are NO active sessions
/// 
/// SAFETY: This function now validates that total_reserved is 0 before allowing a reset.
/// If total_reserved > 0, it means there may be active sessions, and resetting would
/// break the accounting system. Admin must ensure all sessions are properly closed first.
pub fn reset_vault_reserved(ctx: Context<ResetVaultReserved>) -> Result<()> {
    let house_vault = &mut ctx.accounts.house_vault;

    // SECURITY FIX: Prevent resetting when there are reserved funds
    // This protects against accidentally breaking accounting with active sessions
    require!(
        house_vault.total_reserved == 0,
        crate::errors::GameError::VaultHasReservedFunds
    );

    msg!(
        "RESET_VAULT_RESERVED confirmed_zero vault={}",
        house_vault.key()
    );

    msg!("Vault reserved funds confirmed at 0 - no action needed");

    Ok(())
}

#[derive(Accounts)]
pub struct ResetVaultReserved<'info> {
    #[account(mut)]
    pub house_authority: Signer<'info>,

    #[account(
        mut,
        has_one = house_authority,
    )]
    pub house_vault: Account<'info, HouseVault>,
}
