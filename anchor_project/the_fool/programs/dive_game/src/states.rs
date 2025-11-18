use anchor_lang::prelude::*;
pub const HOUSE_VAULT_SEED: &str = "house_vault";
pub const SESSION_SEED: &str = "session";
pub const GAME_CONFIG_SEED: &str = "game_config";
#[derive(AnchorDeserialize, AnchorSerialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
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
        require!(self.max_dives > 0, crate::errors::GameError::InvalidConfig);

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
    // NOTE: rng_seed removed in Phase 1 RNG security enhancement
    // We now use SlotHashes sysvar for per-round entropy instead
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
#[cfg(test)]
mod tests {
    use super::*;

    fn test_config() -> GameConfig {
        let (base, decay, min, num, den, max_mult, max_dives, min_bet, max_bet) =
            GameConfig::default_config();
        GameConfig {
            admin: Pubkey::default(),
            base_survival_ppm: base,
            decay_per_dive_ppm: decay,
            min_survival_ppm: min,
            treasure_multiplier_num: num,
            treasure_multiplier_den: den,
            max_payout_multiplier: max_mult,
            max_dives,
            min_bet,
            max_bet,
            bump: 0,
        }
    }

    fn test_session() -> GameSession {
        GameSession {
            user: Pubkey::default(),
            house_vault: Pubkey::default(),
            status: SessionStatus::Active,
            bet_amount: 1_000_000,
            current_treasure: 1_000_000,
            max_payout: 100_000_000,
            dive_number: 1,
            bump: 0,
        }
    }

    fn test_vault() -> HouseVault {
        HouseVault {
            house_authority: Pubkey::default(),
            total_reserved: 0,
            locked: false,
            bump: 0,
        }
    }

    // GameConfig::validate() tests
    #[test]
    fn test_validate_valid_config() {
        let config = test_config();
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_validate_zero_treasure_denominator() {
        let mut config = test_config();
        config.treasure_multiplier_den = 0;
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_validate_zero_treasure_numerator() {
        let mut config = test_config();
        config.treasure_multiplier_num = 0;
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_validate_zero_max_payout_multiplier() {
        let mut config = test_config();
        config.max_payout_multiplier = 0;
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_validate_base_survival_exceeds_100_percent() {
        let mut config = test_config();
        config.base_survival_ppm = 1_000_001;
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_validate_min_survival_exceeds_base() {
        let mut config = test_config();
        config.min_survival_ppm = config.base_survival_ppm + 1;
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_validate_zero_max_dives() {
        let mut config = test_config();
        config.max_dives = 0;
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_validate_min_bet_exceeds_max_bet() {
        let mut config = test_config();
        config.max_bet = 100;
        config.min_bet = 200;
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_validate_max_bet_zero_is_valid() {
        let mut config = test_config();
        config.max_bet = 0;
        config.min_bet = 1000;
        assert!(config.validate().is_ok());
    }

    // GameSession tests
    #[test]
    fn test_ensure_active_when_active() {
        let session = test_session();
        assert!(session.ensure_active().is_ok());
    }

    #[test]
    fn test_ensure_active_when_lost() {
        let mut session = test_session();
        session.status = SessionStatus::Lost;
        assert!(session.ensure_active().is_err());
    }

    #[test]
    fn test_ensure_active_when_cashed_out() {
        let mut session = test_session();
        session.status = SessionStatus::CashedOut;
        assert!(session.ensure_active().is_err());
    }

    #[test]
    fn test_mark_lost_when_active() {
        let mut session = test_session();
        assert!(session.mark_lost().is_ok());
        assert_eq!(session.status, SessionStatus::Lost);
    }

    #[test]
    fn test_mark_lost_when_already_lost() {
        let mut session = test_session();
        session.status = SessionStatus::Lost;
        assert!(session.mark_lost().is_err());
    }

    #[test]
    fn test_mark_lost_when_cashed_out() {
        let mut session = test_session();
        session.status = SessionStatus::CashedOut;
        assert!(session.mark_lost().is_err());
    }

    #[test]
    fn test_mark_cashed_out_when_active() {
        let mut session = test_session();
        assert!(session.mark_cashed_out().is_ok());
        assert_eq!(session.status, SessionStatus::CashedOut);
    }

    #[test]
    fn test_mark_cashed_out_when_lost() {
        let mut session = test_session();
        session.status = SessionStatus::Lost;
        assert!(session.mark_cashed_out().is_err());
    }

    #[test]
    fn test_mark_cashed_out_when_already_cashed_out() {
        let mut session = test_session();
        session.status = SessionStatus::CashedOut;
        assert!(session.mark_cashed_out().is_err());
    }

    // HouseVault tests
    #[test]
    fn test_reserve_success() {
        let mut vault = test_vault();
        assert!(vault.reserve(1000).is_ok());
        assert_eq!(vault.total_reserved, 1000);
    }

    #[test]
    fn test_reserve_multiple_times() {
        let mut vault = test_vault();
        assert!(vault.reserve(1000).is_ok());
        assert!(vault.reserve(500).is_ok());
        assert_eq!(vault.total_reserved, 1500);
    }

    #[test]
    fn test_reserve_overflow() {
        let mut vault = test_vault();
        vault.total_reserved = u64::MAX;
        assert!(vault.reserve(1).is_err());
    }

    #[test]
    fn test_release_success() {
        let mut vault = test_vault();
        vault.total_reserved = 1000;
        assert!(vault.release(500).is_ok());
        assert_eq!(vault.total_reserved, 500);
    }

    #[test]
    fn test_release_full_amount() {
        let mut vault = test_vault();
        vault.total_reserved = 1000;
        assert!(vault.release(1000).is_ok());
        assert_eq!(vault.total_reserved, 0);
    }

    #[test]
    fn test_release_more_than_reserved() {
        let mut vault = test_vault();
        vault.total_reserved = 500;
        assert!(vault.release(1000).is_err());
    }

    #[test]
    fn test_release_underflow() {
        let mut vault = test_vault();
        vault.total_reserved = 0;
        assert!(vault.release(1).is_err());
    }

    #[test]
    fn test_reserve_and_release_cycle() {
        let mut vault = test_vault();

        // Reserve for first session
        assert!(vault.reserve(1000).is_ok());
        assert_eq!(vault.total_reserved, 1000);

        // Reserve for second session
        assert!(vault.reserve(2000).is_ok());
        assert_eq!(vault.total_reserved, 3000);

        // Release first session
        assert!(vault.release(1000).is_ok());
        assert_eq!(vault.total_reserved, 2000);

        // Release second session
        assert!(vault.release(2000).is_ok());
        assert_eq!(vault.total_reserved, 0);
    }
}
