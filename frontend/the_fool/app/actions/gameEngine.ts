"use server";

/**
 * Generic Game Engine Server Actions
 * 
 * Theme-agnostic gambling API that handles:
 * - Session management
 * - Bet placement
 * - Round execution (with cryptographic randomness)
 * - Cashout
 * - Wallet management
 * 
 * This can be used for ANY multiplier-based game (diving, space, mining, etc.)
 */

import crypto from "crypto";
import { 
  calculateRoundStats, 
  simulateRound,
  calculateMaxPotentialPayout,
  validateBetAmount,
  DEFAULT_CONFIG,
  type GameConfig,
  type RoundResult 
} from "@/lib/gameEngine";
import { 
  validateBet, 
  processBet,
  processWin,
  processLoss,
  processHousePayout,
  processHouseReceiveBet,
  reserveHouseFunds,
  releaseHouseFunds,
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

// Game configuration (can be customized per game theme)
const GAME_CONFIG: GameConfig = {
  ...DEFAULT_CONFIG,
  houseEdge: 0.15, // 15% house edge
  baseWinProbability: 0.95,
  decayConstant: 0.15,
  minWinProbability: 0.01,
  minBet: 10,
  maxBet: 500,
  maxPotentialWin: 100000,
  maxRounds: 50,
};

/**
 * Start a new game session (place initial bet)
 */
export async function startGameSession(
  betAmount: number,
  userId: string,
  sessionId: string
): Promise<{ success: boolean; error?: string; sessionId?: string }> {
  // Validate bet amount
  const betValidation = validateBetAmount(betAmount, GAME_CONFIG);
  if (!betValidation.valid) {
    return { success: false, error: betValidation.error };
  }

  // Validate user/session
  if (!userId || !sessionId) {
    return { success: false, error: "Invalid user or session" };
  }

  // Get wallets
  const userWallet = getUserWallet(userId);
  const houseWallet = getHouseWallet();

  // Validate bet against wallet limits
  const validation = validateBet(betAmount, userWallet, houseWallet);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Calculate max potential payout and reserve house funds
  const maxPayout = calculateMaxPotentialPayout(betAmount, 10, GAME_CONFIG); // Reserve for 10 rounds
  
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
    currentTreasure: 0, // Start at 0, first dive will multiply the bet amount
    diveNumber: 1, // Round 1
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
 * Execute a round (server-side for security and fairness)
 * Uses cryptographically secure random number generation
 * 
 * @param roundNumber - Current round number (1-indexed)
 * @param currentValue - Current accumulated value
 * @param sessionId - Game session ID
 * @param userId - User ID
 * @param testSeed - Optional deterministic seed for testing (0-99)
 * @returns Round result with survival status and new value
 */
export async function executeRound(
  roundNumber: number,
  currentValue: number,
  sessionId: string,
  userId: string,
  testSeed?: string
): Promise<RoundResult> {
  // Validate inputs
  if (roundNumber < 1 || roundNumber > GAME_CONFIG.maxRounds) {
    throw new Error(`Invalid round number (1-${GAME_CONFIG.maxRounds})`);
  }

  if (currentValue < 0) {
    throw new Error("Invalid current value");
  }

  if (!sessionId || sessionId.length < 10) {
    throw new Error("Invalid session ID");
  }

  // Get game session
  const gameSession = getGameSession(sessionId);
  if (!gameSession || !gameSession.isActive) {
    throw new Error("Invalid or inactive game session");
  }

  // Validate session belongs to user
  if (gameSession.userId !== userId) {
    throw new Error("Session does not belong to user");
  }

  // Generate cryptographically secure random number (0-99)
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

  // Simulate round outcome
  const result = simulateRound(roundNumber, currentValue, randomRoll, GAME_CONFIG);

  // Update game session based on outcome
  if (result.survived) {
    // Player survived - update session
    gameSession.currentTreasure = result.totalValue;
    gameSession.diveNumber = roundNumber + 1;
    setGameSession(gameSession);
  } else {
    // Player lost - end game and release house funds
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
        roundNumber,
        diveNumber: roundNumber, // Legacy compatibility
        survived: false,
      },
    });

    deleteGameSession(sessionId);
  }

  return result;
}

/**
 * Cash out (end game and collect winnings)
 */
export async function cashOut(
  finalValue: number,
  sessionId: string,
  userId: string
): Promise<{ success: boolean; finalAmount: number; profit: number }> {
  // Validate
  if (finalValue <= 0) {
    throw new Error("No value to cash out");
  }

  if (!sessionId || !userId) {
    throw new Error("Invalid session or user");
  }

  // Get game session
  const gameSession = getGameSession(sessionId);
  if (!gameSession || !gameSession.isActive) {
    throw new Error("Invalid or inactive game session");
  }

  // Validate session belongs to user
  if (gameSession.userId !== userId) {
    throw new Error("Session does not belong to user");
  }

  // SECURITY: Validate cash-out amount matches session treasure
  // This prevents client tampering (sending inflated finalValue)
  if (finalValue !== gameSession.currentTreasure) {
    throw new Error(
      `Cash-out amount (${finalValue}) doesn't match session treasure (${gameSession.currentTreasure})`
    );
  }

  // Get wallets
  const userWallet = getUserWallet(userId);
  const houseWallet = getHouseWallet();

  // Process win: add to user, deduct from house, release reserves
  const updatedUser = processWin(userWallet, finalValue, gameSession.initialBet);
  const updatedHouse = processHousePayout(houseWallet, finalValue, gameSession.reservedPayout);

  // Update wallets
  updateUserWallet(updatedUser);
  updateHouseWallet(updatedHouse);

  // Record transaction
  const profit = finalValue - gameSession.initialBet;
  addTransaction({
    id: crypto.randomBytes(8).toString('hex'),
    userId,
    type: 'cashout',
    amount: finalValue,
    balanceBefore: userWallet.balance,
    balanceAfter: updatedUser.balance,
    gameSessionId: sessionId,
    timestamp: Date.now(),
    metadata: {
      roundNumber: gameSession.diveNumber - 1,
      diveNumber: gameSession.diveNumber - 1, // Legacy compatibility
      survived: true,
      profit,
    },
  });

  // End game session
  gameSession.isActive = false;
  gameSession.endTime = Date.now();
  setGameSession(gameSession);
  deleteGameSession(sessionId);

  return {
    success: true,
    finalAmount: finalValue,
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
 * Get round statistics (for display purposes)
 */
export async function getRoundStats(roundNumber: number) {
  return calculateRoundStats(roundNumber, GAME_CONFIG);
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
  
  return {
    balance: userWallet.balance,
    totalWagered: userWallet.totalWagered,
    totalWon: userWallet.totalWon,
    totalLost: userWallet.totalLost,
    gamesPlayed: userWallet.gamesPlayed,
    maxBet: Math.min(GAME_CONFIG.maxBet, userWallet.balance),
    houseBalance: houseWallet.balance,
    houseReserved: houseWallet.reservedFunds,
  };
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
