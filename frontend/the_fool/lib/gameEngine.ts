/**
 * Generic Multiplier-Based Game Engine
 *
 * This is a theme-agnostic gambling engine that can be skinned with any theme:
 * - Submarine diving (current)
 * - Space exploration
 * - Mining expedition
 * - Mountain climbing
 * - etc.
 *
 * Core mechanic: Progressive multiplier with increasing risk
 * - Player places bet
 * - Each round: survive to apply multiplier, or lose everything
 * - Can cash out at any time
 * - Fixed house edge (configurable)
 */

export interface GameConfig {
  // Fixed house edge (e.g., 0.15 = 15% edge)
  houseEdge: number;

  // Probability curve parameters
  baseWinProbability: number; // Starting probability (e.g., 0.95 = 95%)
  decayConstant: number; // How fast probability decreases
  minWinProbability: number; // Floor (e.g., 0.01 = 1%)

  // Limits
  minBet: number;
  maxBet: number;
  maxPotentialWin: number;

  // Max rounds per game
  maxRounds: number;
}

export const DEFAULT_CONFIG: GameConfig = {
  houseEdge: 0.15, // 15% house edge
  baseWinProbability: 0.95, // Start at 95% survival
  decayConstant: 0.15, // Exponential decay rate
  minWinProbability: 0.01, // Min 1% survival
  minBet: 10,
  maxBet: 500,
  maxPotentialWin: 100000,
  maxRounds: 50,
};

export interface RoundStats {
  roundNumber: number;
  winProbability: number; // Probability of surviving this round (0-1)
  multiplier: number; // Multiplier applied if player survives
  expectedValue: number; // EV = always (1 - houseEdge)
  threshold: number; // Threshold for random roll (0-100)
}

export interface RoundResult {
  success: boolean;
  randomRoll: number; // The random number (0-99)
  threshold: number; // Threshold needed to survive
  survived: boolean;
  newValue: number; // New value after multiplier
  totalValue: number; // Total accumulated value
  roundNumber: number;
  winProbability: number;
  multiplier: number;
  timestamp: number;
}

/**
 * Calculate statistics for a specific round
 *
 * Math:
 * - Win probability decreases exponentially: P(round) = max(minP, baseP * e^(-decay * (round-1)))
 * - Multiplier ensures fixed EV: multiplier = (1 - houseEdge) / P(round)
 * - Expected value: EV = P(round) * multiplier = (1 - houseEdge)
 *
 * This guarantees the house edge is EXACTLY what's configured, regardless of rounds played.
 */
export function calculateRoundStats(
  roundNumber: number,
  config: GameConfig = DEFAULT_CONFIG
): RoundStats {
  // Validate round number
  if (roundNumber < 1) {
    throw new Error("Round number must be >= 1");
  }

  if (roundNumber > config.maxRounds) {
    throw new Error(`Round number exceeds maximum (${config.maxRounds})`);
  }

  // Calculate win probability (exponential decay)
  const winProb = Math.max(
    config.minWinProbability,
    config.baseWinProbability *
      Math.exp(-config.decayConstant * (roundNumber - 1))
  );

  // Calculate multiplier to maintain fixed EV
  const targetEV = 1 - config.houseEdge;
  const multiplier = targetEV / winProb;

  // Threshold for random roll (0-100)
  // Player needs to roll >= threshold to survive
  const threshold = Math.round((1 - winProb) * 100);

  return {
    roundNumber,
    winProbability: Math.round(winProb * 1000) / 1000, // Round to 3 decimals
    multiplier: Math.round(multiplier * 100) / 100, // Round to 2 decimals
    expectedValue: targetEV,
    threshold,
  };
}

/**
 * Calculate maximum potential payout for a game session
 * This is what the house needs to reserve when a bet is placed
 */
export function calculateMaxPotentialPayout(
  initialBet: number,
  maxRounds: number = DEFAULT_CONFIG.maxRounds,
  config: GameConfig = DEFAULT_CONFIG
): number {
  let maxPayout = initialBet;

  // Calculate theoretical max if player survives all rounds
  for (let round = 1; round <= maxRounds; round++) {
    const stats = calculateRoundStats(round, config);
    maxPayout *= stats.multiplier;
  }

  return Math.floor(Math.min(maxPayout, config.maxPotentialWin));
}

/**
 * Simulate a round outcome
 *
 * @param roundNumber - Current round number (1-indexed)
 * @param currentValue - Current accumulated value
 * @param randomRoll - Random number 0-99 (from crypto.randomBytes)
 * @param config - Game configuration
 * @returns Round result with survival status and new value
 */
export function simulateRound(
  roundNumber: number,
  currentValue: number,
  randomRoll: number,
  config: GameConfig = DEFAULT_CONFIG
): RoundResult {
  // Validate inputs
  if (randomRoll < 0 || randomRoll > 99) {
    throw new Error("Random roll must be 0-99");
  }

  if (currentValue < 0) {
    throw new Error("Current value must be non-negative");
  }

  // Get round stats
  const stats = calculateRoundStats(roundNumber, config);

  // Determine survival: player survives if roll >= threshold
  const survived = randomRoll >= stats.threshold;

  // Calculate new value
  let newValue = 0;
  let totalValue = 0;

  if (survived) {
    newValue = Math.floor(currentValue * stats.multiplier);
    totalValue = newValue;
  } else {
    // Lost - value goes to 0
    newValue = 0;
    totalValue = 0;
  }

  return {
    success: true,
    randomRoll,
    threshold: stats.threshold,
    survived,
    newValue,
    totalValue,
    roundNumber,
    winProbability: stats.winProbability,
    multiplier: stats.multiplier,
    timestamp: Date.now(),
  };
}

/**
 * Validate bet amount
 */
export function validateBetAmount(
  amount: number,
  config: GameConfig = DEFAULT_CONFIG
): { valid: boolean; error?: string } {
  // Check for invalid numeric values
  if (!Number.isFinite(amount) || Number.isNaN(amount)) {
    return {
      valid: false,
      error: "Bet amount must be a valid number",
    };
  }

  if (amount < config.minBet) {
    return {
      valid: false,
      error: `Minimum bet is $${config.minBet}`,
    };
  }

  if (amount > config.maxBet) {
    return {
      valid: false,
      error: `Maximum bet is $${config.maxBet}`,
    };
  }

  return { valid: true };
}

/**
 * Calculate cumulative EV after N rounds
 * EV(n) = (1 - houseEdge)^n
 */
export function calculateCumulativeEV(
  rounds: number,
  config: GameConfig = DEFAULT_CONFIG
): number {
  return Math.pow(1 - config.houseEdge, rounds);
}
