/**
 * Ports module - Dependency injection and exports
 * 
 * This module provides:
 * - GameChainPort interface and types
 * - GameError and error codes
 * - Factory function to get the appropriate implementation
 * 
 * Usage:
 * ```typescript
 * import { getGameChain, GameError } from '@/lib/ports';
 * 
 * const chain = getGameChain();
 * const result = await chain.startSession({ ... });
 * ```
 */

import { GameChainPort } from "./GameChainPort";
import { LocalGameChain } from "./LocalGameChain";

// Re-export types and classes
export * from "./GameChainPort";
export * from "./GameErrors";
export { LocalGameChain } from "./LocalGameChain";

// Global singleton instance
let gameChainInstance: GameChainPort | null = null;

/**
 * Get the game chain implementation
 * 
 * Returns the appropriate implementation based on environment:
 * - Development: LocalGameChain (in-memory simulation)
 * - Production with SOLANA_RPC_URL: SolanaGameChain (real blockchain)
 * - Production without SOLANA_RPC_URL: LocalGameChain (fallback)
 * 
 * This function uses singleton pattern for consistent state.
 */
export function getGameChain(): GameChainPort {
  if (gameChainInstance) {
    return gameChainInstance;
  }

  // Check environment variable for Solana RPC
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || process.env.SOLANA_RPC_URL;
  const useRealChain = process.env.NEXT_PUBLIC_USE_SOLANA_CHAIN === "true";

  if (useRealChain && rpcUrl) {
    // TODO: Implement SolanaGameChain when contract is ready
    console.warn(
      "[GameChain] NEXT_PUBLIC_USE_SOLANA_CHAIN=true but SolanaGameChain not implemented yet. " +
      "Falling back to LocalGameChain."
    );
    gameChainInstance = new LocalGameChain();
  } else {
    // Use local implementation (default)
    gameChainInstance = new LocalGameChain();
  }

  return gameChainInstance;
}

/**
 * Reset the game chain instance (for testing)
 */
export function resetGameChain(): void {
  if (gameChainInstance instanceof LocalGameChain) {
    gameChainInstance.resetState();
  }
  gameChainInstance = null;
}

/**
 * Set a custom game chain instance (for testing)
 */
export function setGameChain(instance: GameChainPort): void {
  gameChainInstance = instance;
}
