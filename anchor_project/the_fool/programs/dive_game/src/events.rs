use anchor_lang::prelude::*;
#[event]
pub struct InitializeHouseVaultEvent {
    pub house_vault: Pubkey,
    pub house_authority: Pubkey,
    pub locked: bool,
    pub timestamp: i64,
}
#[event]
pub struct SessionStartedEvent {
    pub session: Pubkey,
    pub user: Pubkey,
    pub house_vault: Pubkey,
    pub bet_amount: u64,
    pub max_payout: u64,
    pub timestamp: i64,
}
#[event]
pub struct RoundPlayedEvent {
    pub session: Pubkey,
    pub user: Pubkey,
    pub dive_number: u16,
    pub current_treasure: u64,
    pub timestamp: i64,
}
#[event]
pub struct SessionLostEvent {
    pub session: Pubkey,
    pub user: Pubkey,
    pub house_vault: Pubkey,
    pub bet_amount: u64,
    pub final_dive_number: u16,
    pub timestamp: i64,
}
#[event]
pub struct SessionCashedOutEvent {
    pub session: Pubkey,
    pub user: Pubkey,
    pub house_vault: Pubkey,
    pub payout_amount: u64,
    pub final_dive_number: u16,
    pub timestamp: i64,
}
#[event]
pub struct ToggleHouseLockEvent {
    pub house_vault: Pubkey,
    pub house_authority: Pubkey,
    pub locked: bool,
    pub timestamp: i64,
}
