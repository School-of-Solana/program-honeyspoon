use crate::errors::GameError;
use crate::states::*;
use anchor_lang::prelude::*;

/// Allows the house authority to withdraw profits from the house vault
/// Ensures solvency by only allowing withdrawal of unreserved funds
pub fn withdraw_house(ctx: Context<WithdrawHouse>, amount: u64) -> Result<()> {
    let house_vault = &mut ctx.accounts.house_vault;
    let vault_account = house_vault.to_account_info();

    let current_balance = vault_account.lamports();

    // Calculate solvency
    // available = balance - reserved - rent_exempt_minimum
    // SECURITY FIX: Use dynamic rent calculation instead of hardcoded value
    // This ensures rent exemption stays accurate as Solana rent costs change
    let rent = Rent::get()?;
    let rent_exempt = rent.minimum_balance(vault_account.data_len());
    let required = house_vault.total_reserved.saturating_add(rent_exempt);

    let available = current_balance.saturating_sub(required);

    require!(amount <= available, GameError::InsufficientVaultBalance);

    // Transfer lamports from vault to house authority
    **vault_account.try_borrow_mut_lamports()? -= amount;
    **ctx.accounts.house_authority.try_borrow_mut_lamports()? += amount;

    msg!("House withdrawal: {} lamports", amount);
    msg!(
        "Vault balance after withdrawal: {}",
        vault_account.lamports()
    );
    msg!("Reserved funds: {}", house_vault.total_reserved);

    Ok(())
}

#[derive(Accounts)]
pub struct WithdrawHouse<'info> {
    #[account(mut)]
    pub house_authority: Signer<'info>,

    #[account(
        mut,
        has_one = house_authority,
        seeds = [HOUSE_VAULT_SEED.as_bytes(), house_authority.key().as_ref()],
        bump = house_vault.bump
    )]
    pub house_vault: Account<'info, HouseVault>,
}
