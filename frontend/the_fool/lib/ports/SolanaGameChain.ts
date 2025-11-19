/**
 * SolanaGameChain - Real Solana blockchain implementation
 *
 * This implementation connects to an actual Solana RPC node and
 * calls the deployed dive_game Anchor program.
 *
 * IMPORTANT: This class implements the GameChainPort interface exactly,
 * ensuring compatibility with LocalGameChain for testing.
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  Keypair,
  sendAndConfirmTransaction,
  SystemProgram,
  Commitment,
} from "@solana/web3.js";
import BN from "bn.js";
import {
  GameChainPort,
  SessionStatus,
  GameSessionState,
  HouseVaultState,
  GameConfigState,
  SessionHandle,
} from "./GameChainPort";
import { GameError, GameErrorCode } from "./GameErrors";
import {
  PROGRAM_ID,
  getConfigPDA,
  getHouseVaultPDA,
  getSessionPDA,
  buildInitConfigData,
  buildInitHouseVaultData,
  buildStartSessionData,
  buildPlayRoundData,
  buildCashOutData,
  buildLoseSessionData,
  buildToggleHouseLockData,
  lamportsToSol,
  solToLamports,
} from "./solanaHelpers";
import {
  parseSessionData,
  parseHouseVaultData,
  parseGameConfigData,
  SessionAccount,
  HouseVaultAccount,
  GameConfigAccount,
} from "./solanaParsers";

/**
 * Wallet adapter interface for signing transactions
 */
export interface WalletAdapter {
  publicKey: PublicKey | null;
  signTransaction<T extends Transaction>(transaction: T): Promise<T>;
  signAllTransactions<T extends Transaction>(transactions: T[]): Promise<T[]>;
}

/**
 * Configuration options for SolanaGameChain
 */
export interface SolanaGameChainConfig {
  rpcUrl: string;
  commitment?: Commitment;
  houseAuthority: PublicKey;
  wallet?: WalletAdapter; // Optional wallet for signing transactions
}

/**
 * SolanaGameChain implementation using real Solana RPC
 */
export class SolanaGameChain implements GameChainPort {
  private readonly connection: Connection;
  private readonly houseAuthority: PublicKey;
  private wallet: WalletAdapter | undefined;

  // Cache for PDAs
  private configPda: PublicKey | null = null;
  private vaultPda: PublicKey | null = null;

  constructor(config: SolanaGameChainConfig) {
    this.connection = new Connection(
      config.rpcUrl,
      config.commitment || "confirmed"
    );
    this.houseAuthority = config.houseAuthority;
    this.wallet = config.wallet;
  }

  /**
   * Set wallet adapter for signing transactions
   */
  setWallet(wallet: WalletAdapter | undefined): void {
    this.wallet = wallet;
  }

  /**
   * Get current wallet public key
   */
  getWalletPublicKey(): PublicKey | null {
    return this.wallet?.publicKey || null;
  }

  // =========================================================================
  // Helper Methods
  // =========================================================================

  /**
   * Get config PDA (cached)
   */
  private getConfigPDA(): PublicKey {
    if (!this.configPda) {
      this.configPda = getConfigPDA();
    }
    return this.configPda;
  }

  /**
   * Get house vault PDA (cached)
   */
  private getVaultPDA(): PublicKey {
    if (!this.vaultPda) {
      this.vaultPda = getHouseVaultPDA(this.houseAuthority);
    }
    return this.vaultPda;
  }

