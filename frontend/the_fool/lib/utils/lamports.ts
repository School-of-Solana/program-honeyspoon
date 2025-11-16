/**
 * Lamports conversion utilities
 *
 * 1 SOL = 1,000,000,000 lamports (1e9)
 * This is the standard Solana conversion ratio.
 *
 * All amounts in the game are stored as lamports on-chain.
 * SOL is just the UI-friendly representation.
 */

/** Conversion ratio: SOL to lamports (standard Solana ratio) */
export const LAMPORTS_PER_SOL = BigInt(1_000_000_000); // 1 billion lamports = 1 SOL

/**
 * Convert SOL to lamports
 *
 * @param sol - SOL amount (can be fractional)
 * @returns Lamports as bigint
 *
 * @example
 * solToLamports(10) // BigInt(10_000_000_000)
 * solToLamports(0.5) // BigInt(500_000_000)
 */
export function solToLamports(sol: number): bigint {
  // Multiply by conversion ratio, handling decimals
  const lamports = Math.floor(sol * Number(LAMPORTS_PER_SOL));
  return BigInt(lamports);
}

/**
 * @deprecated Use solToLamports instead
 */
export const dollarsToLamports = solToLamports;

/**
 * Convert lamports to SOL
 *
 * @param lamports - Lamports amount (bigint)
 * @returns SOL amount as number
 *
 * @example
 * lamportsToSol(BigInt(10_000_000_000)) // 10
 * lamportsToSol(BigInt(500_000_000)) // 0.5
 */
export function lamportsToSol(lamports: bigint): number {
  // Convert to number with division
  return Number(lamports) / Number(LAMPORTS_PER_SOL);
}

/**
 * @deprecated Use lamportsToSol instead
 */
export const lamportsToDollars = lamportsToSol;

/**
 * Format lamports as SOL string
 *
 * @param lamports - Lamports amount
 * @param decimals - Number of decimal places (default 2)
 * @returns Formatted SOL string
 *
 * @example
 * formatSol(BigInt(10_000_000_000)) // "10.00 SOL"
 * formatSol(BigInt(1_500_000_000), 2) // "1.50 SOL"
 */
export function formatSol(lamports: bigint, decimals: number = 2): string {
  const sol = lamportsToSol(lamports);
  return `${sol.toFixed(decimals)} SOL`;
}

/**
 * @deprecated Use formatSol instead
 */
export const formatDollars = formatSol;

/**
 * Parse SOL string to lamports
 * Handles various formats: "10 SOL", "10.50", "10"
 *
 * @param solString - SOL string to parse
 * @returns Lamports as bigint
 * @throws {Error} if string is invalid
 *
 * @example
 * parseSolString("10 SOL") // BigInt(10_000_000_000)
 * parseSolString("10.50") // BigInt(10_500_000_000)
 */
export function parseSolString(solString: string): bigint {
  // Remove SOL, $, and whitespace
  const cleaned = solString.replace(/[SOL$\s]/gi, "");

  // Parse as float
  const sol = parseFloat(cleaned);

  if (isNaN(sol)) {
    throw new Error(`Invalid SOL string: ${solString}`);
  }

  return solToLamports(sol);
}

/**
 * @deprecated Use parseSolString instead
 */
export const parseDollarString = parseSolString;

/**
 * Check if lamports amount is valid (non-negative)
 */
export function isValidLamports(lamports: bigint): boolean {
  return lamports >= BigInt(0);
}

/**
 * Add two lamport amounts safely
 *
 * @throws {Error} if result overflows
 */
export function addLamports(a: bigint, b: bigint): bigint {
  const result = a + b;
  if (result < a || result < b) {
    throw new Error("Lamports overflow");
  }
  return result;
}

/**
 * Subtract lamports safely
 *
 * @throws {Error} if result underflows
 */
export function subtractLamports(a: bigint, b: bigint): bigint {
  if (b > a) {
    throw new Error("Lamports underflow");
  }
  return a - b;
}

/**
 * Multiply lamports by a scalar
 *
 * @throws {Error} if result overflows or multiplier is negative
 */
export function multiplyLamports(lamports: bigint, multiplier: number): bigint {
  // Validate multiplier
  if (multiplier < 0) {
    throw new Error("Multiplier cannot be negative");
  }

  if (!Number.isFinite(multiplier)) {
    throw new Error("Multiplier must be finite");
  }

  // Convert multiplier to handle decimals properly
  const scaledMultiplier = Math.floor(multiplier * 1e9);
  const scaledBigInt = BigInt(scaledMultiplier);

  // Check for overflow before multiplication
  // Maximum safe value: 2^63 - 1 (bigint limit for compatibility)
  const MAX_SAFE_LAMPORTS = BigInt("9223372036854775807");

  if (lamports > 0 && scaledBigInt > 0) {
    // Check: lamports * scaledBigInt <= MAX_SAFE_LAMPORTS
    // Rearrange: lamports <= MAX_SAFE_LAMPORTS / scaledBigInt
    if (lamports > MAX_SAFE_LAMPORTS / scaledBigInt) {
      throw new Error("Lamports multiplication overflow");
    }
  }

  const result = (lamports * scaledBigInt) / BigInt(1_000_000_000);

  // Sanity check result
  if (result < 0) {
    throw new Error("Lamports multiplication resulted in negative value");
  }

  return result;
}
