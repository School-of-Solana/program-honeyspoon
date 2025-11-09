"use server";

import crypto from "crypto";
import { calculateDiveStats, generateShipwreck } from "@/lib/gameLogic";
import type { DiveResult } from "@/lib/types";
import { 
  validateBet, 
  validateDiveDeeper,
  calculateMaxPotentialPayout,
  processBet,
  processWin,
  processLoss,
  processHousePayout,
  processHouseReceiveBet,
  reserveHouseFunds,
  releaseHouseFunds,
  DEFAULT_LIMITS
} from "@/lib/walletLogic";
import {
  getUserWallet,
  updateUserWallet,
  getHouseWallet,
  updateHouseWallet,
  addTransaction,
  setGameSession,
  getGameSession,
  deleteGameSession,
} from "@/lib/walletStore";
import type { BetValidation } from "@/lib/walletTypes";

/**
 * Start a new game (place bet)
 */
export async function startGame(
  betAmount: number,
  userId: string,
  sessionId: string
): Promise<{ success: boolean; error?: string; sessionId?: string }> {
  // Validate inputs
  if (betAmount < DEFAULT_LIMITS.minBet) {
    return { success: false, error: `Minimum bet is $${DEFAULT_LIMITS.minBet}` };
  }

  if (!userId || !sessionId) {
    return { success: false, error: "Invalid user or session" };
  }

  // Get wallets
  const userWallet = getUserWallet(userId);
  const houseWallet = getHouseWallet();

  // Validate bet
  const validation = validateBet(betAmount, userWallet, houseWallet);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Calculate max potential payout and reserve house funds
  const maxPayout = calculateMaxPotentialPayout(betAmount);
  
  // Process bet: deduct from user, add to house, reserve funds
  const updatedUser = processBet(userWallet, betAmount);
  const houseWithBet = processHouseReceiveBet(houseWallet, betAmount);
  const houseWithReserve = reserveHouseFunds(houseWithBet, maxPayout);

  // Update wallets
  updateUserWallet(updatedUser);
  updateHouseWallet(houseWithReserve);

  // Create game session
  setGameSession({
    sessionId,
    userId,
    initialBet: betAmount,
    currentTreasure: betAmount,
    diveNumber: 1,
    isActive: true,
    reservedPayout: maxPayout,
    startTime: Date.now(),
  });

  // Record transaction
  addTransaction({
    id: crypto.randomBytes(8).toString('hex'),
    userId,
    type: 'bet',
    amount: betAmount,
    balanceBefore: userWallet.balance,
    balanceAfter: updatedUser.balance,
    gameSessionId: sessionId,
    timestamp: Date.now(),
  });

  return { success: true, sessionId };
}

/**
 * Perform a dive (server-side for security)
 * Uses cryptographically secure random number generation
 * @param testSeed - Optional deterministic seed for testing (format: "0-99")
 */
