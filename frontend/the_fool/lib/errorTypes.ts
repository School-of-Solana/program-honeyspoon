/**
 * Typed Error System - Eliminates String-Based Error Coupling
 * 
 * This module provides:
 * 1. Strongly-typed error codes (no magic strings)
 * 2. Structured error objects with metadata
 * 3. Type-safe error classification
 * 4. Contract between server and client
 */

/**
 * Error Categories
 * Maps to different UI treatment strategies
 */
export enum ErrorCategory {
  /** Session expired/invalid - trigger re-authentication */
  SESSION = "SESSION",
  
  /** Data mismatch - likely corruption, needs support */
  VALIDATION = "VALIDATION",
  
  /** Insufficient funds or limits exceeded */
  INSUFFICIENT_FUNDS = "INSUFFICIENT_FUNDS",
  
  /** Network/server errors - retry possible */
  NETWORK = "NETWORK",
  
  /** Unknown or unexpected errors */
  UNKNOWN = "UNKNOWN",
}

/**
 * Specific Error Codes
 * Exhaustive list of all possible game errors
 */
export enum GameErrorCode {
  // Session errors
  SESSION_INVALID = "SESSION_INVALID",
  SESSION_INACTIVE = "SESSION_INACTIVE",
  SESSION_NOT_OWNED = "SESSION_NOT_OWNED",
  SESSION_EXPIRED = "SESSION_EXPIRED",
  
  // Validation errors
  TREASURE_MISMATCH = "TREASURE_MISMATCH",
  ROUND_MISMATCH = "ROUND_MISMATCH",
  CASHOUT_MISMATCH = "CASHOUT_MISMATCH",
  
  // Bet validation errors
  BET_TOO_LOW = "BET_TOO_LOW",
  BET_TOO_HIGH = "BET_TOO_HIGH",
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
  HOUSE_LIMIT_EXCEEDED = "HOUSE_LIMIT_EXCEEDED",
  
  // Invalid input
  INVALID_SESSION_ID = "INVALID_SESSION_ID",
  INVALID_USER_ID = "INVALID_USER_ID",
  INVALID_AMOUNT = "INVALID_AMOUNT",
  
  // Unknown
  UNKNOWN = "UNKNOWN",
}

/**
 * Structured Game Error
 * Replaces plain Error objects with typed, categorized errors
 */
export interface GameError {
  /** Unique error code for programmatic handling */
  code: GameErrorCode;
  
  /** Error category for UI routing decisions */
  category: ErrorCategory;
  
  /** Human-readable message (can be i18n key) */
  message: string;
  
  /** Optional details for debugging/support */
  details?: Record<string, unknown>;
  
  /** Timestamp of error occurrence */
  timestamp: number;
}

/**
 * Error code to category mapping
 * Defines how each error type should be handled by UI
 */
export const ERROR_CATEGORIES: Record<GameErrorCode, ErrorCategory> = {
  // Session errors → SESSION category
  [GameErrorCode.SESSION_INVALID]: ErrorCategory.SESSION,
  [GameErrorCode.SESSION_INACTIVE]: ErrorCategory.SESSION,
  [GameErrorCode.SESSION_NOT_OWNED]: ErrorCategory.SESSION,
  [GameErrorCode.SESSION_EXPIRED]: ErrorCategory.SESSION,
  
  // Validation errors → VALIDATION category
  [GameErrorCode.TREASURE_MISMATCH]: ErrorCategory.VALIDATION,
  [GameErrorCode.ROUND_MISMATCH]: ErrorCategory.VALIDATION,
  [GameErrorCode.CASHOUT_MISMATCH]: ErrorCategory.VALIDATION,
  
  // Insufficient funds → INSUFFICIENT_FUNDS category
  [GameErrorCode.BET_TOO_LOW]: ErrorCategory.INSUFFICIENT_FUNDS,
  [GameErrorCode.BET_TOO_HIGH]: ErrorCategory.INSUFFICIENT_FUNDS,
  [GameErrorCode.INSUFFICIENT_BALANCE]: ErrorCategory.INSUFFICIENT_FUNDS,
  [GameErrorCode.HOUSE_LIMIT_EXCEEDED]: ErrorCategory.INSUFFICIENT_FUNDS,
  
  // Invalid input → VALIDATION category
  [GameErrorCode.INVALID_SESSION_ID]: ErrorCategory.VALIDATION,
  [GameErrorCode.INVALID_USER_ID]: ErrorCategory.VALIDATION,
  [GameErrorCode.INVALID_AMOUNT]: ErrorCategory.VALIDATION,
  
  // Unknown → UNKNOWN category
  [GameErrorCode.UNKNOWN]: ErrorCategory.UNKNOWN,
};

/**
 * User-friendly error messages
 * Can be replaced with i18n keys in production
 */
