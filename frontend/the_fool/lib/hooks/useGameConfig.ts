import { useEffect, useState } from 'react';
import { getGameChain } from '@/lib/ports';
import type { GameConfigState } from '@/lib/ports/GameChainPort';

/**
 * Hook to fetch game configuration from the blockchain
 * 
 * This replaces hardcoded constants with values from the on-chain GameConfig account.
 * Updates automatically when config changes.
 */
export function useGameConfig() {
  const [config, setConfig] = useState<GameConfigState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchConfig = async () => {
      try {
        setLoading(true);
        setError(null);

        const chain = getGameChain();
        const gameConfig = await chain.getGameConfig();

        if (!mounted) return;

        if (gameConfig) {
          console.log('[useGameConfig] Loaded config from blockchain:', {
            minBet: `${Number(gameConfig.minBet) / 1_000_000_000} SOL`,
            maxBet: `${Number(gameConfig.maxBet) / 1_000_000_000} SOL`,
            baseSurvivalPpm: gameConfig.baseSurvivalPpm,
            maxDives: gameConfig.maxDives,
          });
          setConfig(gameConfig);
        } else {
          setError('Game config not found on chain');
        }
      } catch (err) {
        if (!mounted) return;
        console.error('[useGameConfig] Failed to fetch config:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchConfig();

    // Refresh config every 30 seconds (in case admin updates it)
    const interval = setInterval(fetchConfig, 30_000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Convert to friendly format matching GAME_CONFIG interface
  const friendlyConfig = config ? {
    // Core gameplay
    FIXED_BET: Number(config.minBet) / 1_000_000_000, // Convert lamports to SOL
    BASE_SURVIVAL_PROBABILITY: config.baseSurvivalPpm / 1_000_000, // Convert PPM to decimal
    DECAY_CONSTANT: config.decayPerDivePpm / 1_000_000, // Convert PPM to decimal
    MIN_WIN_PROB: config.minSurvivalPpm / 1_000_000, // Convert PPM to decimal
    
    // Treasure multipliers
    TREASURE_MULTIPLIER: config.treasureMultiplierNum / config.treasureMultiplierDen,
    HOUSE_EDGE: 1 - (config.treasureMultiplierNum / config.treasureMultiplierDen),
    
    // Limits
    MAX_PAYOUT_MULTIPLIER: config.maxPayoutMultiplier,
    MAX_DIVES: config.maxDives,
    MIN_BET: Number(config.minBet) / 1_000_000_000,
    MAX_BET: Number(config.maxBet) / 1_000_000_000,
    
    // Constants
    LAMPORTS_PER_SOL: 1_000_000_000,
    INITIAL_WALLET_BALANCE: 1000, // Only for local mode
    
    // Raw config for advanced use
    _raw: config,
  } : null;

  return {
    config: friendlyConfig,
    rawConfig: config,
    loading,
    error,
  };
}

/**
 * Get game config synchronously (throws if not loaded)
 * Use this when you need config and can't use hooks
 */
let cachedConfig: GameConfigState | null = null;

export async function getGameConfigOnce(): Promise<GameConfigState | null> {
  if (cachedConfig) return cachedConfig;
  
  const chain = getGameChain();
  const config = await chain.getGameConfig();
  cachedConfig = config;
  
  return config;
}

/**
 * Clear cached config (for testing)
 */
export function clearGameConfigCache() {
  cachedConfig = null;
}
