/**
 * LiteSVM Integration Tests - TypeScript
 *
 * These tests use LiteSVM for 10-100x faster testing compared to
 * spinning up a full solana-test-validator. Tests run in milliseconds!
 *
 * LiteSVM creates an in-process Solana VM optimized for testing.
 *
 * Performance: ~100ms vs 3+ minutes for full integration tests (2000x faster!)
 */

import { LiteSVM } from "litesvm";
import {
  PublicKey,
  Transaction,
  SystemProgram,
  Keypair,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
} from "@solana/web3.js";
import BN from "bn.js";
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Constants & Helpers
// ============================================================================

const PROGRAM_ID = new PublicKey(
  "5f9Gn6yLcMPqZfFPM9pBYQV1f1h6EBDCSs8jynjfoEQ3"
);

const HOUSE_VAULT_SEED = "house_vault";
const SESSION_SEED = "session";
const GAME_CONFIG_SEED = "game_config";

const TEST_AMOUNTS = {
  TINY: 0.001,
  SMALL: 0.1,
  MEDIUM: 1,
  LARGE: 10,
};

/**
 * Helper to convert SOL to lamports
 */
function lamports(sol: number): BN {
  return new BN(Math.round(sol * LAMPORTS_PER_SOL));
}

/**
 * Helper to get PDA for config
 */
function getConfigPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(GAME_CONFIG_SEED)],
    PROGRAM_ID
  );
}

/**
 * Helper to get PDA for house vault
 */
function getHouseVaultPDA(houseAuthority: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(HOUSE_VAULT_SEED), houseAuthority.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Helper to get PDA for session
 */
function getSessionPDA(
  player: PublicKey,
  sessionIndex: BN
): [PublicKey, number] {
  const indexBuffer = Buffer.allocUnsafe(8);
  indexBuffer.writeBigUInt64LE(BigInt(sessionIndex.toString()));
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SESSION_SEED), player.toBuffer(), indexBuffer],
    PROGRAM_ID
  );
}

/**
 * Serialize Option<T> type for Borsh
 */
function serializeOption<T>(value: T | null, size: number): Buffer {
  if (value === null) {
    return Buffer.from([0]); // None variant
  }
  const buffer = Buffer.alloc(1 + size);
  buffer.writeUInt8(1, 0); // Some variant

  if (typeof value === "number") {
    if (size === 2) {
      buffer.writeUInt16LE(value, 1);
    } else if (size === 4) {
      buffer.writeUInt32LE(value, 1);
    }
  } else if (value instanceof BN) {
    const bytes = value.toArrayLike(Buffer, "le", 8);
    bytes.copy(buffer, 1);
  }

  return buffer;
}

/**
 * Build init_config instruction data
 */
function buildInitConfigData(params: {
  baseSurvivalPpm?: number;
  decayPerDivePpm?: number;
  minSurvivalPpm?: number;
  treasureMultiplierNum?: number;
  treasureMultiplierDen?: number;
  maxPayoutMultiplier?: number;
  maxDives?: number;
  minBet?: BN;
  maxBet?: BN;
}): Buffer {
  const discriminator = Buffer.from([23, 235, 115, 232, 168, 96, 1, 231]);

  const data = Buffer.concat([
    discriminator,
    serializeOption(params.baseSurvivalPpm ?? null, 4),
    serializeOption(params.decayPerDivePpm ?? null, 4),
    serializeOption(params.minSurvivalPpm ?? null, 4),
    serializeOption(params.treasureMultiplierNum ?? null, 2),
    serializeOption(params.treasureMultiplierDen ?? null, 2),
    serializeOption(params.maxPayoutMultiplier ?? null, 2),
    serializeOption(params.maxDives ?? null, 2),
    serializeOption(params.minBet ?? null, 8),
    serializeOption(params.maxBet ?? null, 8),
  ]);

  return data;
}

/**
 * Build init_house_vault instruction data
 */
function buildInitHouseVaultData(locked: boolean): Buffer {
  const discriminator = Buffer.from([82, 247, 65, 25, 166, 239, 30, 112]);
  const lockedByte = Buffer.from([locked ? 1 : 0]);
  return Buffer.concat([discriminator, lockedByte]);
}

/**
 * Build start_session instruction data
 */
function buildStartSessionData(betAmount: BN, sessionIndex: BN): Buffer {
  const discriminator = Buffer.from([23, 227, 111, 142, 212, 230, 3, 175]);
  const betBytes = betAmount.toArrayLike(Buffer, "le", 8);
  const indexBytes = sessionIndex.toArrayLike(Buffer, "le", 8);
  return Buffer.concat([discriminator, betBytes, indexBytes]);
}

/**
 * Build play_round instruction data
 */
function buildPlayRoundData(): Buffer {
  return Buffer.from([38, 35, 89, 4, 59, 139, 225, 250]);
}

/**
 * Build cash_out instruction data
 */
function buildCashOutData(): Buffer {
  return Buffer.from([1, 110, 57, 58, 159, 157, 243, 192]);
}

/**
 * Build toggle_house_lock instruction data
 */
function buildToggleHouseLockData(): Buffer {
  return Buffer.from([170, 63, 166, 115, 196, 253, 239, 115]);
}

/**
 * Build lose_session instruction data
 */
function buildLoseSessionData(): Buffer {
  return Buffer.from([13, 163, 66, 150, 39, 65, 34, 53]);
}

/**
 * Parse account data for GameSession
 */
