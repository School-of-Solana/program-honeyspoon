/**
 * GameChainPort - Interface for game session blockchain operations
 *
 * This interface abstracts the blockchain layer, allowing both in-memory
 * and Solana implementations to be swapped without breaking changes.
 *
 * IMPORTANT: This interface matches the actual Anchor contract instructions exactly.
 * Contract: dive-game-chain with 6 instructions
 */

export type SessionHandle = string; // Base58 PDA address

/**
 * Session status enum - matches contract's SessionStatus exactly
 */
export enum SessionStatus {
  Active = "Active",
  Lost = "Lost",
  CashedOut = "CashedOut",
  Expired = "Expired",
}

/**
 * GameSession account state - matches contract's GameSession struct
 *
 * NEW (VRF-based RNG):
 * - rngSeed: 32-byte seed from VRF oracle (Switchboard)
 * - rngCursor: which slice of seed has been consumed (optional)
 */
export interface GameSessionState {
  sessionPda: SessionHandle;
  user: string; // Pubkey as base58
  houseVault: string; // Pubkey as base58
  status: SessionStatus;
  betAmount: bigint; // u64 lamports
  currentTreasure: bigint; // u64 lamports (computed deterministically)
  maxPayout: bigint; // u64 lamports
  diveNumber: number; // u16
  bump: number; // u8
  rngSeed?: Uint8Array; // [u8; 32] VRF seed (if using VRF)
  rngCursor?: number; // u8 cursor into seed stream
}

/**
 * HouseVault account state - matches contract's HouseVault struct
 */
export interface HouseVaultState {
  vaultPda: string;
  houseAuthority: string;
  locked: boolean;
  totalReserved: bigint;
  bump: number;
}

/**
 * GameConfig account state - matches contract's GameConfig struct
 * This is the single source of truth for all game parameters
 */
export interface GameConfigState {
  configPda: string;
  admin: string; // Pubkey
  baseSurvivalPpm: number; // u32 - parts per million (1M = 100%)
  decayPerDivePpm: number; // u32
  minSurvivalPpm: number; // u32
  treasureMultiplierNum: number; // u16
  treasureMultiplierDen: number; // u16
  maxPayoutMultiplier: number; // u16
  maxDives: number; // u16
  minBet: bigint; // u64 lamports
  maxBet: bigint; // u64 lamports
  bump: number; // u8
}

/**
 * Port interface for game session blockchain operations
 */
export interface GameChainPort {
  /**
   * Initialize game configuration (admin only, one-time)
   * Maps to: init_config instruction
   *
   * @throws {GameError} if config already exists
   */
  initGameConfig(params: {
    admin: string; // Pubkey
    baseSurvivalPpm?: number;
    decayPerDivePpm?: number;
    minSurvivalPpm?: number;
    treasureMultiplierNum?: number;
    treasureMultiplierDen?: number;
    maxPayoutMultiplier?: number;
    maxDives?: number;
    minBet?: bigint;
    maxBet?: bigint;
  }): Promise<{
    configPda: string;
    state: GameConfigState;
  }>;

  /**
   * Get game configuration
   * Read-only query for game parameters
   *
   * @returns {GameConfigState} current game config
   * @returns {null} if config doesn't exist
   */
  getGameConfig(): Promise<GameConfigState | null>;

  /**
   * Initialize house vault (admin only, one-time)
   * Maps to: init_house_vault instruction
   *
   * @throws {GameError} if vault already exists
   */
  initHouseVault(params: {
    houseAuthority: string; // Pubkey
  }): Promise<{
    vaultPda: string;
    state: HouseVaultState;
  }>;

  /**
   * Toggle house lock (admin only)
   * Maps to: toggle_house_lock instruction
   *
   * On-chain behavior:
   * - Flips vault.locked boolean
   * - Requires houseAuthority signature
   *
   * @throws {GameError} if wrong authority or vault doesn't exist
   */
  toggleHouseLock(params: {
    vaultPda: string;
    houseAuthority: string;
  }): Promise<HouseVaultState>;

