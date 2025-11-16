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
  setGameSession,
} from "@/lib/walletStore";
import {
  getUserStats,
  recordBet,
  recordWin,
  recordLoss,
} from "@/lib/userStats";
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
  try {
    console.log("[CHAIN] 🏦 ensureHouseVault() called");
    console.log("[CHAIN] 📊 Current cached PDA:", houseVaultPDA || "(null)");

    // Import PDA derivation function
    const { mockHouseVaultPDA } = await import("@/lib/solana/pdas");

    // Derive the vault PDA
    const derivedVaultPDA = mockHouseVaultPDA(HOUSE_AUTHORITY);
    console.log("[CHAIN] 🔑 Derived vault PDA:", derivedVaultPDA);

    // Check if vault already exists (even if we have a cached PDA)
    console.log("[CHAIN] 🔍 Checking if vault exists...");
    const existingVault = await chain.getHouseVault(derivedVaultPDA);

    if (existingVault) {
      houseVaultPDA = existingVault.vaultPda;
      console.log("[CHAIN] ✅ House vault already initialized:", houseVaultPDA);
      console.log("[CHAIN] 📊 Vault state:", {
        locked: existingVault.locked,
        totalReserved: existingVault.totalReserved.toString(),
      });
      return houseVaultPDA;
    }

    // Initialize new vault (clear any stale cached PDA first)
    console.log("[CHAIN] 🆕 Vault doesn't exist - initializing new vault...");
    houseVaultPDA = null;
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

    // Get user balance from chain
    const userBalanceLamports = await chain.getUserBalance(userId);
    const userBalance = lamportsToDollars(userBalanceLamports);

    // Get house vault state from chain
    const houseVault = await chain.getHouseVault(vaultPda);
    if (!houseVault) {
      return { success: false, error: "House vault not initialized" };
    }
    const houseBalanceLamports = await chain.getVaultBalance(vaultPda);
    const houseBalance = lamportsToDollars(houseBalanceLamports);
    const houseReserved = lamportsToDollars(houseVault.totalReserved);
    const houseAvailable = houseBalance - houseReserved;

    // Validate bet amount
    if (betAmount < GAME_CONFIG.minBet) {
      return { success: false, error: `Minimum bet is $${GAME_CONFIG.minBet}` };
    }
    if (betAmount > GAME_CONFIG.maxBet) {
      return { success: false, error: `Maximum bet is $${GAME_CONFIG.maxBet}` };
    }
    if (betAmount > userBalance) {
      return { success: false, error: "Insufficient balance" };
    }

    // Calculate max potential payout
    const maxPayout = calculateMaxPotentialPayout(
      betAmount,
      GAME_CONFIG.maxRounds,
      GAME_CONFIG
    );

    // Validate house can cover max payout
    if (maxPayout > houseAvailable) {
      return {
        success: false,
        error: "House cannot cover maximum potential payout. Please bet less.",
      };
    }

    // Convert to lamports
    const betLamports = dollarsToLamports(betAmount);
    const maxPayoutLamports = dollarsToLamports(maxPayout);

    // Start session on-chain (this handles the actual money transfer)
    const { sessionPda, state } = await chain.startSession({
      userPubkey: userId,
      betAmountLamports: betLamports,
      maxPayoutLamports: maxPayoutLamports,
      houseVaultPda: vaultPda,
    });

    // Record statistics (NOT wallet balance - that's on chain)
    recordBet(userId, betAmount);

    // Create local game session for tracking
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

    // Get updated balance for transaction record
    const newUserBalanceLamports = await chain.getUserBalance(userId);
    const newUserBalance = lamportsToDollars(newUserBalanceLamports);

    // Record transaction
    addTransaction({
      id: crypto.randomBytes(8).toString("hex"),
      userId,
      type: "bet",
      amount: betAmount,
      balanceBefore: userBalance,
      balanceAfter: newUserBalance,
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
      error:
        error instanceof Error ? error.message : "Failed to start game session",
    };
  }
}