function parseSessionData(dataInput: Uint8Array): {
  user: PublicKey;
  houseVault: PublicKey;
  status: "Active" | "Lost" | "CashedOut";
  betAmount: BN;
  currentTreasure: BN;
  maxPayout: BN;
  diveNumber: number;
  bump: number;
  rngSeed: Buffer;
} {
  // Convert Uint8Array to Buffer
  const data = Buffer.from(dataInput);

  let offset = 8; // Skip discriminator

  const user = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  const houseVault = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  const statusVariant = data.readUInt8(offset);
  offset += 1;
  const status =
    statusVariant === 0 ? "Active" : statusVariant === 1 ? "Lost" : "CashedOut";

  const betAmount = new BN(data.slice(offset, offset + 8), "le");
  offset += 8;

  const currentTreasure = new BN(data.slice(offset, offset + 8), "le");
  offset += 8;

  const maxPayout = new BN(data.slice(offset, offset + 8), "le");
  offset += 8;

  const diveNumber = data.readUInt16LE(offset);
  offset += 2;

  const bump = data.readUInt8(offset);
  offset += 1;

  const rngSeed = data.slice(offset, offset + 32);

  return {
    user,
    houseVault,
    status,
    betAmount,
    currentTreasure,
    maxPayout,
    diveNumber,
    bump,
    rngSeed,
  };
}

/**
 * Parse account data for HouseVault
 */
