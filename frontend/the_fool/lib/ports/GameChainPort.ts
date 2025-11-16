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
 */
export interface GameSessionState {
  sessionPda: SessionHandle;
  user: string; // Pubkey as base58
  houseVault: string; // Pubkey as base58
  status: SessionStatus;
  betAmount: bigint; // u64 lamports
  currentTreasure: bigint; // u64 lamports
  maxPayout: bigint; // u64 lamports
  diveNumber: number; // u16
  bump: number; // u8
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
 * Port interface for game session blockchain operations
 */
export interface GameChainPort {
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
   * Play a round (update session state)
   * Maps to: play_round instruction
   * 
   * On-chain behavior:
   * - Validates session.status == Active
   * - Validates round number == session.dive_number + 1
   * - Validates new_treasure >= current_treasure (monotonic)
   * - Validates new_treasure <= max_payout
   * - Updates session.current_treasure and session.dive_number
   * 
   * @throws {GameError} INVALID_SESSION_STATUS if not active
   * @throws {GameError} ROUND_MISMATCH if round number incorrect
   * @throws {GameError} TREASURE_INVALID if treasure violates constraints
   * @throws {GameError} WRONG_USER if caller doesn't own session
   */
  playRound(params: {
    sessionPda: SessionHandle;
    userPubkey: string;
    newTreasureLamports: bigint;
    newDiveNumber: number;
  }): Promise<GameSessionState>;

  /**
   * Mark session as lost
   * Maps to: lose_session instruction
   * 
   * On-chain behavior:
   * - Validates session.status == Active
   * - Sets status = Lost
   * - Decrements house_vault.total_reserved by max_payout
   * - House keeps the bet (no transfer)
   * 
   * @throws {GameError} INVALID_SESSION_STATUS if not active
   * @throws {GameError} WRONG_USER if caller doesn't own session
   * @throws {GameError} OVERFLOW if vault.total_reserved underflows
   */
  loseSession(params: {
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
  cashOut(params: {
    sessionPda: SessionHandle;
    userPubkey: string;
  }): Promise<{
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
}
