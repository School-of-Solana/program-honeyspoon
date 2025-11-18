/**
 * Game Config - Single source of truth
 * 
 * This file provides game configuration that comes from the blockchain.
 * It replaces hardcoded constants with values from the GameConfig account.
 */

import { getGameConfigOnce } from './hooks/useGameConfig';
import { GAME_CONFIG as FALLBACK_CONFIG } from './constants';

let cachedConfig: typeof FALLBACK_CONFIG | null = null;

/**
 * Get game config (from blockchain or fallback)
 * 
 * This function tries to fetch from blockchain first, then falls back to constants.
 * Use this in server actions and utilities where hooks can't be used.
 */
export async function getGameConfig() {
  // Return cached if available
  if (cachedConfig) return cachedConfig;

  try {
    const blockchainConfig = await getGameConfigOnce();
    
    if (blockchainConfig) {
      // Convert blockchain config to friendly format
      cachedConfig = {
        FIXED_BET: Number(blockchainConfig.minBet) / 1_000_000_000 as number,
        BASE_SURVIVAL_PROBABILITY: blockchainConfig.baseSurvivalPpm / 1_000_000 as number,
        DECAY_CONSTANT: blockchainConfig.decayPerDivePpm / 1_000_000 as number,
        MIN_WIN_PROB: blockchainConfig.minSurvivalPpm / 1_000_000 as number,
        TREASURE_MULTIPLIER: (blockchainConfig.treasureMultiplierNum / blockchainConfig.treasureMultiplierDen) as number,
        HOUSE_EDGE: (1 - (blockchainConfig.treasureMultiplierNum / blockchainConfig.treasureMultiplierDen)) as number,
        MAX_PAYOUT_MULTIPLIER: blockchainConfig.maxPayoutMultiplier as number,
        MAX_DIVES: blockchainConfig.maxDives as number,
        MIN_BET: Number(blockchainConfig.minBet) / 1_000_000_000 as number,
        MAX_BET: Number(blockchainConfig.maxBet) / 1_000_000_000 as number,
        LAMPORTS_PER_SOL: 1_000_000_000 as number,
        INITIAL_WALLET_BALANCE: 1000 as number,
        
        // Legacy compatibility
        TARGET_EV: 0.95 as number,
        BASE_WIN_PROB: blockchainConfig.baseSurvivalPpm / 1_000_000 as number,
        STARTING_DEPTH: 0 as number,
        DEPTH_PER_DIVE: 50 as number,
        MAX_VISUAL_DEPTH: 2000 as number,
        SESSION_TIMEOUT_MS: (30 * 60 * 1000) as number,
      };
      
      console.log('[GameConfig] Loaded from blockchain:', cachedConfig);
      return cachedConfig;
    }
  } catch (error) {
    console.warn('[GameConfig] Failed to load from blockchain, using fallback:', error);
  }

  // Fallback to constants
  cachedConfig = FALLBACK_CONFIG;
  console.log('[GameConfig] Using fallback constants');
  return cachedConfig;
}

/**
 * Clear cache (for testing or when config updates)
 */
export function clearGameConfigCache() {
  cachedConfig = null;
}

/**
 * Get config synchronously (returns fallback if blockchain config not loaded)
 */
export function getGameConfigSync() {
  return cachedConfig || FALLBACK_CONFIG;
}