/**
 * Execute a round (place bet and get result)
 *
 * REFACTORED: Now uses ON-CHAIN RNG via GameChainPort
 *
 * CRITICAL SECURITY CHANGE:
 * - Server NO LONGER generates RNG or computes outcomes
 * - Contract now does RNG internally (VRF-based or slot-hash)
 * - Server is just a VIEWER - it calls playRound() and reports the result
 * - NO client input for outcome (prevents 100% of cheating exploits)
 *
 * @param roundNumber - Current round number (1-indexed) - for validation only
 * @param currentValue - Current accumulated value - for validation only
 * @param sessionId - Game session PDA
 * @param userId - User ID
 * @param testSeed - DEPRECATED - chain now controls RNG
 * @returns Round result with survival status and new value (from chain)
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
    treasureDollars: sessionState
      ? lamportsToDollars(sessionState.currentTreasure)
      : "N/A",
  });

  if (!sessionState || sessionState.status !== SessionStatus.Active) {
    console.error(`[CHAIN] ❌ Session not found or inactive: ${sessionId}`);
    throw new Error("Invalid or inactive game session");
  }

  // Validate session belongs to user
  if (sessionState.user !== userId) {
    console.error(
      `[CHAIN] ❌ Wrong user: session.user=${sessionState.user}, userId=${userId}`
    );
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
    console.error(
      `[CHAIN] ❌ Round mismatch: expected ${sessionState.diveNumber}, got ${roundNumber}`
    );
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
    console.error(
      `[CHAIN] ❌ Value mismatch: chain=$${expectedValue}, client=$${currentValue}, round=${roundNumber}`
    );
    throw new Error(
      `Current value mismatch: chain has $${expectedValue.toFixed(2)}, client sent $${currentValue.toFixed(2)}. Data corruption detected.`
    );
  }

  // ===== NEW ON-CHAIN RNG MODEL =====
  // Contract now generates RNG internally and computes outcome
  // Server is just a VIEWER - it calls playRound() and gets the result
  console.log(
    `[CHAIN] 🎲 Calling playRound() - contract will determine outcome...`
  );

  try {
    // Call chain to execute round (contract does RNG + outcome computation)
    const chainResult = await chain.playRound({
      sessionPda: sessionId,
      userPubkey: userId,
      // NO client input for outcome - contract determines everything!
    });

    console.log(`[CHAIN] 📊 Chain result:`, {
      survived: chainResult.survived,
      randomRoll: chainResult.randomRoll,
      newStatus: chainResult.state.status,
      newDiveNumber: chainResult.state.diveNumber,
      newTreasure: lamportsToDollars(chainResult.state.currentTreasure),
    });

    // Update local session with chain's outcome
    gameSession.currentTreasure = lamportsToDollars(
      chainResult.state.currentTreasure
    );
    gameSession.diveNumber = chainResult.state.diveNumber;

    if (chainResult.survived) {
      // Player survived
      setGameSession(gameSession);
      console.log(
        `[CHAIN] ✅ Round ${roundNumber} survived: $${gameSession.currentTreasure}`
      );
    } else {
      // Player lost (chain already updated status to Lost and released funds)
      gameSession.isActive = false;
      gameSession.status = "LOST";
      gameSession.endTime = Date.now();
      setGameSession(gameSession);

      // Record loss in statistics
      recordLoss(userId, gameSession.initialBet);

      // Get balances for transaction record
      const userBalanceBefore = lamportsToDollars(
        await chain.getUserBalance(userId)
      );

      // Transaction record (balance unchanged because player lost the bet at start)
      addTransaction({
        id: crypto.randomBytes(8).toString("hex"),
        userId,
        type: "loss",
        amount: gameSession.initialBet,
        balanceBefore: userBalanceBefore,
        balanceAfter: userBalanceBefore, // No change - money was taken at bet time
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

    // Build RoundResult for server response (matches old format)
    const roundStats = calculateRoundStats(roundNumber, GAME_CONFIG);
    const result: RoundResult = {
      success: chainResult.survived,
      survived: chainResult.survived,
      randomRoll: chainResult.randomRoll ?? 0,
      threshold: Math.floor(roundStats.winProbability * 100),
      winProbability: roundStats.winProbability,
      multiplier: roundStats.multiplier,
      newValue:
        lamportsToDollars(chainResult.state.currentTreasure) - currentValue,
      totalValue: lamportsToDollars(chainResult.state.currentTreasure),
      roundNumber,
      timestamp: Date.now(),
    };

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

    // Record win in statistics
    recordWin(userId, profit);

    // Get balances for transaction record
    const userBalanceBefore = lamportsToDollars(
      await chain.getUserBalance(userId)
    );

    // Record transaction
    addTransaction({
      id: crypto.randomBytes(8).toString("hex"),
      userId,
      type: "cashout",
      amount: actualFinalAmount,
      balanceBefore: userBalanceBefore - actualFinalAmount, // Before cashout
      balanceAfter: userBalanceBefore, // After cashout
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

    console.log(
      `[CHAIN] ✅ Cashed out: $${actualFinalAmount} (profit: $${profit})`
    );

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
  // Get user balance from chain
  const userBalanceLamports = await chain.getUserBalance(userId);
  const balance = lamportsToDollars(userBalanceLamports);

  // Get user statistics (NOT from chain - tracked separately)
  const stats = getUserStats(userId);

  // Get house vault state from chain
  let houseBalance = 0;
  let houseReserved = 0;

  try {
    if (houseVaultPDA) {
      const vaultState = await chain.getHouseVault(houseVaultPDA);
      if (vaultState) {
        const vaultBalanceLamports = await chain.getVaultBalance(houseVaultPDA);
        houseBalance = lamportsToDollars(vaultBalanceLamports);
        houseReserved = lamportsToDollars(vaultState.totalReserved);
      }
    }
  } catch (error) {
    console.warn("[CHAIN] Could not fetch vault state:", error);
  }

  return {
    balance,
    totalWagered: stats.totalWagered,
    totalWon: stats.totalWon,
    totalLost: stats.totalLost,
    gamesPlayed: stats.gamesPlayed,
    maxBet: Math.min(GAME_CONFIG.maxBet, balance),
    houseBalance,
    houseReserved,
    chainHouseBalance: houseBalance, // Same as houseBalance now
    chainHouseReserved: houseReserved, // Same as houseReserved now
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
  // Get house vault state from chain
  let balance = 0;
  let reservedFunds = 0;
  let availableFunds = 0;

  try {
    if (houseVaultPDA) {
      const vaultState = await chain.getHouseVault(houseVaultPDA);
      if (vaultState) {
        const vaultBalanceLamports = await chain.getVaultBalance(houseVaultPDA);
        balance = lamportsToDollars(vaultBalanceLamports);
        reservedFunds = lamportsToDollars(vaultState.totalReserved);
        availableFunds = balance - reservedFunds;
      }
    }
  } catch (error) {
    console.warn("[CHAIN] Could not fetch house vault state:", error);
  }

  return {
    balance,
    reservedFunds,
    availableFunds,
    totalPaidOut: 0, // Not tracked separately anymore
    totalReceived: 0, // Not tracked separately anymore
    canAcceptBets: availableFunds > GAME_CONFIG.minBet * 10, // Simple heuristic
  };
}
