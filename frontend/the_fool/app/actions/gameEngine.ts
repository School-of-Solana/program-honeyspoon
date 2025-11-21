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
  type GameConfig,
  type RoundResult,
} from "@/lib/gameEngine";
import { getGameChain, GameError, SessionStatus } from "@/lib/ports";
import { solToLamports, lamportsToSol } from "@/lib/utils/solana";
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
// In Solana mode, reads from NEXT_PUBLIC_HOUSE_AUTHORITY env var
// In LocalGameChain mode, uses a mock authority string
const HOUSE_AUTHORITY =
  process.env.NEXT_PUBLIC_HOUSE_AUTHORITY || "house_authority_main";

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
  // Max payout = MAX_BET * MAX_PAYOUT_MULTIPLIER (10 SOL * 100x = 1000 SOL max)
  maxPotentialWin: LIB_CONFIG.MAX_BET * LIB_CONFIG.MAX_PAYOUT_MULTIPLIER,
  maxRounds: LIB_CONFIG.MAX_DIVES, // Use MAX_DIVES from client config
};

// Validation: Ensure sync in development
if (process.env.NODE_ENV === "development") {
  console.log("[CONFIG] OK: Server config synced from lib/constants.ts");
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
    console.log("[CHAIN] Vault: ensureHouseVault() called");
    console.log("[CHAIN] Info: Current cached PDA:", houseVaultPDA || "(null)");
    console.log("[CHAIN] 🏠 House authority:", HOUSE_AUTHORITY);

    // Check if we're in Solana mode
    const useSolana = process.env.NEXT_PUBLIC_USE_SOLANA === "true";

    let derivedVaultPDA: string;

    if (useSolana) {
      // Solana mode: use proper PDA derivation
      const { PublicKey } = await import("@solana/web3.js");
      const { getHouseVaultAddress } = await import("@/lib/solana/pdas");

      const programId = new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID!);
      const houseAuthPubkey = new PublicKey(HOUSE_AUTHORITY);

      const [vaultPda] = getHouseVaultAddress(houseAuthPubkey, programId);
      derivedVaultPDA = vaultPda.toBase58();
      console.log("[CHAIN] 🔑 Derived Solana vault PDA:", derivedVaultPDA);
    } else {
      // LocalGameChain mode: use mock PDA
      const { mockHouseVaultPDA } = await import("@/lib/solana/pdas");
      derivedVaultPDA = mockHouseVaultPDA(HOUSE_AUTHORITY);
      console.log("[CHAIN] 🔑 Derived mock vault PDA:", derivedVaultPDA);
    }

    // Check if vault already exists (even if we have a cached PDA)
    console.log("[CHAIN] 🔍 Checking if vault exists...");
    const existingVault = await chain.getHouseVault(derivedVaultPDA);

    if (existingVault) {
      houseVaultPDA = existingVault.vaultPda;
      console.log(
        "[CHAIN] OK: House vault already initialized:",
        houseVaultPDA
      );
      console.log("[CHAIN] Info: Vault state:", {
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
    console.log("[CHAIN] OK: House vault initialized:", houseVaultPDA);
    return houseVaultPDA;
  } catch (error) {
    console.error("[CHAIN] ERROR: Failed to initialize house vault:", error);
    console.error(
      "[CHAIN] ERROR: Error details:",
      error instanceof Error ? error.message : String(error)
    );
    throw new Error("Failed to initialize house vault");
  }
}

/**
 * Start a new game session (place initial bet)
 * REFACTORED: Now uses GameChainPort
 * NOTE: bet amount is now fixed from config
 */
export async function startGameSession(
  userId: string,
  _sessionId: string // Ignored - chain generates PDA
): Promise<{ success: boolean; error?: string; sessionId?: string }> {
  try {
    // Validate user
    if (!userId) {
      return { success: false, error: "Invalid user ID" };
    }

    // Get fixed bet from config
    const config = await chain.getGameConfig();
    if (!config) {
      return { success: false, error: "Game config not initialized" };
    }
    const betAmount = lamportsToSol(config.fixedBet);

    // Ensure house vault exists
    const vaultPda = await ensureHouseVault();

    // Get user balance from chain
    const userBalanceLamports = await chain.getUserBalance(userId);
    const userBalance = lamportsToSol(userBalanceLamports);

    // Get house vault state from chain
    const houseVault = await chain.getHouseVault(vaultPda);
    if (!houseVault) {
      return { success: false, error: "House vault not initialized" };
    }
    const houseBalanceLamports = await chain.getVaultBalance(vaultPda);
    const houseBalance = lamportsToSol(houseBalanceLamports);
    const houseReserved = lamportsToSol(houseVault.totalReserved);
    const houseAvailable = houseBalance - houseReserved;

    console.log("[CHAIN] Amount: Wallet balances:", {
      userBalance,
      houseBalance,
      houseReserved,
      houseAvailable,
      betAmount,
    });

    // Validate bet amount
    if (betAmount < GAME_CONFIG.minBet) {
      console.log("[CHAIN] ERROR: Bet below minimum:", {
        betAmount,
        minBet: GAME_CONFIG.minBet,
      });
      return { success: false, error: `Minimum bet is ${GAME_CONFIG.minBet}` };
    }
    if (betAmount > GAME_CONFIG.maxBet) {
      console.log("[CHAIN] ERROR: Bet above maximum:", {
        betAmount,
        maxBet: GAME_CONFIG.maxBet,
      });
      return { success: false, error: `Maximum bet is ${GAME_CONFIG.maxBet}` };
    }
    if (betAmount > userBalance) {
      console.log("[CHAIN] ERROR: Insufficient user balance:", {
        betAmount,
        userBalance,
      });
      return { success: false, error: "Insufficient balance" };
    }

    // Calculate max potential payout
    const maxPayout = calculateMaxPotentialPayout(
      betAmount,
      GAME_CONFIG.maxRounds,
      GAME_CONFIG
    );

    console.log("[CHAIN] 🎰 Payout calculation:", {
      betAmount,
      maxRounds: GAME_CONFIG.maxRounds,
      calculatedMaxPayout: maxPayout,
      houseAvailable,
      canCover: maxPayout <= houseAvailable,
    });

    // Validate house can cover max payout
    if (maxPayout > houseAvailable) {
      console.log("[CHAIN] ERROR: House cannot cover payout:", {
        maxPayout,
        houseAvailable,
        shortfall: maxPayout - houseAvailable,
      });
      return {
        success: false,
        error: "House cannot cover maximum potential payout. Please bet less.",
      };
    }

    // Convert to lamports
    const maxPayoutLamports = solToLamports(maxPayout);

    // Start session on-chain (this handles the actual money transfer)
    // NOTE: bet amount now comes from config.fixed_bet
    const { sessionPda, state } = await chain.startSession({
      userPubkey: userId,
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
      currentTreasure: lamportsToSol(state.currentTreasure),
      diveNumber: state.diveNumber,
      isActive: true,
      status: "ACTIVE",
      reservedPayout: maxPayout,
      startTime: Date.now(),
    });

    // Get updated balance for transaction record
    const newUserBalanceLamports = await chain.getUserBalance(userId);
    const newUserBalance = lamportsToSol(newUserBalanceLamports);

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

    console.log(`[CHAIN] OK: Session started: ${sessionPda}`);
    return { success: true, sessionId: sessionPda };
  } catch (error) {
    console.error("[CHAIN] ERROR: Failed to start session:", error);

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
 * Validate session is not expired
 * @throws {Error} if session is expired
 */
function validateSessionNotExpired(session: any): void {
  if (!session.startTime) {
    throw new Error("Session missing start time");
  }

  const now = Date.now();
  const sessionAge = now - session.startTime;
  const timeout = LIB_CONFIG.SESSION_TIMEOUT_MS;

  if (sessionAge > timeout) {
    const minutesOld = Math.floor(sessionAge / 60000);
    const timeoutMinutes = Math.floor(timeout / 60000);
    throw new Error(
      `Session expired (${minutesOld} minutes old, timeout: ${timeoutMinutes} minutes). Please start a new game.`
    );
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
  _testSeed?: string
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
    treasureSol: sessionState
      ? lamportsToSol(sessionState.currentTreasure)
      : "N/A",
  });

  if (!sessionState || sessionState.status !== SessionStatus.Active) {
    console.error(`[CHAIN] ERROR: Session not found or inactive: ${sessionId}`);
    throw new Error("Invalid or inactive game session");
  }

  // Validate session belongs to user
  if (sessionState.user !== userId) {
    console.error(
      `[CHAIN] ERROR: Wrong user: session.user=${sessionState.user}, userId=${userId}`
    );
    throw new Error("Session does not belong to user");
  }

  // Get local session for legacy data
  const gameSession = getGameSession(sessionId);
  if (!gameSession || gameSession.status !== "ACTIVE") {
    console.error(
      `[CHAIN] ERROR: Local session missing or inactive: ${sessionId}`
    );
    throw new Error("Local session data missing");
  }

  // Validate session is not expired
  try {
    validateSessionNotExpired(gameSession);
  } catch (error) {
    // Mark session as expired and clean up
    gameSession.isActive = false;
    gameSession.status = "EXPIRED";
    gameSession.endTime = Date.now();
    setGameSession(gameSession);
    deleteGameSession(sessionId);
    throw error;
  }

  // SECURITY: Validate round number matches chain state
  if (roundNumber !== sessionState.diveNumber) {
    console.error(
      `[CHAIN] ERROR: Round mismatch: expected ${sessionState.diveNumber}, got ${roundNumber}`
    );
    throw new Error(
      `Round number mismatch: chain expects ${sessionState.diveNumber}, client sent ${roundNumber}. Please refresh.`
    );
  }

  // SECURITY: Validate currentValue matches chain state
  const expectedValue = lamportsToSol(sessionState.currentTreasure);
  const tolerance = 0.01; // Allow 1 cent difference due to rounding

  console.log(`[CHAIN] 🔍 Value validation:`, {
    expectedValue,
    currentValue,
    difference: Math.abs(currentValue - expectedValue),
    tolerance,
  });

  if (Math.abs(currentValue - expectedValue) > tolerance) {
    console.error(
      `[CHAIN] ERROR: Value mismatch: chain=${expectedValue}, client=${currentValue}, round=${roundNumber}`
    );
    throw new Error(
      `Current value mismatch: chain has ${expectedValue.toFixed(2)}, client sent ${currentValue.toFixed(2)}. Data corruption detected.`
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

    console.log(`[CHAIN] Info: Chain result:`, {
      survived: chainResult.survived,
      randomRoll: chainResult.randomRoll,
      newStatus: chainResult.state.status,
      newDiveNumber: chainResult.state.diveNumber,
      newTreasure: lamportsToSol(chainResult.state.currentTreasure),
    });

    // Update local session with chain's outcome
    gameSession.currentTreasure = lamportsToSol(
      chainResult.state.currentTreasure
    );
    gameSession.diveNumber = chainResult.state.diveNumber;

    if (chainResult.survived) {
      // Player survived
      setGameSession(gameSession);
      console.log(
        `[CHAIN] OK: Round ${roundNumber} survived: ${gameSession.currentTreasure}`
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
      const userBalanceBefore = lamportsToSol(
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
      console.log(`[CHAIN] ERROR: Round ${roundNumber} lost`);
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
      newValue: lamportsToSol(chainResult.state.currentTreasure) - currentValue,
      totalValue: lamportsToSol(chainResult.state.currentTreasure),
      roundNumber,
      timestamp: Date.now(),
    };

    return result;
  } catch (error) {
    console.error("[CHAIN] ERROR: Failed to execute round:", error);

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

  // Validate session is not expired
  validateSessionNotExpired(gameSession);

  // SECURITY: Validate cash-out amount matches chain state
  const chainTreasure = lamportsToSol(sessionState.currentTreasure);
  if (Math.abs(finalValue - chainTreasure) > 0.01) {
    throw new Error(
      `Cash-out mismatch: Chain has ${chainTreasure}, attempting to cash out ${finalValue}. Please contact support.`
    );
  }

  try {
    // Cash out on-chain
    const { finalTreasureLamports, state: _state } = await chain.cashOut({
      sessionPda: sessionId,
      userPubkey: userId,
    });

    const actualFinalAmount = lamportsToSol(finalTreasureLamports);
    const profit = actualFinalAmount - gameSession.initialBet;

    // Record win in statistics
    recordWin(userId, profit);

    // Get balances for transaction record
    const userBalanceBefore = lamportsToSol(await chain.getUserBalance(userId));

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
      `[CHAIN] OK: Cashed out: ${actualFinalAmount} (profit: ${profit})`
    );

    return {
      success: true,
      finalAmount: actualFinalAmount,
      profit,
    };
  } catch (error) {
    console.error("[CHAIN] ERROR: Failed to cash out:", error);

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
  const balance = lamportsToSol(userBalanceLamports);

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
        houseBalance = lamportsToSol(vaultBalanceLamports);
        houseReserved = lamportsToSol(vaultState.totalReserved);
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
async function _getChainVaultBalance(vaultPda: string): Promise<bigint> {
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
        balance = lamportsToSol(vaultBalanceLamports);
        reservedFunds = lamportsToSol(vaultState.totalReserved);
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