export const ERROR_MESSAGES: Record<GameErrorCode, string> = {
  // Session errors
  [GameErrorCode.SESSION_INVALID]: "Game session expired. Please start a new game.",
  [GameErrorCode.SESSION_INACTIVE]: "Game session is no longer active. Starting new game...",
  [GameErrorCode.SESSION_NOT_OWNED]: "Invalid session ownership. Please refresh.",
  [GameErrorCode.SESSION_EXPIRED]: "Session timed out. Starting new game...",
  
  // Validation errors
  [GameErrorCode.TREASURE_MISMATCH]: "Treasure amount mismatch detected. Please contact support.",
  [GameErrorCode.ROUND_MISMATCH]: "Round number mismatch. Please refresh the game.",
  [GameErrorCode.CASHOUT_MISMATCH]: "Cash-out amount mismatch. Please contact support.",
  
  // Bet validation
  [GameErrorCode.BET_TOO_LOW]: "Bet amount is below minimum.",
  [GameErrorCode.BET_TOO_HIGH]: "Bet amount exceeds maximum.",
  [GameErrorCode.INSUFFICIENT_BALANCE]: "Insufficient balance to place bet.",
  [GameErrorCode.HOUSE_LIMIT_EXCEEDED]: "House cannot cover potential payout.",
  
  // Invalid input
  [GameErrorCode.INVALID_SESSION_ID]: "Invalid session ID.",
  [GameErrorCode.INVALID_USER_ID]: "Invalid user ID.",
  [GameErrorCode.INVALID_AMOUNT]: "Invalid amount.",
  
  // Unknown
  [GameErrorCode.UNKNOWN]: "An unexpected error occurred. Please try again.",
};

/**
 * Create a structured game error
 */
export function createGameError(
  code: GameErrorCode,
  details?: Record<string, unknown>
): GameError {
  return {
    code,
    category: ERROR_CATEGORIES[code],
    message: ERROR_MESSAGES[code],
    details,
    timestamp: Date.now(),
  };
}

/**
 * Parse server error message into typed error
 * This is the ONLY place where string matching should happen
 * 
 * @param errorMessage - Raw error message from server
 * @returns Typed GameError object
 */
export function parseServerError(errorMessage: string): GameError {
  const msg = errorMessage.toLowerCase();
  
  // Session errors
  if (msg.includes("invalid") && msg.includes("session")) {
    return createGameError(GameErrorCode.SESSION_INVALID);
  }
  if (msg.includes("inactive") && msg.includes("session")) {
    return createGameError(GameErrorCode.SESSION_INACTIVE);
  }
  if (msg.includes("does not belong")) {
    return createGameError(GameErrorCode.SESSION_NOT_OWNED);
  }
  
  // Validation errors
  if (msg.includes("treasure mismatch")) {
    const match = errorMessage.match(/Expected \$(\d+), received \$(\d+)/);
    return createGameError(GameErrorCode.TREASURE_MISMATCH, {
      expected: match?.[1],
      received: match?.[2],
    });
  }
  if (msg.includes("round mismatch")) {
    const match = errorMessage.match(/Expected round (\d+), received (\d+)/);
    return createGameError(GameErrorCode.ROUND_MISMATCH, {
      expected: match?.[1],
      received: match?.[2],
    });
  }
  if (msg.includes("cash-out mismatch")) {
    const match = errorMessage.match(/Session has \$(\d+), attempting to cash out \$(\d+)/);
    return createGameError(GameErrorCode.CASHOUT_MISMATCH, {
      sessionAmount: match?.[1],
      attemptedAmount: match?.[2],
    });
  }
  
  // Bet validation
  if (msg.includes("below minimum")) {
    return createGameError(GameErrorCode.BET_TOO_LOW);
  }
  if (msg.includes("exceeds maximum") || msg.includes("above maximum")) {
    return createGameError(GameErrorCode.BET_TOO_HIGH);
  }
  if (msg.includes("insufficient balance")) {
    return createGameError(GameErrorCode.INSUFFICIENT_BALANCE);
  }
  if (msg.includes("cannot cover potential payout")) {
    return createGameError(GameErrorCode.HOUSE_LIMIT_EXCEEDED);
  }
  
  // Invalid input
  if (msg.includes("invalid session id")) {
    return createGameError(GameErrorCode.INVALID_SESSION_ID);
  }
  if (msg.includes("invalid user")) {
    return createGameError(GameErrorCode.INVALID_USER_ID);
  }
  
  // Unknown error
  return createGameError(GameErrorCode.UNKNOWN, { originalMessage: errorMessage });
}

/**
 * Check if error is a specific code
 */
export function isErrorCode(error: GameError, code: GameErrorCode): boolean {
  return error.code === code;
}

/**
 * Check if error belongs to a category
 */
export function isErrorCategory(error: GameError, category: ErrorCategory): boolean {
  return error.category === category;
}

/**
 * Get UI action recommendation for error
 */
export interface ErrorAction {
  /** Action type the UI should take */
  type: "RESET_SESSION" | "RELOAD_PAGE" | "CONTACT_SUPPORT" | "RETRY" | "SHOW_MESSAGE";
  
  /** Primary button label */
  primaryLabel: string;
  
  /** Whether error is recoverable without page reload */
  recoverable: boolean;
}

export function getErrorAction(error: GameError): ErrorAction {
  switch (error.category) {
    case ErrorCategory.SESSION:
      return {
        type: "RESET_SESSION",
        primaryLabel: "Start New Game",
        recoverable: true,
      };
    
    case ErrorCategory.VALIDATION:
      // Validation errors suggest data corruption - needs support
      return {
        type: "CONTACT_SUPPORT",
        primaryLabel: "Reload Page",
        recoverable: false,
      };
    
    case ErrorCategory.INSUFFICIENT_FUNDS:
      return {
        type: "SHOW_MESSAGE",
        primaryLabel: "OK",
        recoverable: true,
      };
    
    case ErrorCategory.NETWORK:
      return {
        type: "RETRY",
        primaryLabel: "Retry",
        recoverable: true,
      };
    
    case ErrorCategory.UNKNOWN:
    default:
      return {
        type: "RELOAD_PAGE",
        primaryLabel: "Reload",
        recoverable: false,
      };
  }
}