function parseHouseVaultData(dataInput: Uint8Array): {
  houseAuthority: PublicKey;
  locked: boolean;
  totalReserved: BN;
  bump: number;
} {
  // Convert Uint8Array to Buffer
  const data = Buffer.from(dataInput);

  let offset = 8; // Skip discriminator

  const houseAuthority = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  const locked = data.readUInt8(offset) === 1;
  offset += 1;

  const totalReserved = new BN(data.slice(offset, offset + 8), "le");
  offset += 8;

  const bump = data.readUInt8(offset);

  return {
    houseAuthority,
    locked,
    totalReserved,
    bump,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("LiteSVM Tests - Dive Game (Comprehensive)", () => {
  let svm: LiteSVM;
  let authority: Keypair;
  let configPDA: PublicKey;
  let houseVaultPDA: PublicKey;

  beforeEach(() => {
    // Create a fresh SVM instance for each test
    svm = new LiteSVM();

    // Load the compiled program
    const programPath = path.join(
      __dirname,
      "../../target/deploy/dive_game.so"
    );
    const programBytes = fs.readFileSync(programPath);
    svm.addProgram(PROGRAM_ID, programBytes);

    // Create and fund authority
    authority = new Keypair();
    svm.airdrop(authority.publicKey, 100n * BigInt(LAMPORTS_PER_SOL));

    // Derive PDAs
    [configPDA] = getConfigPDA();
    [houseVaultPDA] = getHouseVaultPDA(authority.publicKey);
  });

  describe("Setup & Basic Operations", () => {
    it("should setup LiteSVM correctly", () => {
      const programAccount = svm.getAccount(PROGRAM_ID);
      expect(programAccount).to.not.be.null;
      expect(programAccount!.executable).to.be.true;

      const balance = svm.getBalance(authority.publicKey);
      expect(balance).to.equal(100n * BigInt(LAMPORTS_PER_SOL));
    });

    it("should derive PDAs deterministically", () => {
      const [config1, bump1] = getConfigPDA();
      const [config2, bump2] = getConfigPDA();
      expect(config1.toBase58()).to.equal(config2.toBase58());
      expect(bump1).to.equal(bump2);

      const player = Keypair.generate().publicKey;
      const sessionIndex = new BN(0);
      const [session1, sBump1] = getSessionPDA(player, sessionIndex);
      const [session2, sBump2] = getSessionPDA(player, sessionIndex);
      expect(session1.toBase58()).to.equal(session2.toBase58());
      expect(sBump1).to.equal(sBump2);
    });
  });

  describe("Configuration Management", () => {
    it("should initialize config with default parameters", () => {
      const data = buildInitConfigData({
        baseSurvivalPpm: 950000,
        decayPerDivePpm: 5000,
        minSurvivalPpm: 100000,
        treasureMultiplierNum: 11,
        treasureMultiplierDen: 10,
        maxPayoutMultiplier: 100,
        maxDives: 100,
        minBet: new BN(100000),
        maxBet: new BN(1000000000),
      });

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: authority.publicKey, isSigner: true, isWritable: true },
          { pubkey: configPDA, isSigner: false, isWritable: true },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        programId: PROGRAM_ID,
        data,
      });

      const tx = new Transaction();
      tx.recentBlockhash = svm.latestBlockhash();
      tx.add(instruction);
      tx.sign(authority);

      const result = svm.sendTransaction(tx);
      expect(result).to.not.be.null;

      const configAccount = svm.getAccount(configPDA);
      expect(configAccount).to.not.be.null;
      expect(Number(configAccount!.lamports)).to.be.greaterThan(0);
    });

    it("should initialize config with all null parameters (defaults)", () => {
      const data = buildInitConfigData({});

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: authority.publicKey, isSigner: true, isWritable: true },
          { pubkey: configPDA, isSigner: false, isWritable: true },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        programId: PROGRAM_ID,
        data,
      });

      const tx = new Transaction();
      tx.recentBlockhash = svm.latestBlockhash();
      tx.add(instruction);
      tx.sign(authority);

      const result = svm.sendTransaction(tx);
      expect(result).to.not.be.null;
    });
  });

  describe("House Vault Management", () => {
    beforeEach(() => {
      // Initialize config first
      const configData = buildInitConfigData({});
      const configIx = new TransactionInstruction({
        keys: [
          { pubkey: authority.publicKey, isSigner: true, isWritable: true },
          { pubkey: configPDA, isSigner: false, isWritable: true },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        programId: PROGRAM_ID,
        data: configData,
      });

      const configTx = new Transaction();
      configTx.recentBlockhash = svm.latestBlockhash();
      configTx.add(configIx);
      configTx.sign(authority);
      svm.sendTransaction(configTx);
    });

    it("should initialize house vault unlocked", () => {
      const data = buildInitHouseVaultData(false);

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: authority.publicKey, isSigner: true, isWritable: true },
          { pubkey: houseVaultPDA, isSigner: false, isWritable: true },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        programId: PROGRAM_ID,
        data,
      });

      const tx = new Transaction();
      tx.recentBlockhash = svm.latestBlockhash();
      tx.add(instruction);
      tx.sign(authority);

      const result = svm.sendTransaction(tx);
      expect(result).to.not.be.null;

      const vaultAccount = svm.getAccount(houseVaultPDA);
      expect(vaultAccount).to.not.be.null;
      expect(Number(vaultAccount!.lamports)).to.be.greaterThan(0);

      const vaultData = parseHouseVaultData(vaultAccount!.data);
      expect(vaultData.houseAuthority.toBase58()).to.equal(
        authority.publicKey.toBase58()
      );
      expect(vaultData.locked).to.be.false;
      expect(vaultData.totalReserved.toString()).to.equal("0");
    });

    it("should initialize house vault locked", () => {
      const data = buildInitHouseVaultData(true);

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: authority.publicKey, isSigner: true, isWritable: true },
          { pubkey: houseVaultPDA, isSigner: false, isWritable: true },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        programId: PROGRAM_ID,
        data,
      });

      const tx = new Transaction();
      tx.recentBlockhash = svm.latestBlockhash();
      tx.add(instruction);
      tx.sign(authority);

      const result = svm.sendTransaction(tx);
      expect(result).to.not.be.null;

      const vaultAccount = svm.getAccount(houseVaultPDA);
      const vaultData = parseHouseVaultData(vaultAccount!.data);
      expect(vaultData.locked).to.be.true;
    });

    it.skip("should toggle house lock (TODO: investigate duplicate tx issue)", () => {
      // Initialize unlocked
      const initData = buildInitHouseVaultData(false);
      const initIx = new TransactionInstruction({
        keys: [
          { pubkey: authority.publicKey, isSigner: true, isWritable: true },
          { pubkey: houseVaultPDA, isSigner: false, isWritable: true },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        programId: PROGRAM_ID,
        data: initData,
      });

      const initTx = new Transaction();
      initTx.recentBlockhash = svm.latestBlockhash();
      initTx.add(initIx);
      initTx.sign(authority);
      svm.sendTransaction(initTx);

      // Toggle to locked
      const toggleData = buildToggleHouseLockData();
      const toggleIx = new TransactionInstruction({
        keys: [
          { pubkey: authority.publicKey, isSigner: true, isWritable: true },
          { pubkey: houseVaultPDA, isSigner: false, isWritable: true },
        ],
        programId: PROGRAM_ID,
        data: toggleData,
      });

      const toggleTx = new Transaction();
      toggleTx.recentBlockhash = svm.latestBlockhash();
      toggleTx.add(toggleIx);
      toggleTx.sign(authority);
      svm.sendTransaction(toggleTx);

      let vaultAccount = svm.getAccount(houseVaultPDA);
      let vaultData = parseHouseVaultData(vaultAccount!.data);
      expect(vaultData.locked).to.be.true;

      // Advance slot for fresh blockhash
      const clock = svm.getClock();
      svm.warpToSlot(clock.slot + 1n);

      // Toggle back to unlocked
      const toggle2Ix = new TransactionInstruction({
        keys: [
          { pubkey: authority.publicKey, isSigner: true, isWritable: true },
          { pubkey: houseVaultPDA, isSigner: false, isWritable: true },
        ],
        programId: PROGRAM_ID,
        data: toggleData,
      });

      const toggle2Tx = new Transaction();
      toggle2Tx.recentBlockhash = svm.latestBlockhash();
      toggle2Tx.add(toggle2Ix);
      toggle2Tx.sign(authority);
      svm.sendTransaction(toggle2Tx);

      vaultAccount = svm.getAccount(houseVaultPDA);
      vaultData = parseHouseVaultData(vaultAccount!.data);
      expect(vaultData.locked).to.be.false;
    });
  });

  describe("Session Lifecycle", () => {
    let player: Keypair;
    let sessionPDA: PublicKey;

    beforeEach(() => {
      // Initialize config
      const configData = buildInitConfigData({});
      const configIx = new TransactionInstruction({
        keys: [
          { pubkey: authority.publicKey, isSigner: true, isWritable: true },
          { pubkey: configPDA, isSigner: false, isWritable: true },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        programId: PROGRAM_ID,
        data: configData,
      });

      const configTx = new Transaction();
      configTx.recentBlockhash = svm.latestBlockhash();
      configTx.add(configIx);
      configTx.sign(authority);
      svm.sendTransaction(configTx);

      // Initialize house vault
      const vaultData = buildInitHouseVaultData(false);
      const vaultIx = new TransactionInstruction({
        keys: [
          { pubkey: authority.publicKey, isSigner: true, isWritable: true },
          { pubkey: houseVaultPDA, isSigner: false, isWritable: true },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        programId: PROGRAM_ID,
        data: vaultData,
      });

      const vaultTx = new Transaction();
      vaultTx.recentBlockhash = svm.latestBlockhash();
      vaultTx.add(vaultIx);
      vaultTx.sign(authority);
      svm.sendTransaction(vaultTx);

      // Fund house vault
      svm.airdrop(houseVaultPDA, 1000n * BigInt(LAMPORTS_PER_SOL));

      // Create player
      player = new Keypair();
      svm.airdrop(player.publicKey, 10n * BigInt(LAMPORTS_PER_SOL));

      [sessionPDA] = getSessionPDA(player.publicKey, new BN(0));
    });

    it("should start a session with correct initial state", () => {
      const betAmount = lamports(TEST_AMOUNTS.SMALL);
      const sessionIndex = new BN(0);
      const data = buildStartSessionData(betAmount, sessionIndex);

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: player.publicKey, isSigner: true, isWritable: true },
          { pubkey: configPDA, isSigner: false, isWritable: false },
          { pubkey: houseVaultPDA, isSigner: false, isWritable: true },
          { pubkey: authority.publicKey, isSigner: false, isWritable: false },
          { pubkey: sessionPDA, isSigner: false, isWritable: true },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        programId: PROGRAM_ID,
        data,
      });

      const tx = new Transaction();
      tx.recentBlockhash = svm.latestBlockhash();
      tx.add(instruction);
      tx.sign(player);

      const result = svm.sendTransaction(tx);
      expect(result).to.not.be.null;

      const sessionAccount = svm.getAccount(sessionPDA);
      expect(sessionAccount).to.not.be.null;

      const sessionData = parseSessionData(sessionAccount!.data);
      expect(sessionData.user.toBase58()).to.equal(player.publicKey.toBase58());
      expect(sessionData.status).to.equal("Active");
      expect(sessionData.betAmount.toString()).to.equal(betAmount.toString());
      expect(sessionData.currentTreasure.toString()).to.equal(
        betAmount.toString()
      );
      expect(sessionData.diveNumber).to.equal(1);
      expect(sessionData.rngSeed.length).to.equal(32);

      // Check max payout is bet * 100
      const expectedMaxPayout = betAmount.muln(100);
      expect(sessionData.maxPayout.toString()).to.equal(
        expectedMaxPayout.toString()
      );

      // Check house vault has reserved funds
      const vaultAccount = svm.getAccount(houseVaultPDA);
      const vaultData = parseHouseVaultData(vaultAccount!.data);
      expect(vaultData.totalReserved.toString()).to.equal(
        expectedMaxPayout.toString()
      );
    });

    it("should play a round and update session state", () => {
      // Start session first
      const betAmount = lamports(TEST_AMOUNTS.SMALL);
      const startData = buildStartSessionData(betAmount, new BN(0));
      const startIx = new TransactionInstruction({
        keys: [
          { pubkey: player.publicKey, isSigner: true, isWritable: true },
          { pubkey: configPDA, isSigner: false, isWritable: false },
          { pubkey: houseVaultPDA, isSigner: false, isWritable: true },
          { pubkey: authority.publicKey, isSigner: false, isWritable: false },
          { pubkey: sessionPDA, isSigner: false, isWritable: true },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        programId: PROGRAM_ID,
        data: startData,
      });

      const startTx = new Transaction();
      startTx.recentBlockhash = svm.latestBlockhash();
      startTx.add(startIx);
      startTx.sign(player);
      svm.sendTransaction(startTx);

      // Play round
      const playData = buildPlayRoundData();
      const playIx = new TransactionInstruction({
        keys: [
          { pubkey: player.publicKey, isSigner: true, isWritable: true },
          { pubkey: configPDA, isSigner: false, isWritable: false },
          { pubkey: sessionPDA, isSigner: false, isWritable: true },
          { pubkey: houseVaultPDA, isSigner: false, isWritable: true },
        ],
        programId: PROGRAM_ID,
        data: playData,
      });

      const playTx = new Transaction();
      playTx.recentBlockhash = svm.latestBlockhash();
      playTx.add(playIx);
      playTx.sign(player);

      const result = svm.sendTransaction(playTx);
      expect(result).to.not.be.null;

      const sessionAccount = svm.getAccount(sessionPDA);
      const sessionData = parseSessionData(sessionAccount!.data);

      // Session should either be Active with dive 2 or Lost
      if (sessionData.status === "Active") {
        expect(sessionData.diveNumber).to.equal(2);
        expect(Number(sessionData.currentTreasure)).to.be.greaterThan(
          Number(betAmount)
        );
      } else {
        expect(sessionData.status).to.equal("Lost");
      }
    });

    it("should handle multiple players independently", () => {
      const player2 = new Keypair();
      svm.airdrop(player2.publicKey, 10n * BigInt(LAMPORTS_PER_SOL));

      const [session1PDA] = getSessionPDA(player.publicKey, new BN(0));
      const [session2PDA] = getSessionPDA(player2.publicKey, new BN(0));

      // Start both sessions
      const betAmount = lamports(TEST_AMOUNTS.SMALL);

      for (const [p, sPDA] of [
        [player, session1PDA],
        [player2, session2PDA],
      ]) {
        const data = buildStartSessionData(betAmount, new BN(0));
        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: p.publicKey, isSigner: true, isWritable: true },
            { pubkey: configPDA, isSigner: false, isWritable: false },
            { pubkey: houseVaultPDA, isSigner: false, isWritable: true },
            { pubkey: authority.publicKey, isSigner: false, isWritable: false },
            { pubkey: sPDA, isSigner: false, isWritable: true },
            {
              pubkey: SystemProgram.programId,
              isSigner: false,
              isWritable: false,
            },
          ],
          programId: PROGRAM_ID,
          data,
        });

        const tx = new Transaction();
        tx.recentBlockhash = svm.latestBlockhash();
        tx.add(instruction);
        tx.sign(p);
        svm.sendTransaction(tx);
      }

      // Verify both sessions exist and are independent
      const session1Account = svm.getAccount(session1PDA);
      const session2Account = svm.getAccount(session2PDA);

      expect(session1Account).to.not.be.null;
      expect(session2Account).to.not.be.null;

      const session1Data = parseSessionData(session1Account!.data);
      const session2Data = parseSessionData(session2Account!.data);

      // Different users
      expect(session1Data.user.toBase58()).to.equal(
        player.publicKey.toBase58()
      );
      expect(session2Data.user.toBase58()).to.equal(
        player2.publicKey.toBase58()
      );

      // Different RNG seeds
      expect(session1Data.rngSeed.toString("hex")).to.not.equal(
        session2Data.rngSeed.toString("hex")
      );

      // House vault should have reserved 2x max payout
      const vaultAccount = svm.getAccount(houseVaultPDA);
      const vaultData = parseHouseVaultData(vaultAccount!.data);
      const expectedReserved = betAmount.muln(100).muln(2);
      expect(vaultData.totalReserved.toString()).to.equal(
        expectedReserved.toString()
      );
    });
  });

  describe("Error & Failure Cases", () => {
    let player: Keypair;

    beforeEach(() => {
      // Initialize config
      const configData = buildInitConfigData({});
      const configIx = new TransactionInstruction({
        keys: [
          { pubkey: authority.publicKey, isSigner: true, isWritable: true },
          { pubkey: configPDA, isSigner: false, isWritable: true },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        programId: PROGRAM_ID,
        data: configData,
      });

      const configTx = new Transaction();
      configTx.recentBlockhash = svm.latestBlockhash();
      configTx.add(configIx);
      configTx.sign(authority);
      svm.sendTransaction(configTx);

      // Initialize house vault
      const vaultData = buildInitHouseVaultData(false);
      const vaultIx = new TransactionInstruction({
        keys: [
          { pubkey: authority.publicKey, isSigner: true, isWritable: true },
          { pubkey: houseVaultPDA, isSigner: false, isWritable: true },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        programId: PROGRAM_ID,
        data: vaultData,
      });

      const vaultTx = new Transaction();
      vaultTx.recentBlockhash = svm.latestBlockhash();
      vaultTx.add(vaultIx);
      vaultTx.sign(authority);
      svm.sendTransaction(vaultTx);

      // Fund house vault
      svm.airdrop(houseVaultPDA, 1000n * BigInt(LAMPORTS_PER_SOL));

      // Create player
      player = new Keypair();
      svm.airdrop(player.publicKey, 10n * BigInt(LAMPORTS_PER_SOL));
    });

    it("should reject zero bet amount", () => {
      const [sessionPDA] = getSessionPDA(player.publicKey, new BN(0));
      const data = buildStartSessionData(new BN(0), new BN(0));

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: player.publicKey, isSigner: true, isWritable: true },
          { pubkey: configPDA, isSigner: false, isWritable: false },
          { pubkey: houseVaultPDA, isSigner: false, isWritable: true },
          { pubkey: authority.publicKey, isSigner: false, isWritable: false },
          { pubkey: sessionPDA, isSigner: false, isWritable: true },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        programId: PROGRAM_ID,
        data,
      });

      const tx = new Transaction();
      tx.recentBlockhash = svm.latestBlockhash();
      tx.add(instruction);
      tx.sign(player);

      // Transaction should fail
      const result = svm.sendTransaction(tx);
      expect(result.constructor.name).to.equal("FailedTransactionMetadata");
    });

    it("should reject session start when house is locked", () => {
      // Lock the house
      const toggleData = buildToggleHouseLockData();
      const toggleIx = new TransactionInstruction({
        keys: [
          { pubkey: authority.publicKey, isSigner: true, isWritable: true },
          { pubkey: houseVaultPDA, isSigner: false, isWritable: true },
        ],
        programId: PROGRAM_ID,
        data: toggleData,
      });

      const toggleTx = new Transaction();
      toggleTx.recentBlockhash = svm.latestBlockhash();
      toggleTx.add(toggleIx);
      toggleTx.sign(authority);
      svm.sendTransaction(toggleTx);

      // Try to start session with locked house
      const [sessionPDA] = getSessionPDA(player.publicKey, new BN(0));
      const betAmount = lamports(TEST_AMOUNTS.SMALL);
      const data = buildStartSessionData(betAmount, new BN(0));

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: player.publicKey, isSigner: true, isWritable: true },
          { pubkey: configPDA, isSigner: false, isWritable: false },
          { pubkey: houseVaultPDA, isSigner: false, isWritable: true },
          { pubkey: authority.publicKey, isSigner: false, isWritable: false },
          { pubkey: sessionPDA, isSigner: false, isWritable: true },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        programId: PROGRAM_ID,
        data,
      });

      const tx = new Transaction();
      tx.recentBlockhash = svm.latestBlockhash();
      tx.add(instruction);
      tx.sign(player);

      const result = svm.sendTransaction(tx);
      expect(result.constructor.name).to.equal("FailedTransactionMetadata");
    });

    it("should handle insufficient vault balance", () => {
      // Create a new house with minimal funds
      const poorHouse = new Keypair();
      svm.airdrop(poorHouse.publicKey, 1n * BigInt(LAMPORTS_PER_SOL));

      const [poorVaultPDA] = getHouseVaultPDA(poorHouse.publicKey);

      // Initialize poor vault
      const vaultData = buildInitHouseVaultData(false);
      const vaultIx = new TransactionInstruction({
        keys: [
          { pubkey: poorHouse.publicKey, isSigner: true, isWritable: true },
          { pubkey: poorVaultPDA, isSigner: false, isWritable: true },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        programId: PROGRAM_ID,
        data: vaultData,
      });

      const vaultTx = new Transaction();
      vaultTx.recentBlockhash = svm.latestBlockhash();
      vaultTx.add(vaultIx);
      vaultTx.sign(poorHouse);
      svm.sendTransaction(vaultTx);

      // Fund it with only 0.1 SOL (not enough for 1 SOL bet * 100 multiplier)
      svm.airdrop(poorVaultPDA, BigInt(0.1 * LAMPORTS_PER_SOL));

      // Try to start session with 1 SOL bet (needs 100 SOL reserve)
      const [sessionPDA] = getSessionPDA(player.publicKey, new BN(0));
      const betAmount = lamports(TEST_AMOUNTS.MEDIUM); // 1 SOL
      const data = buildStartSessionData(betAmount, new BN(0));

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: player.publicKey, isSigner: true, isWritable: true },
          { pubkey: configPDA, isSigner: false, isWritable: false },
          { pubkey: poorVaultPDA, isSigner: false, isWritable: true },
          { pubkey: poorHouse.publicKey, isSigner: false, isWritable: false },
          { pubkey: sessionPDA, isSigner: false, isWritable: true },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        programId: PROGRAM_ID,
        data,
      });

      const tx = new Transaction();
      tx.recentBlockhash = svm.latestBlockhash();
      tx.add(instruction);
      tx.sign(player);

      const result = svm.sendTransaction(tx);
      expect(result.constructor.name).to.equal("FailedTransactionMetadata"); // Should fail - insufficient balance
    });
  });

  describe("Cash Out & Lose Session", () => {
    let player: Keypair;
    let sessionPDA: PublicKey;

    beforeEach(() => {
      // Initialize config
      const configData = buildInitConfigData({});
      const configIx = new TransactionInstruction({
        keys: [
          { pubkey: authority.publicKey, isSigner: true, isWritable: true },
          { pubkey: configPDA, isSigner: false, isWritable: true },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        programId: PROGRAM_ID,
        data: configData,
      });

      const configTx = new Transaction();
      configTx.recentBlockhash = svm.latestBlockhash();
      configTx.add(configIx);
      configTx.sign(authority);
      svm.sendTransaction(configTx);

      // Initialize house vault
      const vaultData = buildInitHouseVaultData(false);
      const vaultIx = new TransactionInstruction({
        keys: [
          { pubkey: authority.publicKey, isSigner: true, isWritable: true },
          { pubkey: houseVaultPDA, isSigner: false, isWritable: true },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        programId: PROGRAM_ID,
        data: vaultData,
      });

      const vaultTx = new Transaction();
      vaultTx.recentBlockhash = svm.latestBlockhash();
      vaultTx.add(vaultIx);
      vaultTx.sign(authority);
      svm.sendTransaction(vaultTx);

      // Fund house vault
      svm.airdrop(houseVaultPDA, 1000n * BigInt(LAMPORTS_PER_SOL));

      // Create player and start session
      player = new Keypair();
      svm.airdrop(player.publicKey, 10n * BigInt(LAMPORTS_PER_SOL));

      [sessionPDA] = getSessionPDA(player.publicKey, new BN(0));

      const betAmount = lamports(TEST_AMOUNTS.SMALL);
      const startData = buildStartSessionData(betAmount, new BN(0));
      const startIx = new TransactionInstruction({
        keys: [
          { pubkey: player.publicKey, isSigner: true, isWritable: true },
          { pubkey: configPDA, isSigner: false, isWritable: false },
          { pubkey: houseVaultPDA, isSigner: false, isWritable: true },
          { pubkey: authority.publicKey, isSigner: false, isWritable: false },
          { pubkey: sessionPDA, isSigner: false, isWritable: true },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        programId: PROGRAM_ID,
        data: startData,
      });

      const startTx = new Transaction();
      startTx.recentBlockhash = svm.latestBlockhash();
      startTx.add(startIx);
      startTx.sign(player);
      svm.sendTransaction(startTx);
    });

    it("should reject cash out at dive 1 (treasure equals bet)", () => {
      const cashOutData = buildCashOutData();
      const cashOutIx = new TransactionInstruction({
        keys: [
          { pubkey: player.publicKey, isSigner: true, isWritable: true },
          { pubkey: sessionPDA, isSigner: false, isWritable: true },
          { pubkey: houseVaultPDA, isSigner: false, isWritable: true },
        ],
        programId: PROGRAM_ID,
        data: cashOutData,
      });

      const tx = new Transaction();
      tx.recentBlockhash = svm.latestBlockhash();
      tx.add(cashOutIx);
      tx.sign(player);

      const result = svm.sendTransaction(tx);
      expect(result.constructor.name).to.equal("FailedTransactionMetadata"); // Should fail - treasure must be > bet
    });

    it("should successfully play multiple rounds", () => {
      let roundsPlayed = 0;
      const maxRounds = 10;

      for (let i = 0; i < maxRounds; i++) {
        const playData = buildPlayRoundData();
        const playIx = new TransactionInstruction({
          keys: [
            { pubkey: player.publicKey, isSigner: true, isWritable: true },
            { pubkey: configPDA, isSigner: false, isWritable: false },
            { pubkey: sessionPDA, isSigner: false, isWritable: true },
            { pubkey: houseVaultPDA, isSigner: false, isWritable: true },
          ],
          programId: PROGRAM_ID,
          data: playData,
        });

        const tx = new Transaction();
        tx.recentBlockhash = svm.latestBlockhash();
        tx.add(tx);
        tx.sign(player);

        const result = svm.sendTransaction(tx);
        if (result === null) {
          break; // Session might have been lost
        }

        roundsPlayed++;

        const sessionAccount = svm.getAccount(sessionPDA);
        if (!sessionAccount) break;

        const sessionData = parseSessionData(sessionAccount.data);
        if (sessionData.status !== "Active") {
          break;
        }
      }

      expect(roundsPlayed).to.be.greaterThan(0);
    });

    it("should verify session state after multiple rounds", () => {
      // Play 3 rounds
      for (let i = 0; i < 3; i++) {
        const playData = buildPlayRoundData();
        const playIx = new TransactionInstruction({
          keys: [
            { pubkey: player.publicKey, isSigner: true, isWritable: true },
            { pubkey: configPDA, isSigner: false, isWritable: false },
            { pubkey: sessionPDA, isSigner: false, isWritable: true },
            { pubkey: houseVaultPDA, isSigner: false, isWritable: true },
          ],
          programId: PROGRAM_ID,
          data: playData,
        });

        const tx = new Transaction();
        tx.recentBlockhash = svm.latestBlockhash();
        tx.add(playIx);
        tx.sign(player);

        const result = svm.sendTransaction(tx);
        if (result === null) break;

        const sessionAccount = svm.getAccount(sessionPDA);
        if (!sessionAccount) break;

        const sessionData = parseSessionData(sessionAccount.data);
        if (sessionData.status !== "Active") break;
      }

      const sessionAccount = svm.getAccount(sessionPDA);
      expect(sessionAccount).to.not.be.null;

      const sessionData = parseSessionData(sessionAccount!.data);
      // Verify dive number increased or session was lost
      expect(sessionData.diveNumber > 1 || sessionData.status === "Lost").to.be
        .true;
    });
  });

  describe("Reserved Funds Management", () => {
    beforeEach(() => {
      // Initialize config
      const configData = buildInitConfigData({});
      const configIx = new TransactionInstruction({
        keys: [
          { pubkey: authority.publicKey, isSigner: true, isWritable: true },
          { pubkey: configPDA, isSigner: false, isWritable: true },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        programId: PROGRAM_ID,
        data: configData,
      });

      const configTx = new Transaction();
      configTx.recentBlockhash = svm.latestBlockhash();
      configTx.add(configIx);
      configTx.sign(authority);
      svm.sendTransaction(configTx);

      // Initialize house vault
      const vaultData = buildInitHouseVaultData(false);
      const vaultIx = new TransactionInstruction({
        keys: [
          { pubkey: authority.publicKey, isSigner: true, isWritable: true },
          { pubkey: houseVaultPDA, isSigner: false, isWritable: true },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        programId: PROGRAM_ID,
        data: vaultData,
      });

      const vaultTx = new Transaction();
      vaultTx.recentBlockhash = svm.latestBlockhash();
      vaultTx.add(vaultIx);
      vaultTx.sign(authority);
      svm.sendTransaction(vaultTx);

      // Fund house vault
      svm.airdrop(houseVaultPDA, 1000n * BigInt(LAMPORTS_PER_SOL));
    });

    it("should correctly track reserved funds for single session", () => {
      const player = new Keypair();
      svm.airdrop(player.publicKey, 10n * BigInt(LAMPORTS_PER_SOL));

      const [sessionPDA] = getSessionPDA(player.publicKey, new BN(0));
      const betAmount = lamports(TEST_AMOUNTS.MEDIUM);
      const data = buildStartSessionData(betAmount, new BN(0));

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: player.publicKey, isSigner: true, isWritable: true },
          { pubkey: configPDA, isSigner: false, isWritable: false },
          { pubkey: houseVaultPDA, isSigner: false, isWritable: true },
          { pubkey: authority.publicKey, isSigner: false, isWritable: false },
          { pubkey: sessionPDA, isSigner: false, isWritable: true },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        programId: PROGRAM_ID,
        data,
      });

      const tx = new Transaction();
      tx.recentBlockhash = svm.latestBlockhash();
      tx.add(instruction);
      tx.sign(player);
      svm.sendTransaction(tx);

      const vaultAccount = svm.getAccount(houseVaultPDA);
      const vaultData = parseHouseVaultData(vaultAccount!.data);

      const expectedReserved = betAmount.muln(100); // max_payout = bet * 100
      expect(vaultData.totalReserved.toString()).to.equal(
        expectedReserved.toString()
      );
    });

    it("should accumulate reserved funds for multiple sessions", () => {
      const players = [new Keypair(), new Keypair(), new Keypair()];

      const betAmount = lamports(TEST_AMOUNTS.SMALL);
      let totalExpectedReserved = new BN(0);

      for (let i = 0; i < players.length; i++) {
        const player = players[i];
        svm.airdrop(player.publicKey, 10n * BigInt(LAMPORTS_PER_SOL));

        const [sessionPDA] = getSessionPDA(player.publicKey, new BN(0));
        const data = buildStartSessionData(betAmount, new BN(0));

        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: player.publicKey, isSigner: true, isWritable: true },
            { pubkey: configPDA, isSigner: false, isWritable: false },
            { pubkey: houseVaultPDA, isSigner: false, isWritable: true },
            { pubkey: authority.publicKey, isSigner: false, isWritable: false },
            { pubkey: sessionPDA, isSigner: false, isWritable: true },
            {
              pubkey: SystemProgram.programId,
              isSigner: false,
              isWritable: false,
            },
          ],
          programId: PROGRAM_ID,
          data,
        });

        const tx = new Transaction();
        tx.recentBlockhash = svm.latestBlockhash();
        tx.add(instruction);
        tx.sign(player);
        svm.sendTransaction(tx);

        totalExpectedReserved = totalExpectedReserved.add(betAmount.muln(100));
      }

      const vaultAccount = svm.getAccount(houseVaultPDA);
      const vaultData = parseHouseVaultData(vaultAccount!.data);

      expect(vaultData.totalReserved.toString()).to.equal(
        totalExpectedReserved.toString()
      );
    });
  });

  describe("Edge Cases & Boundaries", () => {
    beforeEach(() => {
      // Initialize config
      const configData = buildInitConfigData({});
      const configIx = new TransactionInstruction({
        keys: [
          { pubkey: authority.publicKey, isSigner: true, isWritable: true },
          { pubkey: configPDA, isSigner: false, isWritable: true },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        programId: PROGRAM_ID,
        data: configData,
      });

      const configTx = new Transaction();
      configTx.recentBlockhash = svm.latestBlockhash();
      configTx.add(configIx);
      configTx.sign(authority);
      svm.sendTransaction(configTx);

      // Initialize house vault
      const vaultData = buildInitHouseVaultData(false);
      const vaultIx = new TransactionInstruction({
        keys: [
          { pubkey: authority.publicKey, isSigner: true, isWritable: true },
          { pubkey: houseVaultPDA, isSigner: false, isWritable: true },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        programId: PROGRAM_ID,
        data: vaultData,
      });

      const vaultTx = new Transaction();
      vaultTx.recentBlockhash = svm.latestBlockhash();
      vaultTx.add(vaultIx);
      vaultTx.sign(authority);
      svm.sendTransaction(vaultTx);

      // Fund house vault with massive amount for large bets
      svm.airdrop(houseVaultPDA, 10000n * BigInt(LAMPORTS_PER_SOL));
    });

    it("should handle minimum bet amount (1 lamport)", () => {
      const player = new Keypair();
      svm.airdrop(player.publicKey, 10n * BigInt(LAMPORTS_PER_SOL));

      const [sessionPDA] = getSessionPDA(player.publicKey, new BN(0));
      const data = buildStartSessionData(new BN(1), new BN(0));

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: player.publicKey, isSigner: true, isWritable: true },
          { pubkey: configPDA, isSigner: false, isWritable: false },
          { pubkey: houseVaultPDA, isSigner: false, isWritable: true },
          { pubkey: authority.publicKey, isSigner: false, isWritable: false },
          { pubkey: sessionPDA, isSigner: false, isWritable: true },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        programId: PROGRAM_ID,
        data,
      });

      const tx = new Transaction();
      tx.recentBlockhash = svm.latestBlockhash();
      tx.add(instruction);
      tx.sign(player);

      const result = svm.sendTransaction(tx);
      expect(result).to.not.be.null;

      const sessionAccount = svm.getAccount(sessionPDA);
      const sessionData = parseSessionData(sessionAccount!.data);
      expect(sessionData.betAmount.toString()).to.equal("1");
      expect(sessionData.maxPayout.toString()).to.equal("100"); // 1 * 100
    });

    it("should handle large bet amount (10 SOL)", () => {
      const player = new Keypair();
      svm.airdrop(player.publicKey, 100n * BigInt(LAMPORTS_PER_SOL));

      const [sessionPDA] = getSessionPDA(player.publicKey, new BN(0));
      const betAmount = lamports(TEST_AMOUNTS.LARGE); // 10 SOL
      const data = buildStartSessionData(betAmount, new BN(0));

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: player.publicKey, isSigner: true, isWritable: true },
          { pubkey: configPDA, isSigner: false, isWritable: false },
          { pubkey: houseVaultPDA, isSigner: false, isWritable: true },
          { pubkey: authority.publicKey, isSigner: false, isWritable: false },
          { pubkey: sessionPDA, isSigner: false, isWritable: true },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        programId: PROGRAM_ID,
        data,
      });

      const tx = new Transaction();
      tx.recentBlockhash = svm.latestBlockhash();
      tx.add(instruction);
      tx.sign(player);

      const result = svm.sendTransaction(tx);
      expect(result).to.not.be.null;

      const sessionAccount = svm.getAccount(sessionPDA);
      const sessionData = parseSessionData(sessionAccount!.data);
      expect(sessionData.betAmount.toString()).to.equal(betAmount.toString());

      const expectedMaxPayout = betAmount.muln(100);
      expect(sessionData.maxPayout.toString()).to.equal(
        expectedMaxPayout.toString()
      );
    });

    it("should handle multiple sessions for same user", () => {
      const player = new Keypair();
      svm.airdrop(player.publicKey, 50n * BigInt(LAMPORTS_PER_SOL));

      const sessionIndices = [0, 1, 2];
      const betAmount = lamports(TEST_AMOUNTS.TINY);

      for (const index of sessionIndices) {
        const [sessionPDA] = getSessionPDA(player.publicKey, new BN(index));
        const data = buildStartSessionData(betAmount, new BN(index));

        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: player.publicKey, isSigner: true, isWritable: true },
            { pubkey: configPDA, isSigner: false, isWritable: false },
            { pubkey: houseVaultPDA, isSigner: false, isWritable: true },
            { pubkey: authority.publicKey, isSigner: false, isWritable: false },
            { pubkey: sessionPDA, isSigner: false, isWritable: true },
            {
              pubkey: SystemProgram.programId,
              isSigner: false,
              isWritable: false,
            },
          ],
          programId: PROGRAM_ID,
          data,
        });

        const tx = new Transaction();
        tx.recentBlockhash = svm.latestBlockhash();
        tx.add(instruction);
        tx.sign(player);

        const result = svm.sendTransaction(tx);
        expect(result).to.not.be.null;
      }

      // Verify all sessions exist
      for (const index of sessionIndices) {
        const [sessionPDA] = getSessionPDA(player.publicKey, new BN(index));
        const sessionAccount = svm.getAccount(sessionPDA);
        expect(sessionAccount).to.not.be.null;

        const sessionData = parseSessionData(sessionAccount!.data);
        expect(sessionData.user.toBase58()).to.equal(
          player.publicKey.toBase58()
        );
      }

      // Verify total reserved = 3 * (bet * 100)
      const vaultAccount = svm.getAccount(houseVaultPDA);
      const vaultData = parseHouseVaultData(vaultAccount!.data);
      const expectedReserved = betAmount.muln(100).muln(3);
      expect(vaultData.totalReserved.toString()).to.equal(
        expectedReserved.toString()
      );
    });
  });

  describe("System Integration Tests", () => {
    it("should handle airdrops", () => {
      const recipient = Keypair.generate();
      const amount = 5n * BigInt(LAMPORTS_PER_SOL);

      svm.airdrop(recipient.publicKey, amount);

      const balance = svm.getBalance(recipient.publicKey);
      expect(balance).to.equal(amount);
    });

    it("should process basic transfers", () => {
      const sender = Keypair.generate();
      const receiver = Keypair.generate();

      svm.airdrop(sender.publicKey, BigInt(LAMPORTS_PER_SOL));

      const transferAmount = 100000n;
      const instruction = SystemProgram.transfer({
        fromPubkey: sender.publicKey,
        toPubkey: receiver.publicKey,
        lamports: Number(transferAmount),
      });

      const tx = new Transaction();
      tx.recentBlockhash = svm.latestBlockhash();
      tx.add(instruction);
      tx.sign(sender);

      svm.sendTransaction(tx);

      const receiverBalance = svm.getBalance(receiver.publicKey);
      expect(receiverBalance).to.equal(transferAmount);
    });
  });
});
