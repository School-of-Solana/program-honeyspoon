/**
 * Solana Error Parser for Tests
 *
 * Parses transaction errors from LiteSVM test results.
 * This is a simplified version adapted for test environments.
 * 
 * Parses the improved error logging format:
 * - INSUFFICIENT_VAULT need=10 have=2 vault=EF6u3Zw...
 * - INSUFFICIENT_TREASURE treasure=0 bet=1 session=AbC123...
 * - VAULT_UNDERFUNDED need=10 have=5 vault=EF6u3Zw...
 */

/**
 * Game error codes (from Rust errors.rs)
 */
export const GameErrorCode = {
  HouseLocked: 6000,
  InvalidSessionStatus: 6001,
  InvalidBetAmount: 6002,
  RoundMismatch: 6003,
  TreasureInvalid: 6004,
  InsufficientVaultBalance: 6005,
  Overflow: 6006,
  InsufficientTreasure: 6007,
  InvalidConfig: 6008,
  MaxDivesReached: 6009,
  InvalidSlotHash: 6010,
  SessionNotExpired: 6011,
} as const;

export type GameErrorCode = typeof GameErrorCode[keyof typeof GameErrorCode];

export interface ParsedTestError {
  errorCode: string;
  errorCodeNumber?: number;
  errorMessage: string;
  amounts?: {
    bet?: string;
    treasure?: string;
    need?: string;
    have?: string;
    shortage?: string;
  };
  addresses?: {
    vault?: string;
    session?: string;
  };
  logs: string[];
}

/**
 * Extracts amounts from compact log format
 */
function extractAmounts(logs: string[]): ParsedTestError["amounts"] {
  const amounts: ParsedTestError["amounts"] = {};

  for (const log of logs) {
    // INSUFFICIENT_VAULT need=10 have=2
    const vaultMatch = log.match(/INSUFFICIENT_VAULT\s+need=(\d+(?:\.\d+)?)\s+have=(\d+(?:\.\d+)?)/);
    if (vaultMatch) {
      amounts.need = `${vaultMatch[1]} SOL`;
      amounts.have = `${vaultMatch[2]} SOL`;
      const shortage = parseFloat(vaultMatch[1]) - parseFloat(vaultMatch[2]);
      amounts.shortage = `${shortage.toFixed(2)} SOL`;
    }

    // INSUFFICIENT_TREASURE treasure=0 bet=1
    const treasureMatch = log.match(/INSUFFICIENT_TREASURE\s+treasure=(\d+(?:\.\d+)?)\s+bet=(\d+(?:\.\d+)?)/);
    if (treasureMatch) {
      amounts.treasure = `${treasureMatch[1]} SOL`;
      amounts.bet = `${treasureMatch[2]} SOL`;
    }

    // VAULT_UNDERFUNDED need=10 have=5
    const underfundedMatch = log.match(/VAULT_UNDERFUNDED\s+need=(\d+(?:\.\d+)?)\s+have=(\d+(?:\.\d+)?)/);
    if (underfundedMatch) {
      amounts.need = `${underfundedMatch[1]} SOL`;
      amounts.have = `${underfundedMatch[2]} SOL`;
      const shortage = parseFloat(underfundedMatch[1]) - parseFloat(underfundedMatch[2]);
      amounts.shortage = `${shortage.toFixed(2)} SOL`;
    }
  }

  return Object.keys(amounts).length > 0 ? amounts : undefined;
}

/**
 * Extracts addresses from compact log format
 */
function extractAddresses(logs: string[]): ParsedTestError["addresses"] {
  const addresses: ParsedTestError["addresses"] = {};

  for (const log of logs) {
    // vault=EF6u3Zw2tv8w5ao6KeqpDbnFxzh2mt4DN6PLEzEnwVoV
    const vaultMatch = log.match(/vault=([1-9A-HJ-NP-Za-km-z]{32,44})/);
    if (vaultMatch) {
      addresses.vault = vaultMatch[1];
    }

    // session=AbC123...
    const sessionMatch = log.match(/session=([1-9A-HJ-NP-Za-km-z]{32,44})/);
    if (sessionMatch) {
      addresses.session = sessionMatch[1];
    }
  }

  return Object.keys(addresses).length > 0 ? addresses : undefined;
}

/**
 * Extracts error code from transaction result
 */
function extractErrorCode(result: any): { code: string; codeNumber?: number } {
  // Check if result has err property
  if (result?.err) {
    // InstructionError format: [index, { Custom: code }]
    if (result.err.InstructionError) {
      const [, customError] = result.err.InstructionError;
      if (typeof customError === "object" && "Custom" in customError) {
        const codeNumber = customError.Custom;
        // Map to error name
        const errorName = Object.entries(GameErrorCode).find(
          ([, value]) => value === codeNumber
        )?.[0];
        return {
          code: errorName || `CustomError${codeNumber}`,
          codeNumber,
        };
      }
    }
  }

  return { code: "Unknown" };
}

