/**
 * GameErrors - Error codes and error class matching the Anchor contract
 *
 * IMPORTANT: Error codes must match the contract's GameError enum exactly
 * Contract error enum is defined in dive-game-chain program
 */

/**
 * Error codes - matches Anchor contract's GameError enum
 */
export enum GameErrorCode {
  // ===== Direct mappings from Anchor GameError =====

  /** House vault is locked and cannot process transactions */
  HOUSE_LOCKED = "HOUSE_LOCKED",

  /** Session is not in Active status */
  INVALID_SESSION_STATUS = "INVALID_SESSION_STATUS",

  /** Caller is not the session owner */
  WRONG_USER = "WRONG_USER",

  /** Round number doesn't match expected next round */
  ROUND_MISMATCH = "ROUND_MISMATCH",

  /** Treasure value is invalid (non-monotonic or exceeds max payout) */
  TREASURE_INVALID = "TREASURE_INVALID",

  /** Vault has insufficient balance to cover payout */
  INSUFFICIENT_VAULT_BALANCE = "INSUFFICIENT_VAULT_BALANCE",

  /** Arithmetic overflow occurred */
  OVERFLOW = "OVERFLOW",

  // ===== Additional frontend-only error codes =====

  /** Wallet not connected */
  WALLET_NOT_CONNECTED = "WALLET_NOT_CONNECTED",

  /** User wallet has insufficient funds */
  INSUFFICIENT_USER_FUNDS = "INSUFFICIENT_USER_FUNDS",

  /** Bet amount is below minimum */
  BET_BELOW_MINIMUM = "BET_BELOW_MINIMUM",

  /** Bet amount is above maximum */
  BET_ABOVE_MAXIMUM = "BET_ABOVE_MAXIMUM",

  /** Network or RPC error */
  NETWORK_ERROR = "NETWORK_ERROR",

  /** Internal/unknown error */
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

/**
 * Game error class with contract error mapping
 */
export class GameError extends Error {
  constructor(
    public readonly code: GameErrorCode,
    message: string,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = "GameError";

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GameError);
    }
  }

  // ===== Factory methods matching contract errors =====

  static houseLocked(): GameError {
    return new GameError(GameErrorCode.HOUSE_LOCKED, "House is locked");
  }

  static invalidSessionStatus(): GameError {
    return new GameError(
      GameErrorCode.INVALID_SESSION_STATUS,
      "Session is not active"
    );
  }

  static wrongUser(): GameError {
    return new GameError(
      GameErrorCode.WRONG_USER,
      "Caller is not session user"
    );
  }

  static roundMismatch(expected: number, got: number): GameError {
    return new GameError(
      GameErrorCode.ROUND_MISMATCH,
      `Round number mismatch: expected ${expected}, got ${got}`,
      { expected, got }
    );
  }

  static treasureInvalid(reason: string): GameError {
    return new GameError(
      GameErrorCode.TREASURE_INVALID,
      `Treasure invalid: ${reason}`
    );
  }

  static insufficientVaultBalance(): GameError {
    return new GameError(
      GameErrorCode.INSUFFICIENT_VAULT_BALANCE,
      "House vault has insufficient funds. Please refresh the page to reinitialize the vault."
    );
  }

  static overflow(operation: string): GameError {
    return new GameError(
      GameErrorCode.OVERFLOW,
      `Arithmetic overflow in ${operation}`
    );
  }

  // ===== Frontend-specific factory methods =====

  static insufficientUserFunds(needed: bigint, available: bigint): GameError {
    return new GameError(
      GameErrorCode.INSUFFICIENT_USER_FUNDS,
      `Insufficient user funds: need ${needed}, have ${available}`,
      { needed: needed.toString(), available: available.toString() }
    );
  }

  static betBelowMinimum(bet: number, minimum: number): GameError {
    return new GameError(
      GameErrorCode.BET_BELOW_MINIMUM,
      `Bet $${bet} is below minimum $${minimum}`,
      { bet, minimum }
    );
  }

  static betAboveMaximum(bet: number, maximum: number): GameError {
    return new GameError(
      GameErrorCode.BET_ABOVE_MAXIMUM,
      `Bet $${bet} exceeds maximum $${maximum}`,
      { bet, maximum }
    );
  }

  static networkError(message: string): GameError {
    return new GameError(
      GameErrorCode.NETWORK_ERROR,
      `Network error: ${message}`
    );
  }

  static internalError(message: string): GameError {
    return new GameError(
      GameErrorCode.INTERNAL_ERROR,
      `Internal error: ${message}`
    );
  }

  // ===== Anchor error parsing =====

  /**
   * Parse an Anchor error into a GameError
   *
   * Anchor errors have this structure:
   * {
   *   error: {
   *     errorCode: {
   *       code: "HouseLocked",
   *       number: 6000
   *     },
   *     errorMessage: "House is locked"
   *   },
   *   message: "...",
   *   logs: [...]
   * }
   */
  static fromAnchor(anchorError: any): GameError {
    // Extract error code from Anchor error
    const errorCode = anchorError.error?.errorCode?.code;
    const errorMessage = anchorError.message || anchorError.error?.errorMessage;

    switch (errorCode) {
      case "HouseLocked":
        return GameError.houseLocked();

      case "InvalidSessionStatus":
        return GameError.invalidSessionStatus();

      case "WrongUser":
        return GameError.wrongUser();

      case "RoundMismatch":
        // Try to extract details from message if available
        return new GameError(
          GameErrorCode.ROUND_MISMATCH,
          errorMessage || "Round number mismatch"
        );

      case "TreasureInvalid":
        return GameError.treasureInvalid(
          errorMessage || "treasure validation failed"
        );

      case "InsufficientVaultBalance":
        return GameError.insufficientVaultBalance();

      case "Overflow":
        return GameError.overflow("checked_add/sub");

      // Anchor constraint errors
      case "ConstraintHasOne":
        return GameError.wrongUser();

      case "AccountNotInitialized":
        return GameError.internalError("Account does not exist");

      // Default case
      default:
        return GameError.internalError(errorMessage || "Unknown error");
    }
  }

  /**
   * Parse a Solana/Web3.js error into a GameError
   * Handles both Anchor program errors and generic Solana errors
   */
  static fromSolana(error: any): GameError {
    // If already a GameError, return as-is
    if (GameError.isGameError(error)) {
      return error;
    }

    // Try parsing as Anchor error first
    if (error.error?.errorCode) {
      return GameError.fromAnchor(error);
    }

    // Handle Solana transaction errors
    const message = error.message || error.toString();

    // Network/RPC errors
    if (message.includes("fetch") || message.includes("network")) {
      return GameError.networkError(message);
    }

    // Insufficient funds
    if (
      message.includes("insufficient funds") ||
      message.includes("Insufficient lamports")
    ) {
      return GameError.insufficientUserFunds(BigInt(0), BigInt(0));
    }

    // Account not found
    if (
      message.includes("AccountNotFound") ||
      message.includes("could not find account")
    ) {
      return GameError.internalError(
        "Account not found - session may not exist"
      );
    }

    // Default to internal error
    return GameError.internalError(message);
  }

  /**
   * Check if error is a GameError
   */
  static isGameError(error: any): error is GameError {
    return error instanceof GameError;
  }

  /**
   * Helper: Create invalid session error
   */
  static invalidSession(): GameError {
    return new GameError(
      GameErrorCode.INVALID_SESSION_STATUS,
      "Session not found or inactive"
    );
  }

  /**
   * Convert to JSON for serialization
   */
  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}
