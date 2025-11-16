use anchor_lang::prelude::*;

// PDA seeds
pub const HOUSE_VAULT_SEED: &str = "house_vault";
pub const SESSION_SEED: &str = "session";
pub const GAME_CONFIG_SEED: &str = "game_config";

#[derive(AnchorDeserialize, AnchorSerialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum SessionStatus {
    Active,
    Lost,
    CashedOut,
}

#[account]
#[derive(InitSpace)]
pub struct HouseVault {
    pub house_authority: Pubkey,
    pub locked: bool,
    pub total_reserved: u64, // lamports reserved for active sessions
    pub bump: u8,
}

impl HouseVault {
    /// Reserve funds for a new session
    pub fn reserve(&mut self, amount: u64) -> Result<()> {
        self.total_reserved = self
            .total_reserved
            .checked_add(amount)
            .ok_or(error!(crate::errors::GameError::Overflow))?;
        Ok(())
    }

    /// Release reserved funds when a session ends
    pub fn release(&mut self, amount: u64) -> Result<()> {
        require!(
            self.total_reserved >= amount,
            crate::errors::GameError::Overflow
        );
        self.total_reserved = self
            .total_reserved
            .checked_sub(amount)
            .ok_or(error!(crate::errors::GameError::Overflow))?;
        Ok(())
    }
}

/// Game configuration - single source of truth for all game parameters
/// This account stores the parameters that govern game mechanics.
/// Both on-chain instructions and off-chain clients read from this account.
#[account]
#[derive(InitSpace)]
pub struct GameConfig {
    /// Admin who can update the config
    pub admin: Pubkey,

    // === Probability Parameters ===
    /// Base survival probability at dive 1 (in PPM = parts per million, 1M = 100%)
    /// Default: 990_000 = 99%
    pub base_survival_ppm: u32,

    /// Probability decay per dive (in PPM)
    /// Default: 5_000 = 0.5% decrease per dive
    pub decay_per_dive_ppm: u32,

    /// Minimum survival probability floor (in PPM)
    /// Default: 100_000 = 10%
    pub min_survival_ppm: u32,

    // === Treasure/Payout Parameters ===
    /// Treasure multiplier numerator (default: 11 for 1.1x)
    pub treasure_multiplier_num: u16,

    /// Treasure multiplier denominator (default: 10 for 1.1x)
    pub treasure_multiplier_den: u16,

    /// Max payout multiplier (max_payout = bet * this)
    /// Default: 100 (100x bet)
    pub max_payout_multiplier: u16,

    // === Game Limits ===
    /// Maximum number of dives allowed (safety limit)
    /// Default: 200
    pub max_dives: u16,

    /// Minimum bet amount in lamports
    /// Default: 1 (allow any bet)
    pub min_bet: u64,

    /// Maximum bet amount in lamports (0 = no limit)
    /// Default: 0 (no limit)
    pub max_bet: u64,

    /// PDA bump
    pub bump: u8,
}

impl GameConfig {
    /// Default configuration for production
    pub fn default_config() -> (u32, u32, u32, u16, u16, u16, u16, u64, u64) {
        (
            990_000, // base_survival_ppm: 99% at dive 1
            5_000,   // decay_per_dive_ppm: -0.5% per dive
            100_000, // min_survival_ppm: 10% floor
            11,      // treasure_multiplier_num: 1.1x numerator
            10,      // treasure_multiplier_den: 1.1x denominator
            100,     // max_payout_multiplier: 100x bet
            200,     // max_dives: 200 rounds max
            1,       // min_bet: 1 lamport
            0,       // max_bet: no limit
        )
    }
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
