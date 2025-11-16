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
}
