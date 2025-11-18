use crate::events::InitializeHouseVaultEvent;
use crate::states::*;
use anchor_lang::prelude::*;
pub fn init_house_vault(ctx: Context<InitializeHouseVault>, locked: bool) -> Result<()> {
    let house_vault = &mut ctx.accounts.house_vault;
    let clock = Clock::get()?;
    house_vault.house_authority = ctx.accounts.house_authority.key();
    house_vault.locked = locked;
    house_vault.total_reserved = 0;
    house_vault.bump = ctx.bumps.house_vault;
    emit!(InitializeHouseVaultEvent {
        house_vault: house_vault.key(),
        house_authority: house_vault.house_authority,
        locked: house_vault.locked,
        timestamp: clock.unix_timestamp,
    });
    Ok(())
}
#[derive(Accounts)]
pub struct InitializeHouseVault<'info> {
    #[account(mut)]
    pub house_authority: Signer<'info>,
    #[account(
        init,
        payer = house_authority,
        space = 8 + HouseVault::INIT_SPACE,
        seeds = [HOUSE_VAULT_SEED.as_bytes(), house_authority.key().as_ref()],
        bump
    )]
    pub house_vault: Account<'info, HouseVault>,
    pub system_program: Program<'info, System>,
}
