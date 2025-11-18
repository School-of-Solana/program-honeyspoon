use anchor_lang::prelude::*;
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
    pub total_reserved: u64, 
    pub bump: u8,
}
impl HouseVault {
    pub fn reserve(&mut self, amount: u64) -> Result<()> {
        self.total_reserved = self
            .total_reserved
            .checked_add(amount)
            .ok_or(error!(crate::errors::GameError::Overflow))?;
        Ok(())
    }
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
#[account]
#[derive(InitSpace)]
pub struct GameConfig {
    pub admin: Pubkey,
    pub base_survival_ppm: u32,
    pub decay_per_dive_ppm: u32,
    pub min_survival_ppm: u32,
    pub treasure_multiplier_num: u16,
    pub treasure_multiplier_den: u16,
    pub max_payout_multiplier: u16,
    pub max_dives: u16,
    pub min_bet: u64,
    pub max_bet: u64,
    pub bump: u8,
}
impl GameConfig {
    pub fn default_config() -> (u32, u32, u32, u16, u16, u16, u16, u64, u64) {
        (
            700_000, 
            8_000,   
            50_000,  
            19,      
            10,      
            100,     
            50,      
            100_000_000, 
            10_000_000_000, 
        )
    }
    
    /// Validates all configuration parameters
    /// This is the single source of truth for config validation
    pub fn validate(&self) -> Result<()> {
        // Treasury multiplier validation
        require!(
            self.treasure_multiplier_den > 0,
            crate::errors::GameError::InvalidConfig
        );
        require!(
            self.treasure_multiplier_num > 0,
            crate::errors::GameError::InvalidConfig
        );
        
        // Payout multiplier validation
        require!(
            self.max_payout_multiplier > 0,
            crate::errors::GameError::InvalidConfig
        );
        
        // Survival probability validation (must be <= 100%)
        require!(
            self.base_survival_ppm <= 1_000_000,
            crate::errors::GameError::InvalidConfig
        );
        require!(
            self.min_survival_ppm <= self.base_survival_ppm,
            crate::errors::GameError::InvalidConfig
        );
        
        // Dive limit validation
        require!(
            self.max_dives > 0,
            crate::errors::GameError::InvalidConfig
        );
        
        // Bet range validation (only if max_bet is set)
        if self.max_bet > 0 {
            require!(
                self.min_bet <= self.max_bet,
                crate::errors::GameError::InvalidConfig
            );
        }
        
        Ok(())
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
    pub rng_seed: [u8; 32], 
}

impl GameSession {
    /// Ensures the session is in Active status
    /// Should be called at the start of any instruction that requires active gameplay
    pub fn ensure_active(&self) -> Result<()> {
        require!(
            self.status == SessionStatus::Active,
            crate::errors::GameError::InvalidSessionStatus
        );
        Ok(())
    }
    
    /// Marks the session as Lost and validates the state transition
    pub fn mark_lost(&mut self) -> Result<()> {
        self.ensure_active()?;
        self.status = SessionStatus::Lost;
        Ok(())
    }
    
    /// Marks the session as CashedOut and validates the state transition
    pub fn mark_cashed_out(&mut self) -> Result<()> {
        self.ensure_active()?;
        self.status = SessionStatus::CashedOut;
        Ok(())
    }
}
