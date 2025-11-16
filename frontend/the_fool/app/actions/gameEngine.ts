"use server";

/**
 * Generic Game Engine Server Actions (Chain-Integrated)
 *
 * Theme-agnostic gambling API that handles:
 * - Session management
 * - Bet placement
 * - Round execution (with cryptographic randomness)
 * - Cashout
 * - Blockchain integration via GameChainPort
 *
 * This can be used for ANY multiplier-based game (diving, space, mining, etc.)
 * 
 * REFACTORED: Now uses GameChainPort for blockchain abstraction
 */

import { GAME_CONFIG as LIB_CONFIG } from "@/lib/constants";
import {
  calculateMaxPotentialPayout,
  calculateRoundStats,
  DEFAULT_CONFIG,
  simulateRound,
  type GameConfig,
  type RoundResult,
  validateBetAmount,
} from "@/lib/gameEngine";
import { getGameChain, GameError, SessionStatus } from "@/lib/ports";
import { dollarsToLamports, lamportsToDollars } from "@/lib/utils/lamports";
import {
  addTransaction,
  deleteGameSession,
  getGameSession,
  getHouseWallet,
  getUserWallet,
  setGameSession,
  updateHouseWallet,
  updateUserWallet,
} from "@/lib/walletStore";
import {
  processBet,
  processHousePayout,
  processHouseReceiveBet,
  processLoss,
  processWin,
  releaseHouseFunds,
  reserveHouseFunds,
  validateBet,
} from "@/lib/walletLogic";
import crypto from "crypto";

// Get chain instance (LocalGameChain or SolanaGameChain)
const chain = getGameChain();

// House authority - used for initializing vault
// In production, this would be an actual Solana pubkey
const HOUSE_AUTHORITY = "house_authority_main";

// Global house vault PDA (initialized on first use)
let houseVaultPDA: string | null = null;

// Server-side game configuration (synced from lib/constants.ts)
const GAME_CONFIG: GameConfig = {
  ...DEFAULT_CONFIG,
  houseEdge: LIB_CONFIG.HOUSE_EDGE,
  baseWinProbability: LIB_CONFIG.BASE_WIN_PROB,
  decayConstant: LIB_CONFIG.DECAY_CONSTANT,
  minWinProbability: LIB_CONFIG.MIN_WIN_PROB,
  minBet: LIB_CONFIG.MIN_BET,
  maxBet: LIB_CONFIG.MAX_BET,
  maxPotentialWin: 100000, // Server-only config (not in client constants)
  maxRounds: 50, // Server-only config (not in client constants)
};

// Validation: Ensure sync in development
if (process.env.NODE_ENV === "development") {
  console.log("[CONFIG] ✅ Server config synced from lib/constants.ts");
  console.log(`[CONFIG] House edge: ${GAME_CONFIG.houseEdge * 100}%`);
  console.log(
    `[CONFIG] Base win prob: ${GAME_CONFIG.baseWinProbability * 100}%`
  );
}

/**
 * Initialize house vault (lazy initialization on first use)
 * This is a one-time operation that creates the house vault PDA
 */
async function ensureHouseVault(): Promise<string> {
  if (houseVaultPDA) {
    return houseVaultPDA;
  }

  try {
    // Check if vault already exists
    const existingVault = await chain.getHouseVault(HOUSE_AUTHORITY);
    if (existingVault) {
      houseVaultPDA = existingVault.vaultPda;
      console.log("[CHAIN] ✅ House vault already initialized:", houseVaultPDA);
      return houseVaultPDA;
    }

    // Initialize new vault
    const { vaultPda } = await chain.initHouseVault({
      houseAuthority: HOUSE_AUTHORITY,
    });
    
    houseVaultPDA = vaultPda;
    console.log("[CHAIN] ✅ House vault initialized:", houseVaultPDA);
    return houseVaultPDA;
  } catch (error) {
    console.error("[CHAIN] ❌ Failed to initialize house vault:", error);
    throw new Error("Failed to initialize house vault");
  }
}

/**
 * Start a new game session (place initial bet)
 * REFACTORED: Now uses GameChainPort
 */
