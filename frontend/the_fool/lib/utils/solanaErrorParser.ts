/**
 * Solana Error Parser
 *
 * Extracts detailed information from Solana transaction errors
 * including amounts, addresses, and provides explorer links.
 *
 * Works with the improved error logging format from start_session.rs and cash_out.rs:
 * - INSUFFICIENT_VAULT need=10 have=2 vault=EF6u3Zw...
 * - INSUFFICIENT_TREASURE treasure=0 bet=1 session=AbC123...
 * - VAULT_UNDERFUNDED need=10 have=5 vault=EF6u3Zw...
 */

import {
  GameErrorCode,
  GameErrorMessage,
  hasGameError,
} from "../solana/errors";

export interface ParsedSolanaError {
  errorCode: string;
  errorCodeNumber?: number;
  errorMessage: string;
  detailedMessage: string;
  amounts?: {
    bet?: string;
    treasure?: string;
    need?: string;
    have?: string;
    shortage?: string;
  };
  addresses?: {
    user?: string;
    vault?: string;
    session?: string;
  };
  explorerLinks?: {
    user?: string;
    vault?: string;
    session?: string;
  };
  actionableSteps?: string[];
}

const DEVNET_EXPLORER = "https://explorer.solana.com/address";
const CLUSTER = "?cluster=devnet";

/**
 * Extracts amounts from new compact log format
 * Format: "INSUFFICIENT_VAULT need=10 have=2 vault=..."
 *
 * Searches both in the logs array AND in the raw error message as fallback
 */
function extractCompactAmounts(
  logs: string[],
  rawErrorMessage?: string
): ParsedSolanaError["amounts"] {
  const amounts: ParsedSolanaError["amounts"] = {};

  // Combine logs and raw error message for searching
  const searchTexts = [...logs];
  if (rawErrorMessage) {
    searchTexts.push(rawErrorMessage);
  }

  for (const text of searchTexts) {
    // Match: INSUFFICIENT_VAULT need=10 have=2
    const vaultMatch = text.match(
      /INSUFFICIENT_VAULT\s+need=(\d+(?:\.\d+)?)\s+have=(\d+(?:\.\d+)?)/
    );
    if (vaultMatch) {
      amounts.need = `${vaultMatch[1]} SOL`;
      amounts.have = `${vaultMatch[2]} SOL`;
      const shortage = parseFloat(vaultMatch[1]) - parseFloat(vaultMatch[2]);
      amounts.shortage = `${shortage.toFixed(2)} SOL`;
    }

    // Match: INSUFFICIENT_TREASURE treasure=0 bet=1
    const treasureMatch = text.match(
      /INSUFFICIENT_TREASURE\s+treasure=(\d+(?:\.\d+)?)\s+bet=(\d+(?:\.\d+)?)/
    );
    if (treasureMatch) {
      amounts.treasure = `${treasureMatch[1]} SOL`;
      amounts.bet = `${treasureMatch[2]} SOL`;
    }

    // Match: VAULT_UNDERFUNDED need=10 have=5
    const underfundedMatch = text.match(
      /VAULT_UNDERFUNDED\s+need=(\d+(?:\.\d+)?)\s+have=(\d+(?:\.\d+)?)/
    );
    if (underfundedMatch) {
      amounts.need = `${underfundedMatch[1]} SOL`;
      amounts.have = `${underfundedMatch[2]} SOL`;
      const shortage =
        parseFloat(underfundedMatch[1]) - parseFloat(underfundedMatch[2]);
      amounts.shortage = `${shortage.toFixed(2)} SOL`;
    }
  }

  return Object.keys(amounts).length > 0 ? amounts : undefined;
}

/**
 * Extracts wallet/PDA addresses from new compact log format
 *
 * Searches both in the logs array AND in the raw error message as fallback
 */
function extractCompactAddresses(
  logs: string[],
  rawErrorMessage?: string
): ParsedSolanaError["addresses"] {
  const addresses: ParsedSolanaError["addresses"] = {};

  // Combine logs and raw error message for searching
  const searchTexts = [...logs];
  if (rawErrorMessage) {
    searchTexts.push(rawErrorMessage);
  }

  for (const text of searchTexts) {
    // Match: vault=EF6u3Zw2tv8w5ao6KeqpDbnFxzh2mt4DN6PLEzEnwVoV
    const vaultMatch = text.match(/vault=([1-9A-HJ-NP-Za-km-z]{32,44})/);
    if (vaultMatch) {
      addresses.vault = vaultMatch[1];
    }

    // Match: session=AbC123...
    const sessionMatch = text.match(/session=([1-9A-HJ-NP-Za-km-z]{32,44})/);
    if (sessionMatch) {
      addresses.session = sessionMatch[1];
    }

    // Match: user=...
    const userMatch = text.match(/user=([1-9A-HJ-NP-Za-km-z]{32,44})/);
    if (userMatch) {
      addresses.user = userMatch[1];
    }
  }

  return Object.keys(addresses).length > 0 ? addresses : undefined;
}

