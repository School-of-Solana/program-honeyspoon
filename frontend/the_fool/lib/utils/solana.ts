/**
 * Solana utility functions
 * Using @solana/web3.js standard utilities
 */

import { LAMPORTS_PER_SOL } from '@solana/web3.js';

/**
 * Convert SOL to lamports
 * @param sol - SOL amount (can be fractional)
 * @returns Lamports as bigint
 */
export function solToLamports(sol: number): bigint {
  const lamports = Math.floor(sol * LAMPORTS_PER_SOL);
  return BigInt(lamports);
}

/**
 * Convert lamports to SOL
 * @param lamports - Lamports amount (bigint or number)
 * @returns SOL amount as number
 */
export function lamportsToSol(lamports: bigint | number): number {
  return Number(lamports) / LAMPORTS_PER_SOL;
}

/**
 * Format lamports as SOL string
 * @param lamports - Lamports amount
 * @param decimals - Number of decimal places (default 2)
 * @returns Formatted SOL string
 */
export function formatSol(lamports: bigint | number, decimals: number = 2): string {
  const sol = lamportsToSol(lamports);
  return `${sol.toFixed(decimals)} SOL`;
}

// Re-export for convenience
export { LAMPORTS_PER_SOL };
