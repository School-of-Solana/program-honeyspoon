/**
 * Game Error Types
 *
 * AUTO-GENERATED FROM RUST ERRORS
 * Source: anchor_project/the_fool/programs/dive_game/src/errors.rs
 *
 * These error codes match the on-chain program errors exactly.
 * Use these when checking for specific error types in transactions.
 */

export enum GameErrorCode {
  HouseLocked = 6000,
  InvalidSessionStatus = 6001,
  InvalidBetAmount = 6002,
  RoundMismatch = 6003,
  TreasureInvalid = 6004,
  InsufficientVaultBalance = 6005,
  Overflow = 6006,
  InsufficientTreasure = 6007,
  InvalidConfig = 6008,
  MaxDivesReached = 6009,
  InvalidSlotHash = 6010,
  SessionNotExpired = 6011,
  VaultHasReservedFunds = 6012,
  VaultCapacityExceeded = 6013,
}

export const GameErrorMessage: Record<GameErrorCode, string> = {
  [GameErrorCode.HouseLocked]: "House vault is locked",
  [GameErrorCode.InvalidSessionStatus]: "Session is not active",
  [GameErrorCode.InvalidBetAmount]: "Bet amount must be greater than zero",
  [GameErrorCode.RoundMismatch]: "Round number mismatch",
  [GameErrorCode.TreasureInvalid]:
    "Treasure amount invalid or exceeds max payout",
  [GameErrorCode.InsufficientVaultBalance]:
    "Insufficient vault balance for payout",
  [GameErrorCode.Overflow]: "Arithmetic overflow",
  [GameErrorCode.InsufficientTreasure]:
    "Cannot cash out with treasure less than or equal to bet",
  [GameErrorCode.InvalidConfig]: "Invalid game configuration",
  [GameErrorCode.MaxDivesReached]: "Maximum number of dives reached",
  [GameErrorCode.InvalidSlotHash]:
    "Could not retrieve valid slot hash from SlotHashes sysvar",
  [GameErrorCode.SessionNotExpired]:
    "Session has not expired yet - cannot clean up",
  [GameErrorCode.VaultHasReservedFunds]:
    "Cannot reset vault reserved when total_reserved > 0 - may have active sessions",
  [GameErrorCode.VaultCapacityExceeded]:
    "Vault capacity exceeded - too many concurrent sessions would risk insolvency",
};

export type GameErrorName = keyof typeof GameErrorCode;

/**
 * Checks if an error code is a specific game error
 */
export function isGameError(
  errorCode: number,
  expected: GameErrorCode
): boolean {
  return errorCode === expected;
}

/**
 * Gets the human-readable message for an error code
 */
export function getErrorMessage(errorCode: number): string {
  return GameErrorMessage[errorCode as GameErrorCode] || "Unknown error";
}

/**
 * Checks if a transaction error matches a specific game error
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function hasGameError(error: any, expected: GameErrorCode): boolean {
  if (!error) return false;

  // Check error.err structure
  if (error.err?.InstructionError) {
    const [, customError] = error.err.InstructionError;
    if (customError?.Custom !== undefined) {
      return customError.Custom === expected;
    }
  }

  return false;
}