export async function performDive(
  diveNumber: number,
  currentTreasure: number,
  sessionId: string,
  userId: string,
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

  // Get game session
  const gameSession = getGameSession(sessionId);
  if (!gameSession || !gameSession.isActive) {
    throw new Error("Invalid or inactive game session");
  }

  // If not first dive, validate house can cover increased payout
  if (diveNumber > 1) {
    const houseWallet = getHouseWallet();
    const validation = validateDiveDeeper(gameSession, houseWallet);
    if (!validation.valid) {
      throw new Error(validation.error || "Cannot dive deeper");
    }
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

  // Update game session
  if (survived) {
    gameSession.currentTreasure = totalTreasure;
    gameSession.diveNumber = diveNumber + 1;
    setGameSession(gameSession);
  } else {
    // Game over - release house funds
    gameSession.isActive = false;
    gameSession.endTime = Date.now();
    setGameSession(gameSession);

    const houseWallet = getHouseWallet();
    const houseWithRelease = releaseHouseFunds(houseWallet, gameSession.reservedPayout);
    updateHouseWallet(houseWithRelease);

    // Record loss
    const userWallet = getUserWallet(userId);
    const updatedUser = processLoss(userWallet, gameSession.initialBet);
    updateUserWallet(updatedUser);

    addTransaction({
      id: crypto.randomBytes(8).toString('hex'),
      userId,
      type: 'loss',
      amount: gameSession.initialBet,
      balanceBefore: userWallet.balance,
      balanceAfter: updatedUser.balance,
      gameSessionId: sessionId,
      timestamp: Date.now(),
      metadata: {
        diveNumber,
        depth: stats.depth,
        survived: false,
      },
    });

    deleteGameSession(sessionId);
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
  sessionId: string,
  userId: string
): Promise<{ success: boolean; finalAmount: number; profit: number }> {
  // Validate
  if (finalTreasure <= 0) {
    throw new Error("No treasure to cash out");
  }

  if (!sessionId || !userId) {
    throw new Error("Invalid session or user");
  }

  // Get game session
  const gameSession = getGameSession(sessionId);
  if (!gameSession || !gameSession.isActive) {
    throw new Error("Invalid or inactive game session");
  }

  // Get wallets
  const userWallet = getUserWallet(userId);
  const houseWallet = getHouseWallet();

  // Process win: add to user, deduct from house, release reserves
  const updatedUser = processWin(userWallet, finalTreasure, gameSession.initialBet);
  const updatedHouse = processHousePayout(houseWallet, finalTreasure, gameSession.reservedPayout);

  // Update wallets
  updateUserWallet(updatedUser);
  updateHouseWallet(updatedHouse);

  // Record transaction
  const profit = finalTreasure - gameSession.initialBet;
  addTransaction({
    id: crypto.randomBytes(8).toString('hex'),
    userId,
    type: 'surface',
    amount: finalTreasure,
    balanceBefore: userWallet.balance,
    balanceAfter: updatedUser.balance,
    gameSessionId: sessionId,
    timestamp: Date.now(),
    metadata: {
      diveNumber: gameSession.diveNumber - 1,
      survived: true,
    },
  });

  // End game session
  gameSession.isActive = false;
  gameSession.endTime = Date.now();
  setGameSession(gameSession);
  deleteGameSession(sessionId);

  return {
    success: true,
    finalAmount: finalTreasure,
    profit,
  };
}

/**
 * Generate a new session ID
 */
export async function generateSessionId(): Promise<string> {
  const randomBytes = crypto.randomBytes(16);
  return randomBytes.toString("hex");
}

/**
 * Get user wallet balance and info
 */
export async function getWalletInfo(userId: string): Promise<{
  balance: number;
  totalWagered: number;
  totalWon: number;
  totalLost: number;
  gamesPlayed: number;
  maxBet: number;
  houseBalance: number;
  houseReserved: number;
}> {
  const userWallet = getUserWallet(userId);
  const houseWallet = getHouseWallet();
  
  // Calculate max bet user can make
  const maxBetFromHouse = Math.min(
    userWallet.balance,
    DEFAULT_LIMITS.maxBet,
    calculateMaxPotentialPayout(DEFAULT_LIMITS.minBet) <= (houseWallet.balance - houseWallet.reservedFunds - houseWallet.balance * DEFAULT_LIMITS.houseReserveRatio)
      ? DEFAULT_LIMITS.maxBet
      : DEFAULT_LIMITS.minBet
  );

  return {
    balance: userWallet.balance,
    totalWagered: userWallet.totalWagered,
    totalWon: userWallet.totalWon,
    totalLost: userWallet.totalLost,
    gamesPlayed: userWallet.gamesPlayed,
    maxBet: maxBetFromHouse,
    houseBalance: houseWallet.balance,
    houseReserved: houseWallet.reservedFunds,
  };
}

/**
 * Validate a bet amount before starting game
 */
export async function validateBetAmount(
  betAmount: number,
  userId: string
): Promise<BetValidation> {
  const userWallet = getUserWallet(userId);
  const houseWallet = getHouseWallet();
  return validateBet(betAmount, userWallet, houseWallet);
}

/**
 * Get user transaction history
 */
export async function getTransactionHistory(
  userId: string,
  limit: number = 10
): Promise<Array<{
  id: string;
  type: string;
  amount: number;
  timestamp: number;
  profit?: number;
  diveNumber?: number;
}>> {
  const { getUserTransactions } = await import("@/lib/walletStore");
  const transactions = getUserTransactions(userId, limit);
  
  return transactions.map(t => ({
    id: t.id,
    type: t.type,
    amount: t.amount,
    timestamp: t.timestamp,
    profit: t.type === 'surface' ? t.amount - (t.metadata?.multiplier || 0) : undefined,
    diveNumber: t.metadata?.diveNumber,
  }));
}

/**
 * Get house wallet status
 */
export async function getHouseStatus(): Promise<{
  balance: number;
  reservedFunds: number;
  availableFunds: number;
  totalPaidOut: number;
  totalReceived: number;
  canAcceptBets: boolean;
}> {
  const { getHouseRiskExposure } = await import("@/lib/walletLogic");
  const houseWallet = getHouseWallet();
  const riskInfo = getHouseRiskExposure(houseWallet);
  
  return {
    balance: houseWallet.balance,
    reservedFunds: houseWallet.reservedFunds,
    availableFunds: riskInfo.availableFunds,
    totalPaidOut: houseWallet.totalPaidOut,
    totalReceived: houseWallet.totalReceived,
    canAcceptBets: riskInfo.canAcceptNewBets,
  };
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