  /**
   * Start a new game session
   * Maps to: start_session instruction
   *
   * On-chain behavior:
   * - Transfers bet_amount lamports from user → house_vault
   * - Creates GameSession PDA
   * - Increments house_vault.total_reserved by max_payout
   * - Sets initial treasure = bet_amount
   * - Sets dive_number = 1
   *
   * @throws {GameError} HOUSE_LOCKED if vault is locked
   * @throws {GameError} INSUFFICIENT_USER_FUNDS if user balance < bet
   * @throws {GameError} INSUFFICIENT_VAULT_BALANCE if vault can't cover reserve
   */
  startSession(params: {
    userPubkey: string;
    betAmountLamports: bigint;
    maxPayoutLamports: bigint;
    houseVaultPda: string;
  }): Promise<{
    sessionPda: SessionHandle;
    state: GameSessionState;
  }>;

  /**
   * Play a round (contract computes outcome with on-chain RNG)
   * Maps to: play_round instruction
   *
   * CRITICAL SECURITY CHANGE:
   * - Contract now does RNG internally (VRF-based or slot-hash)
   * - NO client input for outcome (prevents cheating)
   * - Contract determines: survive/lose + new treasure
   * - Deterministic payout: treasure_for_round(bet, dive)
   *
   * On-chain behavior:
   * 1. Validates session.status == Active
   * 2. Derives random roll from VRF seed + dive_number
   * 3. Computes survival_probability(dive_number)
   * 4. If roll < threshold:
   *    - Survive: increment dive, compute new treasure deterministically
   * 5. Else:
   *    - Lose: status = Lost, release reserved funds
   *
   * @returns Updated session state (may be Active or Lost)
   * @throws {GameError} INVALID_SESSION_STATUS if not active
   * @throws {GameError} WRONG_USER if caller doesn't own session
   */
  playRound(params: {
    sessionPda: SessionHandle;
    userPubkey: string;
    // NO newTreasure / newDiveNumber - contract computes internally!
  }): Promise<{
    state: GameSessionState;
    survived: boolean; // Outcome determined by contract
    randomRoll?: number; // Optional: for transparency/verification
  }>;

  /**
   * DEPRECATED: No longer needed!
   *
   * The lose_session instruction is now handled automatically
   * by playRound() when the on-chain RNG determines a loss.
   *
   * This method remains for backward compatibility with LocalGameChain
   * but will not exist in the final contract.
   */
  loseSession?(params: {
    sessionPda: SessionHandle;
    userPubkey: string;
  }): Promise<GameSessionState>;

  /**
   * Cash out winnings
   * Maps to: cash_out instruction
   *
   * On-chain behavior:
   * - Validates house not locked
   * - Validates session.status == Active
   * - Validates current_treasure > bet_amount (must have profit)
   * - Transfers current_treasure from house_vault → user
   * - Decrements house_vault.total_reserved by max_payout
   * - Sets status = CashedOut
   *
   * @throws {GameError} HOUSE_LOCKED if vault is locked
   * @throws {GameError} INVALID_SESSION_STATUS if not active
   * @throws {GameError} TREASURE_INVALID if no profit
   * @throws {GameError} WRONG_USER if caller doesn't own session
   * @throws {GameError} INSUFFICIENT_VAULT_BALANCE if vault can't pay
   */
  cashOut(params: { sessionPda: SessionHandle; userPubkey: string }): Promise<{
    finalTreasureLamports: bigint;
    state: GameSessionState;
  }>;

  /**
   * Get house vault state
   *
   * @returns {HouseVaultState} current vault state
   * @returns {null} if vault doesn't exist
   */
  getHouseVault(vaultPda: string): Promise<HouseVaultState | null>;

  /**
   * Get session state
   *
   * @returns {GameSessionState} current session state
   * @returns {null} if session doesn't exist
   */
  getSession(sessionPda: SessionHandle): Promise<GameSessionState | null>;

  /**
   * Get user wallet balance
   * Read-only query for user's wallet balance
   *
   * @param userPubkey - User wallet address
   * @returns Balance in lamports
   */
  getUserBalance(userPubkey: string): Promise<bigint>;

  /**
   * Get vault balance
   * Read-only query for vault's balance
   *
   * @param vaultPda - Vault PDA address
   * @returns Balance in lamports
   */
  getVaultBalance(vaultPda: string): Promise<bigint>;
}
