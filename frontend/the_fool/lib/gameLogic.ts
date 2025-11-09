/**
 * Core game logic for Abyss Fortune
 * Fixed EV math and procedural generation
 */

import {
  GAME_CONFIG,
  DEPTH_ZONES,
  SHIP_TYPES,
  ERAS,
  TREASURE_TYPES,
  SHIP_NAME_PREFIXES,
  SHIP_NAME_ADJECTIVES,
  SHIP_NAME_NOUNS,
  SHIPWRECK_VISUALS,
} from "./constants";
import type { DiveStats, DepthZone, Shipwreck } from "./types";

/**
 * Calculate dive statistics for any round
 * EV is ALWAYS 0.85 (15% house edge) - PROVABLY FAIR
 */
export function calculateDiveStats(diveNumber: number): DiveStats {
  const { BASE_WIN_PROB, DECAY_CONSTANT, MIN_WIN_PROB, TARGET_EV } =
    GAME_CONFIG;

  // Survival probability (decreases exponentially)
  const survivalProb = Math.max(
    MIN_WIN_PROB,
    BASE_WIN_PROB * Math.exp(-DECAY_CONSTANT * (diveNumber - 1))
  );

  // Multiplier DERIVED from EV (mathematically guaranteed)
  // Formula: multiplier = TARGET_EV / survivalProb
  const multiplier = TARGET_EV / survivalProb;

  // Depth (visual only)
  const depth = GAME_CONFIG.DEPTH_PER_DIVE * diveNumber;

  // Threshold for random roll (0-100)
  const threshold = Math.round((1 - survivalProb) * 100);

  return {
    diveNumber,
    survivalProbability: Math.round(survivalProb * 1000) / 1000,
    multiplier: Math.round(multiplier * 100) / 100,
    expectedValue: TARGET_EV, // ALWAYS 0.85
    depth,
    threshold,
    depthZone: getDepthZone(depth),
    oxygenRemaining: Math.max(5, 100 - diveNumber * 4), // Depletes over time
  };
}

/**
 * Get visual zone based on depth
 */
export function getDepthZone(depth: number): DepthZone {
  for (const [zoneName, config] of Object.entries(DEPTH_ZONES)) {
    if (depth <= config.max) {
      return { ...config, name: zoneName };
    }
  }
  return { ...DEPTH_ZONES.HADAL, name: "HADAL" };
}

/**
 * PROCEDURAL GENERATION: Create a unique shipwreck
 * Uses seeded randomness for deterministic generation per dive
 */
export function generateShipwreck(
  diveNumber: number,
  seed: string
): Shipwreck {
  const depth = diveNumber * GAME_CONFIG.DEPTH_PER_DIVE;

  // Use seed + diveNumber for deterministic randomness
  const random = seededRandom(seed + diveNumber);

  // Select random elements
  const shipType = SHIP_TYPES[Math.floor(random() * SHIP_TYPES.length)];
  const era = ERAS[Math.floor(random() * ERAS.length)];
  const treasureType =
    TREASURE_TYPES[Math.floor(random() * TREASURE_TYPES.length)];

  // Generate unique name
  const prefix =
    SHIP_NAME_PREFIXES[Math.floor(random() * SHIP_NAME_PREFIXES.length)];
  const adjective =
    SHIP_NAME_ADJECTIVES[Math.floor(random() * SHIP_NAME_ADJECTIVES.length)];
  const noun =
    SHIP_NAME_NOUNS[Math.floor(random() * SHIP_NAME_NOUNS.length)];

  const name = `${prefix} ${adjective} ${noun}`;

  // Visual
  const visual =
    SHIPWRECK_VISUALS[Math.floor(random() * SHIPWRECK_VISUALS.length)];

  // Treasure value increases with depth
  const baseTreasure = 50;
  const treasureValue = Math.floor(
    baseTreasure * Math.pow(1.1, diveNumber - 1)
  );

  return {
    id: `${seed}-${diveNumber}`,
    depth,
    name,
    era: `${era.name} (${era.period})`,
    shipType,
    treasureType,
    visual,
    discovered: false,
    treasureValue,
  };
}

/**
 * Seeded random number generator (for deterministic procedural generation)
 * Uses mulberry32 algorithm
 */
function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }

  return function () {
    hash = (hash + 0x6d2b79f5) | 0;
    let t = Math.imul(hash ^ (hash >>> 15), 1 | hash);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Get treasure visualization based on total value
 */
export function getTreasureVisual(totalValue: number) {
  if (totalValue < 100) {
    return { size: 30, glow: 0.2, particles: 5, color: "#FFD700" };
  } else if (totalValue < 500) {
    return { size: 45, glow: 0.5, particles: 15, color: "#FFA500" };
  } else if (totalValue < 1000) {
    return { size: 60, glow: 0.8, particles: 30, color: "#FF6347" };
  } else {
    return { size: 80, glow: 1.0, particles: 50, color: "#FF00FF" };
  }
}

/**
 * Validate bet amount
 */
export function validateBet(amount: number): {
  valid: boolean;
  error?: string;
} {
  if (amount < GAME_CONFIG.MIN_BET) {
    return { valid: false, error: `Minimum bet is $${GAME_CONFIG.MIN_BET}` };
  }
  if (amount > GAME_CONFIG.MAX_BET) {
    return { valid: false, error: `Maximum bet is $${GAME_CONFIG.MAX_BET}` };
  }
  return { valid: true };
}

/**
 * Calculate cumulative EV after N dives
 */
export function calculateCumulativeEV(dives: number): number {
  return Math.pow(GAME_CONFIG.TARGET_EV, dives);
}

/**
 * Get appropriate sea creature for depth
 */
export function getSeaCreatureForDepth(depth: number): string {
  const { SEA_CREATURES } = require("./constants");
  const validCreatures = SEA_CREATURES.filter(
    (c: { minDepth: number; maxDepth: number }) =>
      depth >= c.minDepth && depth <= c.maxDepth
  );

  if (validCreatures.length === 0) return "🐟";

  const random = Math.floor(Math.random() * validCreatures.length);
  return validCreatures[random].visual;
}