/**
 * Generates explorer links for extracted addresses
 */
function generateExplorerLinks(
  addresses?: ParsedSolanaError["addresses"],
  cluster: string = "devnet"
): ParsedSolanaError["explorerLinks"] {
  if (!addresses) return undefined;

  const links: ParsedSolanaError["explorerLinks"] = {};
  const clusterParam = cluster === "mainnet-beta" ? "" : `?cluster=${cluster}`;

  if (addresses.user) {
    links.user = `${DEVNET_EXPLORER}/${addresses.user}${clusterParam}`;
  }
  if (addresses.vault) {
    links.vault = `${DEVNET_EXPLORER}/${addresses.vault}${clusterParam}`;
  }
  if (addresses.session) {
    links.session = `${DEVNET_EXPLORER}/${addresses.session}${clusterParam}`;
  }

  return Object.keys(links).length > 0 ? links : undefined;
}

/**
 * Generates actionable steps based on error type
 */
function getActionableSteps(
  errorCode: string,
  amounts?: ParsedSolanaError["amounts"]
): string[] {
  const steps: string[] = [];

  if (errorCode === "InsufficientVaultBalance") {
    steps.push(
      "The house vault doesn't have enough SOL to cover the maximum payout."
    );

    if (amounts?.need && amounts?.have) {
      steps.push(`Vault has ${amounts.have}, needs ${amounts.need}`);
    }

    if (amounts?.shortage) {
      steps.push(`Short by: ${amounts.shortage}`);
    }

    steps.push("Try a smaller bet, or wait for the vault to be refunded.");
  } else if (errorCode === "InsufficientTreasure") {
    steps.push("Cannot cash out without profit.");

    if (amounts?.treasure && amounts?.bet) {
      steps.push(
        `Your treasure: ${amounts.treasure}, Original bet: ${amounts.bet}`
      );
    }

    steps.push("You must dive at least once and survive to have profit.");
  } else if (errorCode === "InvalidBetAmount") {
    steps.push("Bet amount is outside allowed limits.");
    steps.push("Check the min/max bet amounts on the game screen.");
  } else if (errorCode === "HouseLocked") {
    steps.push("The game is temporarily paused for maintenance.");
    steps.push("Please try again later.");
  }

  return steps;
}

/**
 * Extracts error code from transaction error
 */
function extractErrorCode(error: any): { code: string; codeNumber?: number } {
  // Try to extract from InstructionError[1].Custom
  if (error?.err?.InstructionError) {
    const [, customError] = error.err.InstructionError;
    if (customError?.Custom !== undefined) {
      const codeNumber = customError.Custom;
      // Map code number to error name
      for (const [name, value] of Object.entries(GameErrorCode)) {
        if (value === codeNumber) {
          return { code: name, codeNumber };
        }
      }
      return { code: `Error${codeNumber}`, codeNumber };
    }
  }

  // Try to extract from error message
  const errorString = error.message || error.toString();

  // Try "Error Code: Name" format
  const errorCodeMatch = errorString.match(/Error Code:\s*(\w+)/);
  if (errorCodeMatch) {
    const errorName = errorCodeMatch[1];
    // Try to find the corresponding number
    const codeNumber = GameErrorCode[errorName as keyof typeof GameErrorCode];
    return { code: errorName, codeNumber };
  }

  // Try "Error Number: 6005" format
  const errorNumberMatch = errorString.match(/Error Number:\s*(\d+)/);
  if (errorNumberMatch) {
    const codeNumber = parseInt(errorNumberMatch[1]);
    // Map to error name
    for (const [name, value] of Object.entries(GameErrorCode)) {
      if (value === codeNumber) {
        return { code: name, codeNumber };
      }
    }
    return { code: `Error${codeNumber}`, codeNumber };
  }

  return { code: "Unknown" };
}

/**
 * Extracts logs from transaction error
 */
