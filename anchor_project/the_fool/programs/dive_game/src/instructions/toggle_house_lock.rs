use anchor_lang::prelude::*;
use crate::events::ToggleHouseLockEvent;
use crate::states::*;
pub fn toggle_house_lock(ctx: Context<ToggleHouseLock>) -> Result<()> {
    let house_vault = &mut ctx.accounts.house_vault;
    let clock = Clock::get()?;
    house_vault.locked = !house_vault.locked;
    emit!(ToggleHouseLockEvent {
        house_vault: house_vault.key(),
        house_authority: house_vault.house_authority,
        locked: house_vault.locked,
        timestamp: clock.unix_timestamp,
    });
    Ok(())
}
#[derive(Accounts)]
pub struct ToggleHouseLock<'info> {
    #[account(mut)]
    pub house_authority: Signer<'info>,
    #[account(
        mut,
        has_one = house_authority,
    )]
    pub house_vault: Account<'info, HouseVault>,
}
