use anchor_lang::prelude::*;
#[error_code]
pub enum GameError {
    #[msg("House vault is locked")]
    HouseLocked,
    #[msg("Session is not active")]
    InvalidSessionStatus,
    #[msg("Bet amount must be greater than zero")]
    InvalidBetAmount,
    #[msg("Round number mismatch")]
    RoundMismatch,
    #[msg("Treasure amount invalid or exceeds max payout")]
    TreasureInvalid,
    #[msg("Insufficient vault balance for payout")]
    InsufficientVaultBalance,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Cannot cash out with treasure less than or equal to bet")]
    InsufficientTreasure,
    #[msg("Invalid game configuration")]
    InvalidConfig,
    #[msg("Maximum number of dives reached")]
    MaxDivesReached,
    #[msg("Could not retrieve valid slot hash from SlotHashes sysvar")]
    InvalidSlotHash,
    #[msg("Session has not expired yet - cannot clean up")]
    SessionNotExpired,
    #[msg("Cannot reset vault reserved when total_reserved > 0 - may have active sessions")]
    VaultHasReservedFunds,
    #[msg("Vault capacity exceeded - too many concurrent sessions would risk insolvency")]
    VaultCapacityExceeded,
}