function extractLogs(error: any): string[] {
  // Direct logs array
  if (Array.isArray(error.logs)) {
    return error.logs;
  }

  // Logs in error message as array string
  const errorString = error.message || error.toString();

  // Try multiple patterns to extract logs
  // Pattern 1: Logs: [...] with newlines
  let logsMatch = errorString.match(/Logs:\s*\n?\[([\s\S]+?)\]/);

  // Pattern 2: logs: [...] (lowercase)
  if (!logsMatch) {
    logsMatch = errorString.match(/logs:\s*\n?\[([\s\S]+?)\]/);
  }

  // Pattern 3: Just look for array with "Program" entries
  if (!logsMatch) {
    logsMatch = errorString.match(/\[([\s\S]*?Program[\s\S]+?)\]/);
  }

  if (logsMatch) {
    const logsString = logsMatch[1];

    // Split by commas OR newlines, being careful with quoted strings
    // This regex splits on comma+optional-newline OR just-newline, but not inside quotes
    const logs = logsString
      .split(/(?:,\s*\n\s*|,\s*|\n\s*)(?=(?:[^"]*"[^"]*")*[^"]*$)/)
      .map((line: string) => {
        let cleaned = line.trim();
        // Remove surrounding quotes (single or double)
        cleaned = cleaned.replace(/^["']|["']$/g, "");
        // Unescape any escaped quotes
        cleaned = cleaned.replace(/\\"/g, '"');
        // Remove leading comma if still present
        cleaned = cleaned.replace(/^,\s*/, "");
        return cleaned;
      })
      .filter((line: string) => line.length > 0 && line !== ",");

    return logs;
  }

  return [];
}

/**
 * Parses Solana transaction error and extracts detailed information
 */
export function parseSolanaError(
  error: any,
  cluster: string = "devnet"
): ParsedSolanaError {
  const { code: errorCode, codeNumber: errorCodeNumber } =
    extractErrorCode(error);
  const logs = extractLogs(error);

  // Get raw error message for fallback searching
  const rawErrorMessage = error.message || error.toString();

  // Get error message from GameErrorMessage or extract from logs
  const errorMessage =
    GameErrorMessage[errorCodeNumber as GameErrorCode] || "Transaction failed";

  // Extract amounts and addresses from logs (with fallback to raw message)
  const amounts = extractCompactAmounts(logs, rawErrorMessage);
  const addresses = extractCompactAddresses(logs, rawErrorMessage);
  const explorerLinks = generateExplorerLinks(addresses, cluster);
  const actionableSteps = getActionableSteps(errorCode, amounts);

  // Build detailed message
  let detailedMessage = `${errorMessage}\n\n`;

  if (amounts) {
    detailedMessage += "Transaction Details:\n";
    if (amounts.bet) detailedMessage += `  Bet: ${amounts.bet}\n`;
    if (amounts.treasure)
      detailedMessage += `  Treasure: ${amounts.treasure}\n`;
    if (amounts.need) detailedMessage += `  Needed: ${amounts.need}\n`;
    if (amounts.have) detailedMessage += `  Available: ${amounts.have}\n`;
    if (amounts.shortage)
      detailedMessage += `  Shortage: ${amounts.shortage}\n`;
    detailedMessage += "\n";
  }

  if (addresses) {
    detailedMessage += "Addresses:\n";
    if (addresses.user) detailedMessage += `  User: ${addresses.user}\n`;
    if (addresses.vault) detailedMessage += `  Vault: ${addresses.vault}\n`;
    if (addresses.session)
      detailedMessage += `  Session: ${addresses.session}\n`;
    detailedMessage += "\n";
  }

  if (explorerLinks) {
    detailedMessage += "Explorer Links:\n";
    if (explorerLinks.vault)
      detailedMessage += `  Vault: ${explorerLinks.vault}\n`;
    if (explorerLinks.session)
      detailedMessage += `  Session: ${explorerLinks.session}\n`;
    detailedMessage += "\n";
  }

  if (actionableSteps.length > 0) {
    detailedMessage += "What to do:\n";
    actionableSteps.forEach((step) => {
      detailedMessage += `  ${step}\n`;
    });
  }

  return {
    errorCode,
    errorCodeNumber,
    errorMessage,
    detailedMessage: detailedMessage.trim(),
    amounts,
    addresses,
    explorerLinks,
    actionableSteps,
  };
}

/**
 * Formats parsed error for display to user
 */
export function formatSolanaErrorForUser(
  parsedError: ParsedSolanaError
): string {
  let message = `${parsedError.errorMessage}\n\n`;

  if (parsedError.amounts) {
    if (parsedError.amounts.bet || parsedError.amounts.treasure) {
      message += "Your Transaction:\n";
      if (parsedError.amounts.bet)
        message += `Bet: ${parsedError.amounts.bet}\n`;
      if (parsedError.amounts.treasure)
        message += `Treasure: ${parsedError.amounts.treasure}\n`;
      message += "\n";
    }

    if (parsedError.amounts.need || parsedError.amounts.have) {
      message += "Vault Status:\n";
      if (parsedError.amounts.have)
        message += `Available: ${parsedError.amounts.have}\n`;
      if (parsedError.amounts.need)
        message += `Needed: ${parsedError.amounts.need}\n`;
      if (parsedError.amounts.shortage)
        message += `Short by: ${parsedError.amounts.shortage}\n`;
      message += "\n";
    }
  }

  if (parsedError.actionableSteps && parsedError.actionableSteps.length > 0) {
    message += parsedError.actionableSteps.slice(0, 3).join("\n");
  }

  return message.trim();
}

/**
 * Helper to check if error matches a specific game error code
 */
export function isGameErrorCode(
  error: any,
  expectedCode: GameErrorCode
): boolean {
  return hasGameError(error, expectedCode);
}
