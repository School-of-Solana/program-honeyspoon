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
import { createSolanaGameChain } from "./SolanaGameChain";

// Re-export types and classes
export * from "./GameChainPort";
export * from "./GameErrors";
export { LocalGameChain } from "./LocalGameChain";
export { 
  SolanaGameChain, 
  createSolanaGameChain,
  type WalletAdapter,
  type SolanaGameChainConfig
} from "./SolanaGameChain";

// Global singleton instance
let gameChainInstance: GameChainPort | null = null;

/**
 * Get the game chain implementation
 * 
 * Returns the appropriate implementation based on environment:
 * - NEXT_PUBLIC_USE_SOLANA=true: SolanaGameChain (real blockchain)
 * - NEXT_PUBLIC_USE_SOLANA=false or unset: LocalGameChain (in-memory simulation)
 * 
 * This function uses singleton pattern for consistent state.
 */
export function getGameChain(): GameChainPort {
  if (gameChainInstance) {
    return gameChainInstance;
  }

  // Check environment variable for Solana
  const useSolana = process.env.NEXT_PUBLIC_USE_SOLANA === "true";
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL?.trim();
  const houseAuthority = process.env.NEXT_PUBLIC_HOUSE_AUTHORITY?.trim();

  // Validate that env vars are not empty strings
  const hasValidRpcUrl = rpcUrl && rpcUrl.length > 0;
  const hasValidHouseAuthority = houseAuthority && houseAuthority.length > 0;

  if (useSolana && hasValidRpcUrl && hasValidHouseAuthority) {
    console.log("[GameChain] Using SolanaGameChain with RPC:", rpcUrl);
    try {
      gameChainInstance = createSolanaGameChain(rpcUrl, houseAuthority);
    } catch (error) {
      console.error("[GameChain] Failed to create SolanaGameChain:", error);
      console.warn("[GameChain] Falling back to LocalGameChain");
      gameChainInstance = new LocalGameChain();
    }
  } else {
    if (useSolana) {
      console.warn(
        "[GameChain] NEXT_PUBLIC_USE_SOLANA=true but missing required env vars. " +
        "Falling back to LocalGameChain. Required: NEXT_PUBLIC_RPC_URL, NEXT_PUBLIC_HOUSE_AUTHORITY"
      );
    }
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
