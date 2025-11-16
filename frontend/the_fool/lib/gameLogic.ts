/**
 * Core game logic for Abyss Fortune
 *
 * THEME LAYER: This wraps the generic game engine with submarine/diving theme
 *
 * The generic engine (gameEngine.ts) handles:
 * - Probability/multiplier math
 * - Win/loss determination
 * - EV calculations
 *
 * This file adds:
 * - Depth zones (visual)
 * - Shipwrecks (procedural content)
 * - Oxygen levels (flavor)
 */

import {
  DEPTH_ZONES,
  ERAS,
  GAME_CONFIG,
  SHIP_NAME_ADJECTIVES,
  SHIP_NAME_NOUNS,
  SHIP_NAME_PREFIXES,
  SHIP_TYPES,
  SHIPWRECK_VISUALS,
  TREASURE_TYPES,
} from "./constants";
import { calculateRoundStats } from "./gameEngine";
import type { DepthZone, DiveStats, Shipwreck } from "./types";

/**
 * Calculate dive statistics for any round
 *
 * This wraps the generic game engine with diving theme:
 * - roundNumber → diveNumber
 * - Adds depth (visual)
 * - Adds depth zones (visual)
 * - Adds oxygen (flavor)
 */
export function calculateDiveStats(diveNumber: number): DiveStats {
  // Get generic round stats from engine
  const roundStats = calculateRoundStats(diveNumber);

  // Add theme-specific visuals
  const depth = GAME_CONFIG.DEPTH_PER_DIVE * diveNumber;

  return {
    diveNumber,
    survivalProbability: roundStats.winProbability,
    multiplier: roundStats.multiplier,
    expectedValue: roundStats.expectedValue,
    depth,
    threshold: roundStats.threshold,
    depthZone: getDepthZone(depth),
    oxygenRemaining: Math.max(5, 100 - diveNumber * 4), // Depletes over time (flavor)
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
export function generateShipwreck(diveNumber: number, seed: string): Shipwreck {
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
  const noun = SHIP_NAME_NOUNS[Math.floor(random() * SHIP_NAME_NOUNS.length)];

  const name = `${prefix} ${adjective} ${noun}`;

  // Visual
  const visual =
    SHIPWRECK_VISUALS[Math.floor(random() * SHIPWRECK_VISUALS.length)];

  // Treasure value increases with depth
  const baseTreasure = 50;
  const treasureValue = Math.floor(
    baseTreasure * Math.pow(1.1, diveNumber - 1),
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

  return function() {
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
  // Base size for zero/minimal treasure
  const baseSize = 20;

  if (totalValue === 0) {
    return { size: baseSize, glow: 0.1, particles: 0, color: "#FFD700" };
  } else if (totalValue < 100) {
    return { size: 30, glow: 0.2, particles: 5, color: "#FFD700" };
  } else if (totalValue < 500) {
    return { size: 45, glow: 0.5, particles: 15, color: "#FFA500" };
  } else if (totalValue < 1000) {
    return { size: 60, glow: 0.8, particles: 30, color: "#FF6347" };
  } else {
    return {
      size: Math.min(120, 80 + Math.floor(totalValue / 10000)),
      glow: 1.0,
      particles: 50,
      color: "#FF00FF",
    };
  }
}

/**
 * Validate bet amount
 */
export function validateBet(amount: number): {
  valid: boolean;
  error?: string;
} {
  // Check for invalid numeric values
  if (!Number.isFinite(amount) || Number.isNaN(amount)) {
    return { valid: false, error: "Bet amount must be a valid number" };
  }

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
      depth >= c.minDepth && depth <= c.maxDepth,
  );

  if (validCreatures.length === 0) { return "🐟"; }

  const random = Math.floor(Math.random() * validCreatures.length);
  return validCreatures[random].visual;
}
