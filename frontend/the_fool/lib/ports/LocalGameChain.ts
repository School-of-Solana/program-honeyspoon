/**
 * LocalGameChain - localStorage-backed implementation of GameChainPort
 *
 * This implementation simulates the Anchor contract behavior exactly.
 * Every validation, error, and state transition mirrors the on-chain contract.
 *
 * NEW: Uses localStorage to persist wallet balances (simulates Solana wallets)
 *
 * Purpose:
 * - Testing without deploying to blockchain
 * - Development before contract is ready
 * - Fast unit tests with realistic wallet behavior
 *
 * IMPORTANT: This must behave identically to SolanaGameChain
 */

import {
  GameChainPort,
  SessionStatus,
  GameSessionState,
  HouseVaultState,
  SessionHandle,
  GameConfigState,
} from "./GameChainPort";
import { GameError } from "./GameErrors";
import { mockHouseVaultPDA, mockSessionPDA } from "../solana/pdas";
import {
  generateVRFSeed,
  simulateRoundOutcome,
  treasureForRound,
  type GameCurveConfig,
} from "./rng";

// localStorage keys
const STORAGE_KEYS = {
  WALLETS: "local_chain_wallets",
  VAULTS: "local_chain_vaults",
  SESSIONS: "local_chain_sessions",
  COUNTER: "local_chain_session_counter",
};

/**
 * Wallet data stored in localStorage
 */
interface WalletStorage {
  [address: string]: string; // address -> lamports (as string for JSON)
}

/**
 * Server-side in-memory cache (persists across server requests)
 * This solves the SSR problem where each server action gets a fresh LocalGameChain instance
 */
const serverSideCache = {
  wallets: {} as WalletStorage,
  vaults: new Map<string, HouseVaultState>(),
  sessions: new Map<string, GameSessionState>(),
  counter: 0,
};

/**
 * Local localStorage-backed implementation that simulates the Anchor contract
 */
export class LocalGameChain implements GameChainPort {
  // In-memory state mimicking on-chain accounts
  private houseVaults = new Map<string, HouseVaultState>();
  private sessions = new Map<string, GameSessionState>();
  private sessionCounter = 0; // For unique session nonces

  // Game configuration matching contract
  // CRITICAL: Must import from constants to ensure consistency
  private gameConfig: GameCurveConfig = {
    baseWinProbability: 0.7, // 70% survival at round 1 (from lib/constants.ts)
    decayConstant: 0.08, // Gradual difficulty increase (from lib/constants.ts)
    minWinProbability: 0.05, // 5% minimum (from lib/constants.ts)
    houseEdge: 0.05, // 5% house edge (from lib/constants.ts)
  };

  constructor(
    private readonly initialHouseBalance: bigint = BigInt(500_000_000_000_000) // 500k SOL in lamports
  ) {
    // Load persisted state from localStorage
    this.loadState();
  }

  // ===== localStorage persistence methods =====

  /**
   * Load state from localStorage (client) or serverSideCache (server)
   */
  private loadState(): void {
    if (typeof window === "undefined") {
      // Server-side: use in-memory cache
      this.sessionCounter = serverSideCache.counter;
      this.houseVaults = new Map(serverSideCache.vaults);
      this.sessions = new Map(serverSideCache.sessions);
      console.log("[CHAIN] ✅ Loaded state from serverSideCache");
      return;
    }

    // Client-side: use localStorage
    try {
      // Load session counter
      const counterStr = localStorage.getItem(STORAGE_KEYS.COUNTER);
      if (counterStr) {
        this.sessionCounter = parseInt(counterStr, 10);
      }

      // Load vaults
      const vaultsStr = localStorage.getItem(STORAGE_KEYS.VAULTS);
      if (vaultsStr) {
        const vaults = JSON.parse(vaultsStr);
        Object.entries(vaults).forEach(([key, value]) => {
          this.houseVaults.set(key, value as HouseVaultState);
        });
      }

      // Load sessions
      const sessionsStr = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      if (sessionsStr) {
        const sessions = JSON.parse(sessionsStr);
        Object.entries(sessions).forEach(([key, value]: [string, any]) => {
          // Convert lamport strings back to bigint
          const session: GameSessionState = {
            ...value,
            betAmount: BigInt(value.betAmount),
            currentTreasure: BigInt(value.currentTreasure),
            maxPayout: BigInt(value.maxPayout),
          };
          this.sessions.set(key, session);
        });
      }

      console.log("[CHAIN] ✅ Loaded state from localStorage");
    } catch (error) {
      console.warn("[CHAIN] ⚠️ Failed to load state from localStorage:", error);
    }
  }

