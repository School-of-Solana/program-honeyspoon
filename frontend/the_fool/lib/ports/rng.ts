/**
 * On-Chain RNG Simulation
 *
 * Mimics the contract's VRF-based randomness system.
 * This is what the contract will do internally.
 *
 * SECURITY MODEL:
 * - Contract gets seed from VRF oracle (Switchboard)
 * - Contract derives per-round rolls using: keccak256(seed || dive_number)
 * - Users CANNOT bias the outcome (seed is from VRF, not user input)
 */

import { createHash } from "crypto";

/**
 * Game configuration matching contract
 */
export interface GameCurveConfig {
  baseWinProbability: number; // e.g. 0.70 = 70%
  decayConstant: number; // e.g. 0.08
  minWinProbability: number; // e.g. 0.05 = 5%
  houseEdge: number; // e.g. 0.05 = 5%
}

/**
 * Generate a VRF-like seed (32 bytes)
 * In real contract: comes from Switchboard VRF
 * In LocalGameChain: use crypto.randomBytes
 */
export function generateVRFSeed(): Uint8Array {
  if (typeof window !== "undefined" && window.crypto) {
    // Browser
    return window.crypto.getRandomValues(new Uint8Array(32));
  } else {
    // Node.js
    return require("crypto").randomBytes(32);
  }
}

/**
 * Derive a per-round random roll from VRF seed + dive number
 *
 * This mimics the contract's logic:
 * ```rust
 * let mut seed_material = [0u8; 64];
 * seed_material[0..32].copy_from_slice(&session.rng_seed);
 * seed_material[32..40].copy_from_slice(&dive_number.to_le_bytes());
 * let h = keccak256(&seed_material);
 * let rand_u64 = u64::from_le_bytes(h[0..8]);
 * let roll_bps = rand_u64 % 1_000_000;
 * ```
 *
 * @param seed - 32-byte VRF seed
 * @param diveNumber - Current dive number (1-indexed)
 * @param sessionPda - Session PDA for uniqueness (optional)
 * @returns Random number in [0, 1000000) basis points
 */
export function deriveRoundRoll(
  seed: Uint8Array,
  diveNumber: number,
  sessionPda?: string
): number {
  // Build seed material: seed || dive_number || session_pda
  const buffer = new Uint8Array(64);

  // First 32 bytes: VRF seed
  buffer.set(seed, 0);

  // Next 8 bytes: dive number (little-endian u64) - use DataView for browser compatibility
  const view = new DataView(buffer.buffer);
  view.setBigUint64(32, BigInt(diveNumber), true); // true = little-endian

  // Optionally mix in session PDA for extra uniqueness
  if (sessionPda) {
    const pdaHash = createHash("sha256").update(sessionPda).digest();
    for (let i = 0; i < 24; i++) {
      buffer[40 + i] ^= pdaHash[i];
    }
  }

  // Hash with keccak256 (matching Solana's keccak)
  const hash = createHash("sha256").update(Buffer.from(buffer)).digest(); // Note: using sha256 as keccak256 substitute

  // Extract first 8 bytes as u64 - use DataView for browser compatibility
  const hashView = new DataView(hash.buffer, hash.byteOffset);
  const randU64 = hashView.getBigUint64(0, true); // true = little-endian

  // Modulo to get basis points [0, 1000000)
  const rollBps = Number(randU64 % BigInt(1_000_000));

  return rollBps;
}

/**
 * Calculate survival probability for a given dive number
 *
 * Formula: P(survive) = max(minP, baseP * e^(-decay * (dive - 1)))
 *
 * Returns basis points [0, 1000000) for comparison with roll
 *
 * @param diveNumber - Current dive (1-indexed)
 * @param config - Game curve configuration
 * @returns Survival threshold in basis points [0, 1000000)
 */
