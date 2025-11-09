"use server";

import crypto from "crypto";
import { calculateDiveStats, generateShipwreck } from "@/lib/gameLogic";
import type { DiveResult } from "@/lib/types";

/**
 * Perform a dive (server-side for security)
 * Uses cryptographically secure random number generation
 * @param testSeed - Optional deterministic seed for testing (format: "0-99")
 */
export async function performDive(
  diveNumber: number,
  currentTreasure: number,
  sessionId: string,
  testSeed?: string
): Promise<DiveResult> {
  // Validate inputs
  if (diveNumber < 1 || diveNumber > 10000) {
    throw new Error("Invalid dive number");
  }

  if (currentTreasure < 0) {
    throw new Error("Invalid treasure amount");
  }

  if (!sessionId || sessionId.length < 10) {
    throw new Error("Invalid session ID");
  }

  // Get dive statistics (fixed EV)
  const stats = calculateDiveStats(diveNumber);

  // Generate random number (0-99)
  let randomRoll: number;
  
  if (testSeed !== undefined && process.env.NODE_ENV === "test") {
    // Use deterministic seed for testing
    randomRoll = parseInt(testSeed, 10);
    if (isNaN(randomRoll) || randomRoll < 0 || randomRoll > 99) {
      throw new Error("Invalid test seed: must be 0-99");
    }
  } else {
    // Use cryptographically secure random for production
    const randomBytes = crypto.randomBytes(4);
    randomRoll = randomBytes.readUInt32BE(0) % 100;
  }

  // Determine survival (roll must be >= threshold to survive)
  const survived = randomRoll >= stats.threshold;

  // Generate procedural shipwreck
  const shipwreck = generateShipwreck(diveNumber, sessionId);

  // Calculate new treasure value
  let newTreasureValue = 0;
  let totalTreasure = 0;

  if (survived) {
    // Apply multiplier to current treasure
    newTreasureValue = Math.floor(currentTreasure * stats.multiplier);
    totalTreasure = newTreasureValue;
  } else {
    // Drowned - lose everything
    newTreasureValue = 0;
    totalTreasure = 0;
  }

  return {
    success: true,
    randomRoll,
    threshold: stats.threshold,
    survived,
    newTreasureValue,
    totalTreasure,
    diveNumber,
    depth: stats.depth,
    survivalProbability: stats.survivalProbability,
    multiplier: stats.multiplier,
    timestamp: Date.now(),
    shipwreck: survived ? { ...shipwreck, discovered: true } : undefined,
  };
}

/**
 * Cash out (surface with treasure)
 */
export async function surfaceWithTreasure(
  finalTreasure: number,
  sessionId: string
): Promise<{ success: boolean; finalAmount: number }> {
  // Validate
  if (finalTreasure <= 0) {
    throw new Error("No treasure to cash out");
  }

  if (!sessionId) {
    throw new Error("Invalid session");
  }

  // In production, this would update user balance in database
  // For now, just return success
  return {
    success: true,
    finalAmount: finalTreasure,
  };
}

/**
 * Generate a new session ID
 */
export async function generateSessionId(): Promise<string> {
  const randomBytes = crypto.randomBytes(16);
  return randomBytes.toString("hex");
}