  /**
   * Save state to localStorage (client) or serverSideCache (server)
   */
  private saveState(): void {
    if (typeof window === "undefined") {
      // Server-side: save to in-memory cache
      serverSideCache.counter = this.sessionCounter;
      serverSideCache.vaults = new Map(this.houseVaults);
      serverSideCache.sessions = new Map(this.sessions);
      return;
    }

    // Client-side: save to localStorage
    try {
      // Save session counter
      localStorage.setItem(STORAGE_KEYS.COUNTER, String(this.sessionCounter));

      // Save vaults
      const vaultsObj: Record<string, HouseVaultState> = {};
      this.houseVaults.forEach((value, key) => {
        vaultsObj[key] = value;
      });
      localStorage.setItem(STORAGE_KEYS.VAULTS, JSON.stringify(vaultsObj));

      // Save sessions (convert bigints to strings for JSON)
      const sessionsObj: Record<string, any> = {};
      this.sessions.forEach((value, key) => {
        sessionsObj[key] = {
          ...value,
          betAmount: value.betAmount.toString(),
          currentTreasure: value.currentTreasure.toString(),
          maxPayout: value.maxPayout.toString(),
        };
      });
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessionsObj));
    } catch (error) {
      console.warn("[CHAIN] ⚠️ Failed to save state to localStorage:", error);
    }
  }

  /**
   * Load wallets from localStorage (client) or serverSideCache (server)
   */
  private loadWallets(): WalletStorage {
    if (typeof window === "undefined") {
      // Server-side: use in-memory cache
      return serverSideCache.wallets;
    }

    // Client-side: use localStorage
    try {
      const walletsStr = localStorage.getItem(STORAGE_KEYS.WALLETS);
      return walletsStr ? JSON.parse(walletsStr) : {};
    } catch {
      return {};
    }
  }

  /**
   * Save wallets to localStorage (client) or serverSideCache (server)
   */
  private saveWallets(wallets: WalletStorage): void {
    if (typeof window === "undefined") {
      // Server-side: save to in-memory cache
      serverSideCache.wallets = wallets;
      return;
    }

    // Client-side: save to localStorage
    try {
      localStorage.setItem(STORAGE_KEYS.WALLETS, JSON.stringify(wallets));
    } catch (error) {
      console.warn("[CHAIN] ⚠️ Failed to save wallets:", error);
    }
  }

  /**
   * Get user balance from localStorage/serverSideCache (implements GameChainPort)
   */
  async getUserBalance(user: string): Promise<bigint> {
    const wallets = this.loadWallets();
    const isServer = typeof window === "undefined";

    if (!wallets[user]) {
      // New users start with 1000 SOL in lamports
      const initialBalance = BigInt(1_000_000_000_000);
      wallets[user] = initialBalance.toString();
      this.saveWallets(wallets);
      console.log(
        `[CHAIN] 💰 Created new wallet for ${user.substring(0, 12)}...: 1000 SOL (${isServer ? "server" : "client"})`
      );
      return initialBalance;
    }

    console.log(
      `[CHAIN] 💵 Loaded existing wallet for ${user.substring(0, 12)}...: ${(Number(wallets[user]) / 1e9).toFixed(2)} SOL (${isServer ? "server" : "client"})`
    );
    return BigInt(wallets[user]);
  }

  /**
   * Helper: Set user balance in localStorage
   */
  private setUserBalance(user: string, balance: bigint): void {
    const wallets = this.loadWallets();
    wallets[user] = balance.toString();
    this.saveWallets(wallets);
  }

  /**
   * Get vault balance from localStorage/serverSideCache (implements GameChainPort)
   */
  async getVaultBalance(vaultPda: string): Promise<bigint> {
    const wallets = this.loadWallets();
    const balance = wallets[vaultPda] ? BigInt(wallets[vaultPda]) : BigInt(0);

    // If balance is 0 and this is the house vault, use the initial balance as fallback
    // This happens when vault hasn't been initialized yet
    if (balance === BigInt(0) && vaultPda.includes("HOUSE_VAULT")) {
      console.log(
        "[CHAIN] ⚠️ Using fallback balance for house vault (not initialized yet)"
      );
      return this.initialHouseBalance;
    }

    return balance;
  }

  /**
   * Helper: Set vault balance in localStorage
   */
  private setVaultBalance(vaultPda: string, balance: bigint): void {
    const wallets = this.loadWallets();
    wallets[vaultPda] = balance.toString();
    this.saveWallets(wallets);
  }

  // ===== Config Methods =====

  /**
   * Initialize game config (not supported in LocalGameChain)
   */
  async initGameConfig(): Promise<any> {
    throw new Error(
      "initGameConfig not supported in LocalGameChain - config is hardcoded"
    );
  }

  /**
   * Get game config (returns hardcoded local config)
   */
  async getGameConfig(): Promise<GameConfigState | null> {
    return {
      configPda: "local_config",
      admin: "local_admin",
      baseSurvivalPpm: Math.round(
        this.gameConfig.baseWinProbability * 1_000_000
      ),
      decayPerDivePpm: Math.round(this.gameConfig.decayConstant * 1_000_000),
      minSurvivalPpm: Math.round(this.gameConfig.minWinProbability * 1_000_000),
      treasureMultiplierNum: 19,
      treasureMultiplierDen: 10,
      maxPayoutMultiplier: 100,
      maxDives: 50,
      minBet: BigInt(100_000_000), // 0.1 SOL
      maxBet: BigInt(10_000_000_000), // 10 SOL
      bump: 0,
    };
  }

  // ===== Contract instruction implementations =====

  async initHouseVault(params: {
    houseAuthority: string;
  }): Promise<{ vaultPda: string; state: HouseVaultState }> {
    // Simulate PDA derivation
    const vaultPda = mockHouseVaultPDA(params.houseAuthority);

    // Mimic "account already in use" error
    if (this.houseVaults.has(vaultPda)) {
      throw new Error("Account already in use");
    }

    // Create vault state
    const state: HouseVaultState = {
      vaultPda,
      houseAuthority: params.houseAuthority,
      locked: false,
      totalReserved: BigInt(0),
      bump: 255, // Simulated bump
    };

    this.houseVaults.set(vaultPda, state);

    // Initialize vault balance
    this.setVaultBalance(vaultPda, this.initialHouseBalance);

    // Persist to localStorage
    this.saveState();

    return { vaultPda, state };
  }

  async toggleHouseLock(params: {
    vaultPda: string;
    houseAuthority: string;
  }): Promise<HouseVaultState> {
    const vault = this.houseVaults.get(params.vaultPda);
    if (!vault) {
      throw new Error("Account does not exist");
    }

    // Mimic has_one = house_authority constraint
    if (vault.houseAuthority !== params.houseAuthority) {
      throw new Error("A has_one constraint was violated");
    }

    // Toggle lock
    vault.locked = !vault.locked;

    // Persist to localStorage
    this.saveState();

    return vault;
  }

  async startSession(params: {
    userPubkey: string;
    betAmountLamports: bigint;
    maxPayoutLamports: bigint;
    houseVaultPda: string;
  }): Promise<{ sessionPda: SessionHandle; state: GameSessionState }> {
    const vault = this.houseVaults.get(params.houseVaultPda);
    if (!vault) {
      throw new Error("Account does not exist");
    }

    // Mimic contract check: !house_vault.locked
    if (vault.locked) {
      throw GameError.houseLocked();
    }

    // Check user has sufficient balance
    const userBalance = await this.getUserBalance(params.userPubkey);
    if (userBalance < params.betAmountLamports) {
      throw GameError.insufficientUserFunds(
        params.betAmountLamports,
        userBalance
      );
    }

    // Check vault can cover the reservation
    const vaultBalance = await this.getVaultBalance(params.houseVaultPda);
    const newReserved = vault.totalReserved + params.maxPayoutLamports;

    // Mimic contract validation: vault must have enough to cover all reservations
    if (vaultBalance < newReserved) {
      throw GameError.insufficientVaultBalance();
    }

    // Simulate PDA derivation with unique nonce
    const sessionNonce = String(this.sessionCounter++);
    const sessionPda = mockSessionPDA(params.userPubkey, sessionNonce);

    // Mimic account already exists check
    if (this.sessions.has(sessionPda)) {
      throw new Error("Account already in use");
    }

    // Transfer: user → vault (mimic contract)
    this.setUserBalance(
      params.userPubkey,
      userBalance - params.betAmountLamports
    );
    this.setVaultBalance(
      params.houseVaultPda,
      vaultBalance + params.betAmountLamports
    );

    // Update vault reserved (mimic contract)
    // Use checked_add to mimic Rust overflow checks
    try {
      vault.totalReserved = this.checkedAdd(
        vault.totalReserved,
        params.maxPayoutLamports
      );
    } catch (e) {
      throw GameError.overflow("total_reserved");
    }

    // Generate VRF seed (in real contract: comes from Switchboard)
    const rngSeed = generateVRFSeed();

    // Create session (mimic contract init)
    const state: GameSessionState = {
      sessionPda,
      user: params.userPubkey,
      houseVault: params.houseVaultPda,
      status: SessionStatus.Active,
      betAmount: params.betAmountLamports,
      currentTreasure: params.betAmountLamports, // Starts equal to bet
      maxPayout: params.maxPayoutLamports,
      diveNumber: 1, // First dive
      bump: 255,
      rngSeed, // VRF seed for deterministic RNG
      rngCursor: 0,
    };

    this.sessions.set(sessionPda, state);

    // Persist to localStorage
    this.saveState();

    console.log(
      `[CHAIN] 🎲 Generated VRF seed for session: ${Array.from(
        rngSeed.slice(0, 4)
      )
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")}...`
    );

    return { sessionPda, state };
  }

  /**
   * NEW SECURITY MODEL: Contract computes outcome with on-chain RNG
   * NO client input for treasure/round - contract decides based on VRF seed
   */
  async playRound(params: {
    sessionPda: SessionHandle;
    userPubkey: string;
  }): Promise<{
    state: GameSessionState;
    survived: boolean;
    randomRoll?: number;
  }> {
    const session = this.sessions.get(params.sessionPda);
    if (!session) {
      throw new Error("Account does not exist");
    }

    // Mimic has_one = user constraint
    if (session.user !== params.userPubkey) {
      throw GameError.wrongUser();
    }

    // Mimic contract validation: status == Active
    if (session.status !== SessionStatus.Active) {
      throw GameError.invalidSessionStatus();
    }

    // Ensure we have VRF seed
    if (!session.rngSeed) {
      throw new Error("Session missing RNG seed");
    }

    // CONTRACT COMPUTES OUTCOME using VRF seed + dive number
    const outcome = simulateRoundOutcome(
      session.rngSeed,
      session.diveNumber,
      session.betAmount,
      this.gameConfig,
      params.sessionPda
    );

    console.log(`[CHAIN] 🎲 Round ${session.diveNumber} outcome:`, {
      roll: outcome.randomRoll,
      threshold: outcome.threshold,
      survived: outcome.survived,
      survivalProb: (outcome.survivalProbability * 100).toFixed(1) + "%",
    });

    if (outcome.survived) {
      // Player survives: update session
      session.currentTreasure = outcome.newTreasure;
      session.diveNumber = outcome.newDiveNumber;

      console.log(
        `[CHAIN] ✅ Survived! New treasure: ${outcome.newTreasure.toString()} lamports`
      );
    } else {
      // Player loses: mark session as lost
      session.status = SessionStatus.Lost;

      // Release house funds (same as loseSession logic)
      const vault = this.houseVaults.get(session.houseVault);
      if (vault) {
        try {
          vault.totalReserved = this.checkedSub(
            vault.totalReserved,
            session.maxPayout
          );
        } catch (e) {
          throw GameError.overflow("total_reserved underflow");
        }
      }

      console.log(`[CHAIN] ❌ Lost! Session ended.`);
    }

    // Persist to localStorage
    this.saveState();

    return {
      state: session,
      survived: outcome.survived,
      randomRoll: outcome.randomRoll,
    };
  }

  async loseSession(params: {
    sessionPda: SessionHandle;
    userPubkey: string;
  }): Promise<GameSessionState> {
    const session = this.sessions.get(params.sessionPda);
    if (!session) {
      throw new Error("Account does not exist");
    }

    // Mimic has_one = user constraint
    if (session.user !== params.userPubkey) {
      throw GameError.wrongUser();
    }

    // Mimic contract validation: status == Active
    if (session.status !== SessionStatus.Active) {
      throw GameError.invalidSessionStatus();
    }

    const vault = this.houseVaults.get(session.houseVault);
    if (!vault) {
      throw new Error("Vault does not exist");
    }

    // Mimic contract: checked_sub (no underflow)
    try {
      vault.totalReserved = this.checkedSub(
        vault.totalReserved,
        session.maxPayout
      );
    } catch (e) {
      throw GameError.overflow("total_reserved underflow");
    }

    // Update session status (mimic contract)
    session.status = SessionStatus.Lost;

    // House keeps the bet (no transfer)

    return session;
  }

  async cashOut(params: {
    sessionPda: SessionHandle;
    userPubkey: string;
  }): Promise<{ finalTreasureLamports: bigint; state: GameSessionState }> {
    const session = this.sessions.get(params.sessionPda);
    if (!session) {
      throw new Error("Account does not exist");
    }

    // Mimic has_one = user constraint
    if (session.user !== params.userPubkey) {
      throw GameError.wrongUser();
    }

    const vault = this.houseVaults.get(session.houseVault);
    if (!vault) {
      throw new Error("Vault does not exist");
    }

    // Mimic contract check: !locked
    if (vault.locked) {
      throw GameError.houseLocked();
    }

    // Mimic contract check: status == Active
    if (session.status !== SessionStatus.Active) {
      throw GameError.invalidSessionStatus();
    }

    // Allow cashing out even at a loss (players should be able to cut losses)
    // Only validate that treasure is positive (has some value to withdraw)
    if (session.currentTreasure <= BigInt(0)) {
      throw GameError.treasureInvalid("no value to cash out");
    }

    // Check vault has sufficient balance
    const vaultBalance = await this.getVaultBalance(session.houseVault);
    if (vaultBalance < session.currentTreasure) {
      throw GameError.insufficientVaultBalance();
    }

    // Transfer: vault → user (mimic contract)
    this.setVaultBalance(
      session.houseVault,
      vaultBalance - session.currentTreasure
    );
    const userBalance = await this.getUserBalance(params.userPubkey);
    this.setUserBalance(
      params.userPubkey,
      userBalance + session.currentTreasure
    );

    // Update vault reserved (mimic contract checked_sub)
    try {
      vault.totalReserved = this.checkedSub(
        vault.totalReserved,
        session.maxPayout
      );
    } catch (e) {
      throw GameError.overflow("total_reserved underflow");
    }

    // Update session status (mimic contract)
    session.status = SessionStatus.CashedOut;

    // Persist to localStorage
    this.saveState();

    return {
      finalTreasureLamports: session.currentTreasure,
      state: session,
    };
  }

  async getHouseVault(vaultPda: string): Promise<HouseVaultState | null> {
    return this.houseVaults.get(vaultPda) || null;
  }

  async getSession(
    sessionPda: SessionHandle
  ): Promise<GameSessionState | null> {
    return this.sessions.get(sessionPda) || null;
  }

  // ===== Arithmetic helpers (mimic Rust checked operations) =====

  private checkedAdd(a: bigint, b: bigint): bigint {
    const result = a + b;
    // BigInt doesn't overflow like Rust's u64, but we can check for logical errors
    if (result < a || result < b) {
      throw new Error("Overflow in checked_add");
    }
    return result;
  }

  private checkedSub(a: bigint, b: bigint): bigint {
    if (b > a) {
      throw new Error("Underflow in checked_sub");
    }
    return a - b;
  }

  // ===== Testing/Debug helpers (not part of contract interface) =====

  /**
   * Set user balance (for testing/debug)
   */
  setTestUserBalance(user: string, balance: bigint): void {
    this.setUserBalance(user, balance);
    console.log(
      `[CHAIN] 💰 Set balance for ${user.substring(0, 12)}...: ${balance.toString()} lamports`
    );
  }

  /**
   * Get user balance (for testing/debug)
   */
  async getTestUserBalance(user: string): Promise<bigint> {
    return await this.getUserBalance(user);
  }

  /**
   * Top up user balance (for debug UI)
   */
  async topUpUserBalance(user: string, amount: bigint): Promise<bigint> {
    const current = await this.getUserBalance(user);
    const newBalance = current + amount;
    this.setUserBalance(user, newBalance);
    console.log(
      `[CHAIN] 💵 Topped up ${user.substring(0, 12)}...: +${amount.toString()} lamports`
    );
    return newBalance;
  }

  /**
   * Top up vault balance (for debug UI)
   */
  async topUpVaultBalance(vaultPda: string, amount: bigint): Promise<bigint> {
    const current = await this.getVaultBalance(vaultPda);
    const newBalance = current + amount;
    this.setVaultBalance(vaultPda, newBalance);
    console.log(
      `[CHAIN] 💵 Topped up vault ${vaultPda.substring(0, 12)}...: +${amount.toString()} lamports`
    );
    return newBalance;
  }

  /**
   * Get all wallet balances (for debug UI)
   */
  getAllWallets(): WalletStorage {
    return this.loadWallets();
  }

  /**
   * Reset all state (for testing)
   */
  resetState(): void {
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEYS.WALLETS);
      localStorage.removeItem(STORAGE_KEYS.VAULTS);
      localStorage.removeItem(STORAGE_KEYS.SESSIONS);
      localStorage.removeItem(STORAGE_KEYS.COUNTER);
    }
    this.houseVaults.clear();
    this.sessions.clear();
    this.sessionCounter = 0;
    console.log("[CHAIN] 🔄 Reset all state");
  }
}
