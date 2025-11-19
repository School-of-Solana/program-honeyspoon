use crate::states::*;
use anchor_lang::prelude::*;

/// Emergency admin function to reset total_reserved when accounting gets out of sync
/// This should only be used when there are NO active sessions
pub fn reset_vault_reserved(ctx: Context<ResetVaultReserved>) -> Result<()> {
    let house_vault = &mut ctx.accounts.house_vault;
    
    msg!(
        "RESET_VAULT_RESERVED old_value={} vault={}",
        house_vault.total_reserved / 1_000_000_000,
        house_vault.key()
    );
    
    house_vault.total_reserved = 0;
    
    msg!("Vault reserved funds reset to 0");
    
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
