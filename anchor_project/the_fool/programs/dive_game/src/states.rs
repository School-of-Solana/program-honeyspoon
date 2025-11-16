use anchor_lang::prelude::*;

// PDA seeds
pub const HOUSE_VAULT_SEED: &str = "house_vault";
pub const SESSION_SEED: &str = "session";

#[derive(AnchorDeserialize, AnchorSerialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum SessionStatus {
    Active,
    Lost,
    CashedOut,
    Expired,
}

#[account]
#[derive(InitSpace)]
pub struct HouseVault {
    pub house_authority: Pubkey,
    pub locked: bool,
    pub total_reserved: u64, // lamports reserved for active sessions
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct GameSession {
    pub user: Pubkey,
    pub house_vault: Pubkey,
    pub status: SessionStatus,
    pub bet_amount: u64,
    pub current_treasure: u64,
    pub max_payout: u64,
    pub dive_number: u16,
    pub bump: u8,
    pub rng_seed: [u8; 32], // Fixed 32-byte randomness seed for deterministic outcomes
}