export async function startGameSession(
  betAmount: number,
  userId: string,
  _sessionId: string // Ignored - chain generates PDA
): Promise<{ success: boolean; error?: string; sessionId?: string }> {
  try {
    // Validate bet amount
    const betValidation = validateBetAmount(betAmount, GAME_CONFIG);
    if (!betValidation.valid) {
      return { success: false, error: betValidation.error };
    }

    // Validate user
    if (!userId) {
      return { success: false, error: "Invalid user ID" };
    }

    // Ensure house vault exists
    const vaultPda = await ensureHouseVault();

    // Get wallets for legacy transaction tracking
    const userWallet = getUserWallet(userId);
    const houseWallet = getHouseWallet();

    // Validate bet against wallet limits
    const validation = validateBet(betAmount, userWallet, houseWallet);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Calculate max potential payout
    const maxPayout = calculateMaxPotentialPayout(
      betAmount,
      GAME_CONFIG.maxRounds,
      GAME_CONFIG
    );

    // Convert to lamports
    const betLamports = dollarsToLamports(betAmount);
    const maxPayoutLamports = dollarsToLamports(maxPayout);

    // Start session on-chain
    const { sessionPda, state } = await chain.startSession({
      userPubkey: userId,
      betAmountLamports: betLamports,
      maxPayoutLamports: maxPayoutLamports,
      houseVaultPda: vaultPda,
    });

    // Update local wallets for legacy tracking (will be removed in Phase 7)
    const updatedUser = processBet(userWallet, betAmount);
    const houseWithBet = processHouseReceiveBet(houseWallet, betAmount);
    const houseWithReserve = reserveHouseFunds(houseWithBet, maxPayout);
    updateUserWallet(updatedUser);
    updateHouseWallet(houseWithReserve);

    // Create local game session for legacy compatibility
    setGameSession({
      sessionId: sessionPda, // Use PDA as session ID
      userId,
      initialBet: betAmount,
      currentTreasure: lamportsToDollars(state.currentTreasure),
      diveNumber: state.diveNumber,
      isActive: true,
      status: "ACTIVE",
      reservedPayout: maxPayout,
      startTime: Date.now(),
    });

    // Record transaction
    addTransaction({
      id: crypto.randomBytes(8).toString("hex"),
      userId,
      type: "bet",
      amount: betAmount,
      balanceBefore: userWallet.balance,
      balanceAfter: updatedUser.balance,
      gameSessionId: sessionPda,
      timestamp: Date.now(),
    });

    console.log(`[CHAIN] ✅ Session started: ${sessionPda}`);
    return { success: true, sessionId: sessionPda };

  } catch (error) {
    console.error("[CHAIN] ❌ Failed to start session:", error);
    
    if (GameError.isGameError(error)) {
      return { success: false, error: error.message };
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to start game session",
    };
  }
}

