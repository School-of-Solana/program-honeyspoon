/**
 * Lamports conversion utilities
 * 
 * 1 SOL = 1,000,000,000 lamports (1e9)
 * For game purposes, we use a virtual dollar:lamport ratio
 * 
 * In the actual game, dollars are just a UI convention.
 * The blockchain only knows lamports.
 */

/** Conversion ratio: dollars to lamports */
export const LAMPORTS_PER_DOLLAR = BigInt(1_000_000_000); // 1 billion lamports = $1 (for game purposes)

/**
 * Convert dollars to lamports
 * 
 * @param dollars - Dollar amount (can be fractional)
 * @returns Lamports as bigint
 * 
 * @example
 * dollarsToLamports(10) // BigInt(10_000_000_000)
 * dollarsToLamports(0.5) // BigInt(500_000_000)
 */
export function dollarsToLamports(dollars: number): bigint {
  // Multiply by conversion ratio, handling decimals
  const lamports = Math.floor(dollars * Number(LAMPORTS_PER_DOLLAR));
  return BigInt(lamports);
}

/**
 * Convert lamports to dollars
 * 
 * @param lamports - Lamports amount (bigint)
 * @returns Dollar amount as number
 * 
 * @example
 * lamportsToDollars(BigInt(10_000_000_000)) // 10
 * lamportsToDollars(BigInt(500_000_000)) // 0.5
 */
export function lamportsToDollars(lamports: bigint): number {
  // Convert to number with division
  return Number(lamports) / Number(LAMPORTS_PER_DOLLAR);
}

/**
 * Format lamports as dollar string
 * 
 * @param lamports - Lamports amount
 * @param decimals - Number of decimal places (default 2)
 * @returns Formatted dollar string
 * 
 * @example
 * formatDollars(BigInt(10_000_000_000)) // "$10.00"
 * formatDollars(BigInt(1_500_000_000), 2) // "$1.50"
 */
export function formatDollars(lamports: bigint, decimals: number = 2): string {
  const dollars = lamportsToDollars(lamports);
  return `$${dollars.toFixed(decimals)}`;
}

/**
 * Parse dollar string to lamports
 * Handles various formats: "$10", "10.50", "10"
 * 
 * @param dollarString - Dollar string to parse
 * @returns Lamports as bigint
 * @throws {Error} if string is invalid
 * 
 * @example
 * parseDollarString("$10") // BigInt(10_000_000_000)
 * parseDollarString("10.50") // BigInt(10_500_000_000)
 */
export function parseDollarString(dollarString: string): bigint {
  // Remove $ and whitespace
  const cleaned = dollarString.replace(/[$\s]/g, '');
  
  // Parse as float
  const dollars = parseFloat(cleaned);
  
  if (isNaN(dollars)) {
    throw new Error(`Invalid dollar string: ${dollarString}`);
  }
  
  return dollarsToLamports(dollars);
}

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
 */
export function multiplyLamports(lamports: bigint, multiplier: number): bigint {
  // Convert multiplier to handle decimals properly
  const scaledMultiplier = Math.floor(multiplier * 1e9);
  return (lamports * BigInt(scaledMultiplier)) / BigInt(1_000_000_000);
}