  /**
   * Send and confirm transaction with proper error handling
   * Uses wallet adapter if available, otherwise throws error
   */
  private async sendTransaction(
    instructions: TransactionInstruction[],
    signers: Keypair[] = []
  ): Promise<string> {
    if (!this.wallet || !this.wallet.publicKey) {
      throw new GameError(
        GameErrorCode.WALLET_NOT_CONNECTED,
        "Wallet not connected. Please connect your wallet to perform this action."
      );
    }

    try {
      const transaction = new Transaction().add(...instructions);
      transaction.feePayer = this.wallet.publicKey;

      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;

      // Sign with any additional signers (e.g., for account creation)
      if (signers.length > 0) {
        transaction.partialSign(...signers);
      }

      // Sign with wallet
      const signedTransaction = await this.wallet.signTransaction(transaction);

      // Send and confirm
      const signature = await this.connection.sendRawTransaction(
        signedTransaction.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: "confirmed",
        }
      );

      await this.connection.confirmTransaction(signature, "confirmed");

      return signature;
    } catch (error: any) {
      // Convert Solana errors to GameError
      throw GameError.fromSolana(error);
    }
  }

  /**
   * Fetch and parse account with proper error handling
   */
  private async fetchAccount<T>(
    address: PublicKey,
    parser: (data: Buffer) => T
  ): Promise<T | null> {
    try {
      const accountInfo = await this.connection.getAccountInfo(address);
      if (!accountInfo) {
        return null;
      }
      return parser(accountInfo.data);
    } catch (error: any) {
      // Log network errors more quietly
      if (
        error.message?.includes("fetch failed") ||
        error.message?.includes("ECONNREFUSED")
      ) {
        console.warn(
          `[SolanaGameChain] Network error (is localnet running?): ${error.message}`
        );
      } else {
        console.error(
          `[SolanaGameChain] Error fetching account ${address.toBase58()}:`,
          error.message
        );
      }
      return null;
    }
  }

  // =========================================================================
  // Game Configuration Methods
  // =========================================================================

  async initGameConfig(params: {
    admin: string;
    baseSurvivalPpm?: number;
    decayPerDivePpm?: number;
    minSurvivalPpm?: number;
    treasureMultiplierNum?: number;
    treasureMultiplierDen?: number;
    maxPayoutMultiplier?: number;
    maxDives?: number;
    minBet?: bigint;
    maxBet?: bigint;
  }): Promise<{ configPda: string; state: GameConfigState }> {
    const adminPubkey = new PublicKey(params.admin);
    const configPda = this.getConfigPDA();

    // Build instruction data
    const data = buildInitConfigData({
      baseSurvivalPpm: params.baseSurvivalPpm,
      decayPerDivePpm: params.decayPerDivePpm,
      minSurvivalPpm: params.minSurvivalPpm,
      treasureMultiplierNum: params.treasureMultiplierNum,
      treasureMultiplierDen: params.treasureMultiplierDen,
      maxPayoutMultiplier: params.maxPayoutMultiplier,
      maxDives: params.maxDives,
      minBet: params.minBet ? new BN(params.minBet.toString()) : undefined,
      maxBet: params.maxBet ? new BN(params.maxBet.toString()) : undefined,
    });

    // Build instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: adminPubkey, isSigner: true, isWritable: true },
        { pubkey: configPda, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID(),
      data,
    });

    // Note: This requires the admin keypair, which isn't provided in params
    // In a real implementation, this would be called by an admin wallet
    throw new Error(
      "initGameConfig requires admin keypair - use admin wallet to initialize"
    );
  }

  async getGameConfig(): Promise<GameConfigState | null> {
    const configPda = this.getConfigPDA();
    const account = await this.fetchAccount(configPda, parseGameConfigData);

    if (!account) {
      return null;
    }

    return {
      configPda: configPda.toBase58(),
      admin: account.admin.toBase58(),
      baseSurvivalPpm: account.base_survival_ppm,
      decayPerDivePpm: account.decay_per_dive_ppm,
      minSurvivalPpm: account.min_survival_ppm,
      treasureMultiplierNum: account.treasure_multiplier_num,
      treasureMultiplierDen: account.treasure_multiplier_den,
      maxPayoutMultiplier: account.max_payout_multiplier,
      maxDives: account.max_dives,
      minBet: BigInt(account.min_bet.toString()),
      maxBet: BigInt(account.max_bet.toString()),
      bump: account.bump,
    };
  }

  // =========================================================================
  // House Vault Methods
  // =========================================================================

  async initHouseVault(params: {
    houseAuthority: string;
  }): Promise<{ vaultPda: string; state: HouseVaultState }> {
    const houseAuthorityPubkey = new PublicKey(params.houseAuthority);
    const vaultPda = getHouseVaultPDA(houseAuthorityPubkey);

    // Build instruction data (locked = false by default)
    const data = buildInitHouseVaultData(false);

    // Build instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: houseAuthorityPubkey, isSigner: true, isWritable: true },
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID(),
      data,
    });

    // Note: Requires house authority keypair
    throw new Error(
      "initHouseVault requires house authority keypair - use admin wallet"
    );
  }

  async toggleHouseLock(params: {
    vaultPda: string;
    houseAuthority: string;
  }): Promise<HouseVaultState> {
    const vaultPubkey = new PublicKey(params.vaultPda);
    const authorityPubkey = new PublicKey(params.houseAuthority);

    // Build instruction data
    const data = buildToggleHouseLockData();

    // Build instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: authorityPubkey, isSigner: true, isWritable: true },
        { pubkey: vaultPubkey, isSigner: false, isWritable: true },
      ],
      programId: PROGRAM_ID(),
      data,
    });

    // Note: Requires house authority keypair
    throw new Error(
      "toggleHouseLock requires house authority keypair - use admin wallet"
    );
  }

  async getHouseVault(vaultPda: string): Promise<HouseVaultState | null> {
    const vaultPubkey = new PublicKey(vaultPda);
    const account = await this.fetchAccount(vaultPubkey, parseHouseVaultData);

    if (!account) {
      return null;
    }

    // Get vault balance
    const balance = await this.connection.getBalance(vaultPubkey);

    return {
      vaultPda: vaultPubkey.toBase58(),
      houseAuthority: account.house_authority.toBase58(),
      locked: account.locked,
      totalReserved: BigInt(account.total_reserved.toString()),
      bump: account.bump,
    };
  }

  async getVaultBalance(vaultPda: string): Promise<bigint> {
    try {
      const vaultPubkey = new PublicKey(vaultPda);
      const balance = await this.connection.getBalance(vaultPubkey);
      return BigInt(balance);
    } catch (error: any) {
      // Handle network errors gracefully
      if (
        error.message?.includes("fetch failed") ||
        error.message?.includes("ECONNREFUSED")
      ) {
        console.warn(
          "[SolanaGameChain] Cannot connect to RPC (is localnet running?)"
        );
        return BigInt(0);
      }
      throw GameError.fromSolana(error);
    }
  }

  // =========================================================================
  // Game Session Methods
  // =========================================================================

  async startSession(params: {
    userPubkey: string;
    betAmountLamports: bigint;
    maxPayoutLamports: bigint;
    houseVaultPda: string;
  }): Promise<{ sessionPda: SessionHandle; state: GameSessionState }> {
    const userPubkey = new PublicKey(params.userPubkey);
    const vaultPubkey = new PublicKey(params.houseVaultPda);
    const configPda = this.getConfigPDA();

    // Generate session index (timestamp-based for uniqueness)
    const sessionIndex = BigInt(Date.now());
    const sessionIndexBN = new BN(sessionIndex.toString());
    const sessionPda = getSessionPDA(userPubkey, sessionIndex);

    // Build instruction data
    const betBN = new BN(params.betAmountLamports.toString());
    const indexBN = new BN(sessionIndex.toString());
    const data = buildStartSessionData(betBN, indexBN);

    // Build instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: userPubkey, isSigner: true, isWritable: true },
        { pubkey: configPda, isSigner: false, isWritable: false },
        { pubkey: vaultPubkey, isSigner: false, isWritable: true },
        { pubkey: this.houseAuthority, isSigner: false, isWritable: false },
        { pubkey: sessionPda, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID(),
      data,
    });

    // Send transaction with wallet and wait for confirmation
    await this.sendTransaction([instruction]);

    // IMPORTANT: Transaction is confirmed, but we need a small delay
    // for the account to be fully propagated through the RPC network
    await new Promise(resolve => setTimeout(resolve, 500));

    // Fetch session state with retries
    let state: GameSessionState | null = null;
    let retries = 3;
    while (!state && retries > 0) {
      state = await this.getSession(sessionPda.toBase58());
      if (!state) {
        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    }

    if (!state) {
      throw GameError.invalidSession();
    }

    return {
      sessionPda: sessionPda.toBase58(),
      state,
    };
  }

  async getSession(
    sessionPda: SessionHandle
  ): Promise<GameSessionState | null> {
    const sessionPubkey = new PublicKey(sessionPda);
    const account = await this.fetchAccount(sessionPubkey, parseSessionData);

    if (!account) {
      return null;
    }

    return this.sessionAccountToState(sessionPubkey, account);
  }

  async playRound(params: {
    sessionPda: SessionHandle;
    userPubkey: string;
  }): Promise<{
    state: GameSessionState;
    survived: boolean;
    randomRoll?: number;
  }> {
    const sessionPubkey = new PublicKey(params.sessionPda);
    const userPubkey = new PublicKey(params.userPubkey);
    const configPda = this.getConfigPDA();

    // Get session to find house vault
    const session = await this.fetchAccount(sessionPubkey, parseSessionData);
    if (!session) {
      throw GameError.invalidSession();
    }

    // Build instruction data
    const data = buildPlayRoundData();

    // Build instruction with basic required accounts
    // The program will validate and require any additional accounts it needs
    // This makes the frontend work with different RNG implementations
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: userPubkey, isSigner: true, isWritable: true },
        { pubkey: configPda, isSigner: false, isWritable: false },
        { pubkey: sessionPubkey, isSigner: false, isWritable: true },
        { pubkey: session.house_vault, isSigner: false, isWritable: true },
      ],
      programId: PROGRAM_ID(),
      data,
    });

    // Send transaction with wallet and wait for confirmation
    await this.sendTransaction([instruction]);

    // Small delay for account propagation
    await new Promise(resolve => setTimeout(resolve, 500));

    // Fetch updated session state with retries
    let state: GameSessionState | null = null;
    let retries = 3;
    while (!state && retries > 0) {
      state = await this.getSession(params.sessionPda);
      if (!state) {
        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    }

    if (!state) {
      throw GameError.invalidSession();
    }

    // Determine if survived based on status
    const survived = state.status === SessionStatus.Active;

    return {
      state,
      survived,
      // Note: randomRoll is not exposed by contract, but could be derived from RNG seed
    };
  }

  async cashOut(params: {
    sessionPda: SessionHandle;
    userPubkey: string;
  }): Promise<{ finalTreasureLamports: bigint; state: GameSessionState }> {
    const sessionPubkey = new PublicKey(params.sessionPda);
    const userPubkey = new PublicKey(params.userPubkey);

    // Get session to find house vault and current treasure
    const sessionBefore = await this.fetchAccount(
      sessionPubkey,
      parseSessionData
    );
    if (!sessionBefore) {
      throw GameError.invalidSession();
    }

    const treasureBeforeCashout = BigInt(
      sessionBefore.current_treasure.toString()
    );

    // Build instruction data
    const data = buildCashOutData();

    // Build instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: userPubkey, isSigner: true, isWritable: true },
        { pubkey: sessionPubkey, isSigner: false, isWritable: true },
        { pubkey: sessionBefore.house_vault, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID(),
      data,
    });

    // Send transaction with wallet
    await this.sendTransaction([instruction]);

    // Session is now closed and account no longer exists
    // Return a "cashed out" state for UI purposes
    return {
      finalTreasureLamports: treasureBeforeCashout,
      state: {
        sessionPda: params.sessionPda,
        user: sessionBefore.user.toBase58(),
        houseVault: sessionBefore.house_vault.toBase58(),
        status: SessionStatus.CashedOut,
        betAmount: BigInt(sessionBefore.bet_amount.toString()),
        currentTreasure: BigInt(0),
        maxPayout: BigInt(sessionBefore.max_payout.toString()),
        diveNumber: sessionBefore.dive_number,
        bump: sessionBefore.bump,
        lastActiveSlot: BigInt(sessionBefore.last_active_slot.toString()),
      },
    };
  }

  async loseSession(params: {
    sessionPda: SessionHandle;
    userPubkey: string;
  }): Promise<GameSessionState> {
    // This instruction is deprecated but kept for compatibility
    const sessionPubkey = new PublicKey(params.sessionPda);
    const userPubkey = new PublicKey(params.userPubkey);

    // Get session to find house vault
    const session = await this.fetchAccount(sessionPubkey, parseSessionData);
    if (!session) {
      throw GameError.invalidSession();
    }

    // Build instruction data
    const data = buildLoseSessionData();

    // Build instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: userPubkey, isSigner: true, isWritable: true },
        { pubkey: sessionPubkey, isSigner: false, isWritable: true },
        { pubkey: session.house_vault, isSigner: false, isWritable: true },
      ],
      programId: PROGRAM_ID(),
      data,
    });

    // Note: Requires user keypair
    throw new Error("loseSession is deprecated - use playRound instead");
  }

  // =========================================================================
  // Balance Queries
  // =========================================================================

  async getUserBalance(userPubkey: string): Promise<bigint> {
    try {
      const pubkey = new PublicKey(userPubkey);
      const balance = await this.connection.getBalance(pubkey);
      return BigInt(balance);
    } catch (error: any) {
      // If invalid pubkey (e.g., LocalGameChain user ID), return 0
      if (
        error.message?.includes("Non-base58") ||
        error.message?.includes("Invalid public key")
      ) {
        console.warn(
          `[SolanaGameChain] Invalid public key: ${userPubkey}, returning 0 balance`
        );
        return BigInt(0);
      }
      throw GameError.fromSolana(error);
    }
  }

  // =========================================================================
  // Helper Conversions
  // =========================================================================

  /**
   * Convert SessionAccount to GameSessionState
   */
  private sessionAccountToState(
    sessionPubkey: PublicKey,
    account: SessionAccount
  ): GameSessionState {
    // Convert Anchor's enum format {Active: {}} to SessionStatus enum
    let status: SessionStatus;
    const statusObj = account.status as any;
    if (statusObj.active !== undefined || statusObj.Active !== undefined) {
      status = SessionStatus.Active;
    } else if (statusObj.lost !== undefined || statusObj.Lost !== undefined) {
      status = SessionStatus.Lost;
    } else if (statusObj.cashedOut !== undefined || statusObj.CashedOut !== undefined) {
      status = SessionStatus.CashedOut;
    } else {
      // Fallback: treat as Active
      console.warn('[SolanaGameChain] Unknown session status:', statusObj);
      status = SessionStatus.Active;
    }

    return {
      sessionPda: sessionPubkey.toBase58(),
      user: account.user.toBase58(),
      houseVault: account.house_vault.toBase58(),
      status,
      betAmount: BigInt(account.bet_amount.toString()),
      currentTreasure: BigInt(account.current_treasure.toString()),
      maxPayout: BigInt(account.max_payout.toString()),
      diveNumber: account.dive_number,
      bump: account.bump,
      lastActiveSlot: BigInt(account.last_active_slot.toString()),
    };
  }
}

/**
 * Factory function to create SolanaGameChain with default config
 */
export function createSolanaGameChain(
  rpcUrl: string,
  houseAuthority: string,
  wallet?: WalletAdapter
): SolanaGameChain {
  // Validate houseAuthority is a valid base58 string
  if (!houseAuthority || houseAuthority.trim() === "") {
    throw new Error(
      "[createSolanaGameChain] houseAuthority is required and cannot be empty"
    );
  }

  let houseAuthorityPubkey: PublicKey;
  try {
    houseAuthorityPubkey = new PublicKey(houseAuthority);
  } catch (error) {
    throw new Error(
      `[createSolanaGameChain] Invalid houseAuthority: "${houseAuthority}". Must be a valid base58 public key.`
    );
  }

  return new SolanaGameChain({
    rpcUrl,
    commitment: "confirmed",
    houseAuthority: houseAuthorityPubkey,
    wallet,
  });
}