/**
 * Execute a round (server-side for security and fairness)
 * Uses cryptographically secure random number generation
 * REFACTORED: Now uses GameChainPort
 *
 * @param roundNumber - Current round number (1-indexed)
 * @param currentValue - Current accumulated value
 * @param sessionId - Game session PDA
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

  if (!sessionId || !userId) {
    throw new Error("Invalid session or user ID");
  }

  // Get session state from chain
  const sessionState = await chain.getSession(sessionId);
  
  console.log(`[CHAIN] 🔍 Fetched session state:`, {
    found: !!sessionState,
    status: sessionState?.status,
    diveNumber: sessionState?.diveNumber,
    treasureLamports: sessionState?.currentTreasure?.toString(),
    treasureDollars: sessionState ? lamportsToDollars(sessionState.currentTreasure) : 'N/A',
  });
  
  if (!sessionState || sessionState.status !== SessionStatus.Active) {
    console.error(`[CHAIN] ❌ Session not found or inactive: ${sessionId}`);
    throw new Error("Invalid or inactive game session");
  }

  // Validate session belongs to user
  if (sessionState.user !== userId) {
    console.error(`[CHAIN] ❌ Wrong user: session.user=${sessionState.user}, userId=${userId}`);
    throw new Error("Session does not belong to user");
  }

  // Get local session for legacy data
  const gameSession = getGameSession(sessionId);
  if (!gameSession || gameSession.status !== "ACTIVE") {
    console.error(`[CHAIN] ❌ Local session missing or inactive: ${sessionId}`);
    throw new Error("Local session data missing");
  }

  // SECURITY: Validate round number matches chain state
  if (roundNumber !== sessionState.diveNumber) {
    console.error(`[CHAIN] ❌ Round mismatch: expected ${sessionState.diveNumber}, got ${roundNumber}`);
    throw new Error(
      `Round number mismatch: chain expects ${sessionState.diveNumber}, client sent ${roundNumber}. Please refresh.`
    );
  }

  // SECURITY: Validate currentValue matches chain state
  const expectedValue = lamportsToDollars(sessionState.currentTreasure);
  const tolerance = 0.01; // Allow 1 cent difference due to rounding
  
  console.log(`[CHAIN] 🔍 Value validation:`, {
    expectedValue,
    currentValue,
    difference: Math.abs(currentValue - expectedValue),
    tolerance,
  });
  
  if (Math.abs(currentValue - expectedValue) > tolerance) {
    console.error(`[CHAIN] ❌ Value mismatch: chain=$${expectedValue}, client=$${currentValue}, round=${roundNumber}`);
    throw new Error(
      `Current value mismatch: chain has $${expectedValue.toFixed(2)}, client sent $${currentValue.toFixed(2)}. Data corruption detected.`
    );
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

  // Simulate round outcome (server calculates)
  const result = simulateRound(
    roundNumber,
    currentValue,
    randomRoll,
    GAME_CONFIG
  );

  try {
    if (result.survived) {
      // Player survived - update chain state
      const newTreasureLamports = dollarsToLamports(result.totalValue);
      const newDiveNumber = roundNumber + 1;

      const updatedState = await chain.playRound({
        sessionPda: sessionId,
        userPubkey: userId,
        newTreasureLamports,
        newDiveNumber,
      });

      // Update local session
      gameSession.currentTreasure = lamportsToDollars(updatedState.currentTreasure);
      gameSession.diveNumber = updatedState.diveNumber;
      setGameSession(gameSession);

      console.log(`[CHAIN] ✅ Round ${roundNumber} survived: $${result.totalValue}`);

    } else {
      // Player lost - mark as lost on-chain
      await chain.loseSession({
        sessionPda: sessionId,
        userPubkey: userId,
      });

      // Update local session
      gameSession.isActive = false;
      gameSession.status = "LOST";
      gameSession.endTime = Date.now();
      setGameSession(gameSession);

      // Release house funds (legacy tracking)
      const houseWallet = getHouseWallet();
      const houseWithRelease = releaseHouseFunds(
        houseWallet,
        gameSession.reservedPayout
      );
      updateHouseWallet(houseWithRelease);

      // Record loss
      const userWallet = getUserWallet(userId);
      const updatedUser = processLoss(userWallet, gameSession.initialBet);
      updateUserWallet(updatedUser);

      addTransaction({
        id: crypto.randomBytes(8).toString("hex"),
        userId,
        type: "loss",
        amount: gameSession.initialBet,
        balanceBefore: userWallet.balance,
        balanceAfter: updatedUser.balance,
        gameSessionId: sessionId,
        timestamp: Date.now(),
        metadata: {
          roundNumber,
          diveNumber: roundNumber,
          survived: false,
        },
      });

      deleteGameSession(sessionId);
      console.log(`[CHAIN] ❌ Round ${roundNumber} lost`);
    }

    return result;

  } catch (error) {
    console.error("[CHAIN] ❌ Failed to execute round:", error);
    
    if (GameError.isGameError(error)) {
      throw new Error(`Chain error: ${error.message}`);
    }
    
    throw error;
  }
}

/**
 * Cash out (end game and collect winnings)
 * REFACTORED: Now uses GameChainPort
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

  // Get session state from chain
  const sessionState = await chain.getSession(sessionId);
  if (!sessionState || sessionState.status !== SessionStatus.Active) {
    throw new Error("Invalid or inactive game session");
  }

  // Validate session belongs to user
  if (sessionState.user !== userId) {
    throw new Error("Session does not belong to user");
  }

  // Get local session for legacy data
  const gameSession = getGameSession(sessionId);
  if (!gameSession || gameSession.status !== "ACTIVE") {
    throw new Error("Local session data missing");
  }

  // SECURITY: Validate cash-out amount matches chain state
  const chainTreasure = lamportsToDollars(sessionState.currentTreasure);
  if (Math.abs(finalValue - chainTreasure) > 0.01) {
    throw new Error(
      `Cash-out mismatch: Chain has $${chainTreasure}, attempting to cash out $${finalValue}. Please contact support.`
    );
  }

  try {
    // Cash out on-chain
    const { finalTreasureLamports, state } = await chain.cashOut({
      sessionPda: sessionId,
      userPubkey: userId,
    });

    const actualFinalAmount = lamportsToDollars(finalTreasureLamports);
    const profit = actualFinalAmount - gameSession.initialBet;

    // Update local wallets (legacy tracking)
    const userWallet = getUserWallet(userId);
    const houseWallet = getHouseWallet();

    const updatedUser = processWin(
      userWallet,
      actualFinalAmount,
      gameSession.initialBet
    );
    const updatedHouse = processHousePayout(
      houseWallet,
      actualFinalAmount,
      gameSession.reservedPayout
    );

    updateUserWallet(updatedUser);
    updateHouseWallet(updatedHouse);

    // Record transaction
    addTransaction({
      id: crypto.randomBytes(8).toString("hex"),
      userId,
      type: "cashout",
      amount: actualFinalAmount,
      balanceBefore: userWallet.balance,
      balanceAfter: updatedUser.balance,
      gameSessionId: sessionId,
      timestamp: Date.now(),
      metadata: {
        roundNumber: gameSession.diveNumber - 1,
        diveNumber: gameSession.diveNumber - 1,
        survived: true,
        profit,
      },
    });

    // End local session
    gameSession.isActive = false;
    gameSession.status = "CASHED_OUT";
    gameSession.endTime = Date.now();
    setGameSession(gameSession);
    deleteGameSession(sessionId);

    console.log(`[CHAIN] ✅ Cashed out: $${actualFinalAmount} (profit: $${profit})`);

    return {
      success: true,
      finalAmount: actualFinalAmount,
      profit,
    };

  } catch (error) {
    console.error("[CHAIN] ❌ Failed to cash out:", error);
    
    if (GameError.isGameError(error)) {
      throw new Error(`Chain error: ${error.message}`);
    }
    
    throw error;
  }
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
 * UPDATED: Includes chain state info
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
  chainHouseBalance?: number; // From chain state
  chainHouseReserved?: number; // From chain state
}> {
  const userWallet = getUserWallet(userId);
  const houseWallet = getHouseWallet();

  // Try to get chain state if available
  let chainHouseBalance: number | undefined;
  let chainHouseReserved: number | undefined;

  try {
    if (houseVaultPDA) {
      const vaultState = await chain.getHouseVault(houseVaultPDA);
      if (vaultState) {
        chainHouseBalance = lamportsToDollars(
          await getChainVaultBalance(houseVaultPDA)
        );
        chainHouseReserved = lamportsToDollars(vaultState.totalReserved);
      }
    }
  } catch (error) {
    // Chain state unavailable - not critical
    console.warn("[CHAIN] Could not fetch vault state:", error);
  }

  return {
    balance: userWallet.balance,
    totalWagered: userWallet.totalWagered,
    totalWon: userWallet.totalWon,
    totalLost: userWallet.totalLost,
    gamesPlayed: userWallet.gamesPlayed,
    maxBet: Math.min(GAME_CONFIG.maxBet, userWallet.balance),
    houseBalance: houseWallet.balance,
    houseReserved: houseWallet.reservedFunds,
    chainHouseBalance,
    chainHouseReserved,
  };
}

/**
 * Helper: Get vault balance from chain
 * In LocalGameChain, this is simulated. In SolanaGameChain, it's the actual SOL balance.
 */
async function getChainVaultBalance(vaultPda: string): Promise<bigint> {
  // For LocalGameChain, we can query the test balance
  // For SolanaGameChain, this would query connection.getBalance()
  const vault = await chain.getHouseVault(vaultPda);
  if (!vault) {
    return BigInt(0);
  }
  
  // For now, approximate as reserved funds (will be improved in Phase 7)
  return vault.totalReserved;
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
