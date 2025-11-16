/**
 * LocalGameChain - In-memory implementation of GameChainPort
 * 
 * This implementation simulates the Anchor contract behavior exactly.
 * Every validation, error, and state transition mirrors the on-chain contract.
 * 
 * Purpose:
 * - Testing without deploying to blockchain
 * - Development before contract is ready
 * - Fast unit tests
 * 
 * IMPORTANT: This must behave identically to SolanaGameChain
 */

import {
  GameChainPort,
  SessionStatus,
  GameSessionState,
  HouseVaultState,
  SessionHandle,
} from "./GameChainPort";
import { GameError } from "./GameErrors";
import { mockHouseVaultPDA, mockSessionPDA } from "../solana/pdas";

/**
 * Local in-memory implementation that simulates the Anchor contract
 */
export class LocalGameChain implements GameChainPort {
  // In-memory state mimicking on-chain accounts
  private houseVaults = new Map<string, HouseVaultState>();
  private sessions = new Map<string, GameSessionState>();
  private userBalances = new Map<string, bigint>(); // Simulate SOL balances
  private sessionCounter = 0; // For unique session nonces

  constructor(
    private readonly initialHouseBalance: bigint = BigInt(500_000_000_000_000) // 500k SOL in lamports
  ) {}

  /**
   * Helper: Get user balance (creates if doesn't exist)
   */
  private getUserBalance(user: string): bigint {
    if (!this.userBalances.has(user)) {
      // New users start with 1000 SOL in lamports
      this.userBalances.set(user, BigInt(1_000_000_000_000));
    }
    return this.userBalances.get(user)!;
  }

  /**
   * Helper: Set user balance
   */
  private setUserBalance(user: string, balance: bigint): void {
    this.userBalances.set(user, balance);
  }

  /**
   * Helper: Get vault balance
   */
  private getVaultBalance(vaultPda: string): bigint {
    return this.userBalances.get(vaultPda) || BigInt(0);
  }

  /**
   * Helper: Set vault balance
   */
  private setVaultBalance(vaultPda: string, balance: bigint): void {
    this.userBalances.set(vaultPda, balance);
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
    const userBalance = this.getUserBalance(params.userPubkey);
    if (userBalance < params.betAmountLamports) {
      throw GameError.insufficientUserFunds(params.betAmountLamports, userBalance);
    }

    // Check vault can cover the reservation
    const vaultBalance = this.getVaultBalance(params.houseVaultPda);
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
    this.setUserBalance(params.userPubkey, userBalance - params.betAmountLamports);
    this.setVaultBalance(params.houseVaultPda, vaultBalance + params.betAmountLamports);

    // Update vault reserved (mimic contract)
    // Use checked_add to mimic Rust overflow checks
    try {
      vault.totalReserved = this.checkedAdd(vault.totalReserved, params.maxPayoutLamports);
    } catch (e) {
      throw GameError.overflow("total_reserved");
    }

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
    };

    this.sessions.set(sessionPda, state);

    return { sessionPda, state };
  }

  async playRound(params: {
    sessionPda: SessionHandle;
    userPubkey: string;
    newTreasureLamports: bigint;
    newDiveNumber: number;
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

    // Mimic contract validation: round number must be sequential
    const expectedRound = session.diveNumber + 1;
    if (params.newDiveNumber !== expectedRound) {
      throw GameError.roundMismatch(expectedRound, params.newDiveNumber);
    }

    // Mimic contract validation: treasure must be monotonic (non-decreasing)
    if (params.newTreasureLamports < session.currentTreasure) {
      throw GameError.treasureInvalid("treasure decreased (non-monotonic)");
    }

    // Mimic contract validation: treasure <= max_payout
    if (params.newTreasureLamports > session.maxPayout) {
      throw GameError.treasureInvalid("exceeds max payout");
    }

    // Update session (mimic contract)
    session.currentTreasure = params.newTreasureLamports;
    session.diveNumber = params.newDiveNumber;

    return session;
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
      vault.totalReserved = this.checkedSub(vault.totalReserved, session.maxPayout);
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

    // Mimic contract validation: current_treasure > bet_amount (must have profit)
    // NOTE: Check with contract if this validation exists!
    if (session.currentTreasure <= session.betAmount) {
      throw GameError.treasureInvalid("no profit to cash out");
    }

    // Check vault has sufficient balance
    const vaultBalance = this.getVaultBalance(session.houseVault);
    if (vaultBalance < session.currentTreasure) {
      throw GameError.insufficientVaultBalance();
    }

    // Transfer: vault → user (mimic contract)
    this.setVaultBalance(session.houseVault, vaultBalance - session.currentTreasure);
    const userBalance = this.getUserBalance(params.userPubkey);
    this.setUserBalance(params.userPubkey, userBalance + session.currentTreasure);

    // Update vault reserved (mimic contract checked_sub)
    try {
      vault.totalReserved = this.checkedSub(vault.totalReserved, session.maxPayout);
    } catch (e) {
      throw GameError.overflow("total_reserved underflow");
    }

    // Update session status (mimic contract)
    session.status = SessionStatus.CashedOut;

    return {
      finalTreasureLamports: session.currentTreasure,
      state: session,
    };
  }

  async getHouseVault(vaultPda: string): Promise<HouseVaultState | null> {
    return this.houseVaults.get(vaultPda) || null;
  }

  async getSession(sessionPda: SessionHandle): Promise<GameSessionState | null> {
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

  // ===== Testing helpers (not part of contract interface) =====

  /**
   * Set user balance (for testing)
   */
  setTestUserBalance(user: string, balance: bigint): void {
    this.userBalances.set(user, balance);
  }

  /**
   * Get user balance (for testing)
   */
  getTestUserBalance(user: string): bigint {
    return this.getUserBalance(user);
  }

  /**
   * Reset all state (for testing)
   */
  resetState(): void {
    this.houseVaults.clear();
    this.sessions.clear();
    this.userBalances.clear();
    this.sessionCounter = 0;
  }
}