export function survivalThresholdBps(
  diveNumber: number,
  config: GameCurveConfig
): number {
  // Exponential decay: P = baseP * e^(-decay * (n-1))
  const probability = Math.max(
    config.minWinProbability,
    config.baseWinProbability *
      Math.exp(-config.decayConstant * (diveNumber - 1))
  );

  // Convert to basis points
  return Math.floor(probability * 1_000_000);
}

/**
 * Calculate treasure for a given round (deterministic payout curve)
 *
 * This is the PURE ON-CHAIN FUNCTION that replaces client-computed treasures.
 *
 * Formula: treasure(n) = bet * product(multiplier_i for i=1..n)
 * Where: multiplier_i = (1 - houseEdge) / P(survive at round i)
 *
 * @param betAmount - Initial bet in lamports
 * @param diveNumber - Current dive number (1-indexed)
 * @param config - Game curve configuration
 * @returns Treasure amount in lamports
 */
export function treasureForRound(
  betAmount: bigint,
  diveNumber: number,
  config: GameCurveConfig
): bigint {
  if (diveNumber < 1) {
    throw new Error("Dive number must be >= 1");
  }

  // For round 1, treasure = bet (no multiplier yet)
  if (diveNumber === 1) {
    return betAmount;
  }

  // Compute cumulative treasure by applying multipliers
  let treasure = Number(betAmount);

  for (let round = 1; round < diveNumber; round++) {
    const survivalProb = survivalThresholdBps(round, config) / 1_000_000;
    const multiplier = (1 - config.houseEdge) / survivalProb;

    // VALIDATION: Ensure multiplier is positive (player should win on successful dive)
    if (multiplier < 1.0) {
      console.error(`[RNG] ❌ CRITICAL: Negative expected value detected!`, {
        round,
        survivalProb,
        houseEdge: config.houseEdge,
        multiplier,
        message: "Players lose money on wins! Check game config.",
      });
      throw new Error(
        `Invalid game config: multiplier ${multiplier.toFixed(3)} < 1.0 at round ${round}`
      );
    }

    treasure *= multiplier;
  }

  return BigInt(Math.floor(treasure));
}

/**
 * Calculate max potential payout (for reserve calculation)
 *
 * @param betAmount - Initial bet in lamports
 * @param maxRounds - Maximum rounds allowed (e.g. 50)
 * @param config - Game curve configuration
 * @returns Maximum possible payout in lamports
 */
export function maxPotentialPayout(
  betAmount: bigint,
  maxRounds: number,
  config: GameCurveConfig
): bigint {
  return treasureForRound(betAmount, maxRounds, config);
}

/**
 * Simulate a round outcome (what the contract does internally)
 *
 * @param seed - VRF seed
 * @param diveNumber - Current dive number
 * @param betAmount - Initial bet
 * @param config - Game configuration
 * @param sessionPda - Session PDA (optional)
 * @returns Round outcome
 */
export function simulateRoundOutcome(
  seed: Uint8Array,
  diveNumber: number,
  betAmount: bigint,
  config: GameCurveConfig,
  sessionPda?: string
): {
  survived: boolean;
  randomRoll: number;
  threshold: number;
  newDiveNumber: number;
  newTreasure: bigint;
  survivalProbability: number;
} {
  // Derive random roll from seed + dive number
  const randomRoll = deriveRoundRoll(seed, diveNumber, sessionPda);

  // Get survival threshold
  const threshold = survivalThresholdBps(diveNumber, config);
  const survivalProbability = threshold / 1_000_000;

  // Determine outcome
  const survived = randomRoll < threshold;

  if (survived) {
    // Player survives: increment dive, compute new treasure
    const newDiveNumber = diveNumber + 1;
    const newTreasure = treasureForRound(betAmount, newDiveNumber, config);

    return {
      survived: true,
      randomRoll,
      threshold,
      newDiveNumber,
      newTreasure,
      survivalProbability,
    };
  } else {
    // Player loses: treasure goes to 0
    return {
      survived: false,
      randomRoll,
      threshold,
      newDiveNumber: diveNumber, // Stays same (session ends)
      newTreasure: BigInt(0),
      survivalProbability,
    };
  }
}
