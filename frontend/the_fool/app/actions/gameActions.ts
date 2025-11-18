"use server";

/**
 * Game Actions - Theme Adapter Layer
 *
 * This file wraps the generic game engine with diving-themed names
 * for backward compatibility with the frontend.
 *
 * Mapping:
 * - startGame → startGameSession
 * - performDive → executeRound
 * - surfaceWithTreasure → cashOut
 * - diveNumber → roundNumber
 *
 * The generic engine is theme-agnostic and can be reused for other games.
 */

import { calculateDiveStats, generateShipwreck } from "@/lib/gameLogic";
import type { DiveResult } from "@/lib/types";
import {
  cashOut,
  executeRound,
  generateSessionId as genSessionId,
  getHouseStatus as getHouse,
  getWalletInfo as getWallet,
  startGameSession,
} from "./gameEngine";

/**
 * Start a new game (place bet)
 * Theme wrapper for startGameSession
 */
export async function startGame(
  betAmount: number,
  userId: string,
  sessionId: string
): Promise<{ success: boolean; error?: string; sessionId?: string }> {
  return startGameSession(betAmount, userId, sessionId);
}

/**
 * Perform a dive (execute a round)
 * Theme wrapper for executeRound + adds shipwreck generation
 */
export async function performDive(
  diveNumber: number,
  currentTreasure: number,
  sessionId: string,
  userId: string,
  testSeed?: string
): Promise<DiveResult> {
  // Execute the round using generic engine
  const result = await executeRound(
    diveNumber,
    currentTreasure,
    sessionId,
    userId,
    testSeed
  );

  // Add diving theme: get dive stats for depth info
  const diveStats = calculateDiveStats(diveNumber);

  // Add diving theme: generate shipwreck
  const shipwreck = result.survived
    ? generateShipwreck(diveNumber, sessionId)
    : undefined;

  // Convert generic RoundResult to DiveResult
  return {
    success: result.success,
    randomRoll: result.randomRoll,
    threshold: result.threshold,
    survived: result.survived,
    newTreasureValue: result.newValue,
    totalTreasure: result.totalValue,
    diveNumber: result.roundNumber,
    depth: diveStats.depth, // Theme-specific
    survivalProbability: result.winProbability,
    multiplier: result.multiplier,
    timestamp: result.timestamp,
    shipwreck: shipwreck ? { ...shipwreck, discovered: true } : undefined,
  };
}

/**
 * Cash out (surface with treasure)
 * Theme wrapper for cashOut
 */
export async function surfaceWithTreasure(
  finalTreasure: number,
  sessionId: string,
  userId: string
): Promise<{ success: boolean; finalAmount: number; profit: number }> {
  return cashOut(finalTreasure, sessionId, userId);
}

/**
 * Generate a new session ID
 */
export async function generateSessionId(): Promise<string> {
  return genSessionId();
}

/**
 * Get user wallet balance and info
 */
export async function getWalletInfo(userId: string) {
  return getWallet(userId);
}

/**
 * Validate a bet amount before starting game
 */
export async function validateBetAmount(betAmount: number, userId: string) {
  // For now, just forward to getWalletInfo and check against limits
  const wallet = await getWalletInfo(userId);

  if (betAmount < 10) {
    return { valid: false, error: "Minimum bet is $10" };
  }

  if (betAmount > wallet.maxBet) {
    return { valid: false, error: `Maximum bet is $${wallet.maxBet}` };
  }

  if (betAmount > wallet.balance) {
    return { valid: false, error: "Insufficient balance" };
  }

  return { valid: true };
}

/**
 * Get user transaction history
 */
export async function getTransactionHistory(
  userId: string,
  limit: number = 10
): Promise<
  Array<{
    id: string;
    type: string;
    amount: number;
    timestamp: number;
    profit?: number;
    diveNumber?: number;
  }>
> {
  const { getUserTransactions } = await import("@/lib/walletStore");
  const transactions = getUserTransactions(userId, limit);

  return transactions.map((t) => ({
    id: t.id,
    type: t.type,
    amount: t.amount,
    timestamp: t.timestamp,
    profit: t.metadata?.profit,
    diveNumber: t.metadata?.diveNumber || t.metadata?.roundNumber,
  }));
}

/**
 * Get house wallet status
 */
export async function getHouseStatus() {
  return getHouse();
}

/**
 * Add balance to user wallet (for testing/demo)
 */
export async function addBalance(
  userId: string,
  amount: number
): Promise<{ success: boolean; newBalance: number }> {
  const { addUserBalance } = await import("@/lib/walletStore");
  const updatedWallet = addUserBalance(userId, amount);

  return {
    success: true,
    newBalance: updatedWallet.balance,
  };
}