/**
 * Parses transaction error from LiteSVM result
 */
export function parseTransactionError(result: any): ParsedTestError | null {
  if (!result || result.constructor?.name !== "FailedTransactionMetadata") {
    return null;
  }

  const logs: string[] = result.logs || [];
  const { code: errorCode, codeNumber: errorCodeNumber } = extractErrorCode(result);
  
  const amounts = extractAmounts(logs);
  const addresses = extractAddresses(logs);

  // Get error message
  let errorMessage = "Transaction failed";
  if (errorCodeNumber !== undefined) {
    const errorNames: Record<number, string> = {
      [GameErrorCode.HouseLocked]: "House vault is locked",
      [GameErrorCode.InvalidSessionStatus]: "Session is not active",
      [GameErrorCode.InvalidBetAmount]: "Bet amount must be greater than zero",
      [GameErrorCode.RoundMismatch]: "Round number mismatch",
      [GameErrorCode.TreasureInvalid]: "Treasure amount invalid or exceeds max payout",
      [GameErrorCode.InsufficientVaultBalance]: "Insufficient vault balance for payout",
      [GameErrorCode.Overflow]: "Arithmetic overflow",
      [GameErrorCode.InsufficientTreasure]: "Cannot cash out with treasure less than or equal to bet",
      [GameErrorCode.InvalidConfig]: "Invalid game configuration",
      [GameErrorCode.MaxDivesReached]: "Maximum number of dives reached",
      [GameErrorCode.InvalidSlotHash]: "Could not retrieve valid slot hash from SlotHashes sysvar",
      [GameErrorCode.SessionNotExpired]: "Session has not expired yet - cannot clean up",
    };
    errorMessage = errorNames[errorCodeNumber] || errorMessage;
  }

  return {
    errorCode,
    errorCodeNumber,
    errorMessage,
    amounts,
    addresses,
    logs,
  };
}

/**
 * Formats error for console output
 */
export function formatErrorForConsole(parsed: ParsedTestError): string {
  let output = `\nERROR: ${parsed.errorMessage}\n`;
  output += `   Error Code: ${parsed.errorCode}`;
  if (parsed.errorCodeNumber !== undefined) {
    output += ` (${parsed.errorCodeNumber})`;
  }
  output += "\n";

  if (parsed.amounts) {
    output += "\nAmounts:\n";
    if (parsed.amounts.bet) output += `   Bet: ${parsed.amounts.bet}\n`;
    if (parsed.amounts.treasure) output += `   Treasure: ${parsed.amounts.treasure}\n`;
    if (parsed.amounts.need) output += `   Needed: ${parsed.amounts.need}\n`;
    if (parsed.amounts.have) output += `   Available: ${parsed.amounts.have}\n`;
    if (parsed.amounts.shortage) output += `   Shortage: ${parsed.amounts.shortage}\n`;
  }

  if (parsed.addresses) {
    output += "\nAddresses:\n";
    if (parsed.addresses.vault) output += `   Vault: ${parsed.addresses.vault}\n`;
    if (parsed.addresses.session) output += `   Session: ${parsed.addresses.session}\n`;
  }

  return output;
}

/**
 * Checks if error matches a specific game error code
 */
export function hasError(result: any, expectedCode: GameErrorCode): boolean {
  if (!result?.err) return false;

  if (result.err.InstructionError) {
    const [, customError] = result.err.InstructionError;
    if (typeof customError === "object" && "Custom" in customError) {
      return customError.Custom === expectedCode;
    }
  }

  return false;
}

/**
 * Enhanced expectation helpers
 */
export function expectError(result: any, expectedCode: GameErrorCode): void {
  if (!hasError(result, expectedCode)) {
    const parsed = parseTransactionError(result);
    if (parsed) {
      console.log(formatErrorForConsole(parsed));
      throw new Error(
        `Expected error ${GameErrorCode[expectedCode]} (${expectedCode}), got ${parsed.errorCode} (${parsed.errorCodeNumber})`
      );
    }
    throw new Error(
      `Expected error ${GameErrorCode[expectedCode]} (${expectedCode}), but transaction did not fail with that error`
    );
  }
}

export function expectSuccess(result: any, context?: string): void {
  if (result?.constructor?.name === "FailedTransactionMetadata") {
    const parsed = parseTransactionError(result);
    if (parsed) {
      console.log(formatErrorForConsole(parsed));
    }
    throw new Error(`Expected success${context ? ` for ${context}` : ""}, but transaction failed`);
  }
}
