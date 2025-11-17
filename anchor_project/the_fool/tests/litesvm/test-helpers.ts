import { LiteSVM } from "litesvm";
import {
  PublicKey,
  Transaction,
  SystemProgram,
  Keypair,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
} from "@solana/web3.js";
import type { Signer } from "@solana/web3.js";
import BN from "bn.js";

// ============================================================================
// Constants
// ============================================================================

export const PROGRAM_ID = new PublicKey(
  "5f9Gn6yLcMPqZfFPM9pBYQV1f1h6EBDCSs8jynjfoEQ3"
);

export const HOUSE_VAULT_SEED = "house_vault";
export const SESSION_SEED = "session";
export const GAME_CONFIG_SEED = "game_config";

export const TEST_AMOUNTS = {
  TINY: 0.001,
  SMALL: 0.1,
  MEDIUM: 1,
  LARGE: 10,
};

// ============================================================================
// PDA Helpers
// ============================================================================

export function getConfigPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(GAME_CONFIG_SEED)],
    PROGRAM_ID
  );
}

export function getHouseVaultPDA(
  houseAuthority: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(HOUSE_VAULT_SEED), houseAuthority.toBuffer()],
    PROGRAM_ID
  );
}

export function getSessionPDA(
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

// ============================================================================
// Conversion Helpers
// ============================================================================

export function lamports(sol: number): BN {
  return new BN(Math.round(sol * LAMPORTS_PER_SOL));
}

export function sol(lamports: BN | bigint): number {
  const lamportsBN =
    lamports instanceof BN ? lamports : new BN(lamports.toString());
  return lamportsBN.toNumber() / LAMPORTS_PER_SOL;
}

// ============================================================================
// Serialization Helpers
// ============================================================================

export function serializeOption<T>(value: T | null, size: number): Buffer {
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

// ============================================================================
// Transaction Helpers
// ============================================================================

export interface BuildAndSendTxParams {
  svm: LiteSVM;
  instructions: TransactionInstruction[];
  signers: Signer[];
}

export function buildAndSendTx(params: BuildAndSendTxParams) {
  const { svm, instructions, signers } = params;
  const tx = new Transaction();
  tx.recentBlockhash = svm.latestBlockhash();

  instructions.forEach((ix) => tx.add(ix));
  tx.sign(...signers);

  return svm.sendTransaction(tx);
}

// ============================================================================
// Instruction Builders
// ============================================================================

export interface GameConfigParams {
  baseSurvivalPpm?: number | null;
  decayPerDivePpm?: number | null;
  minSurvivalPpm?: number | null;
  treasureMultiplierNum?: number | null;
  treasureMultiplierDen?: number | null;
  maxPayoutMultiplier?: number | null;
  maxDives?: number | null;
  minBet?: BN | null;
  maxBet?: BN | null;
}

export function buildInitConfigData(params: GameConfigParams): Buffer {
  const discriminator = Buffer.from([208, 127, 21, 1, 194, 190, 196, 70]);

  const parts = [
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
  ];

  return Buffer.concat(parts);
}

export function buildInitHouseVaultData(isLocked: boolean): Buffer {
  const discriminator = Buffer.from([36, 8, 241, 79, 175, 252, 170, 72]);
  const lockedByte = Buffer.from([isLocked ? 1 : 0]);
  return Buffer.concat([discriminator, lockedByte]);
}

export function buildStartSessionData(betAmount: BN, sessionIndex: BN): Buffer {
  const discriminator = Buffer.from([126, 4, 152, 174, 130, 6, 87, 190]);
  const betBuffer = betAmount.toArrayLike(Buffer, "le", 8);
  const indexBuffer = sessionIndex.toArrayLike(Buffer, "le", 8);
  return Buffer.concat([discriminator, betBuffer, indexBuffer]);
}

export function buildPlayRoundData(): Buffer {
  return Buffer.from([62, 241, 0, 151, 88, 72, 219, 217]);
}

export function buildCashOutData(): Buffer {
  return Buffer.from([109, 98, 207, 7, 123, 37, 155, 195]);
}

export function buildLoseSessionData(): Buffer {
  return Buffer.from([203, 44, 58, 22, 70, 7, 102, 42]);
}

export function buildToggleHouseLockData(): Buffer {
  return Buffer.from([224, 8, 223, 134, 139, 162, 145, 238]);
}

// ============================================================================
// Instruction Creation Helpers
// ============================================================================

export function createInitConfigInstruction(
  admin: PublicKey,
  configPDA: PublicKey,
  params: GameConfigParams
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      { pubkey: admin, isSigner: true, isWritable: true },
      { pubkey: configPDA, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: buildInitConfigData(params),
  });
}

export function createInitHouseVaultInstruction(
  authority: PublicKey,
  houseVaultPDA: PublicKey,
  isLocked: boolean
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: houseVaultPDA, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: buildInitHouseVaultData(isLocked),
  });
}

export function createStartSessionInstruction(
  player: PublicKey,
  sessionPDA: PublicKey,
  configPDA: PublicKey,
  houseVaultPDA: PublicKey,
  authority: PublicKey,
  betAmount: BN,
  sessionIndex: BN
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      { pubkey: player, isSigner: true, isWritable: true },
      { pubkey: sessionPDA, isSigner: false, isWritable: true },
      { pubkey: configPDA, isSigner: false, isWritable: false },
      { pubkey: houseVaultPDA, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: buildStartSessionData(betAmount, sessionIndex),
  });
}

export function createPlayRoundInstruction(
  player: PublicKey,
  sessionPDA: PublicKey,
  configPDA: PublicKey
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      { pubkey: player, isSigner: true, isWritable: false },
      { pubkey: sessionPDA, isSigner: false, isWritable: true },
      { pubkey: configPDA, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: buildPlayRoundData(),
  });
}

export function createCashOutInstruction(
  player: PublicKey,
  sessionPDA: PublicKey,
  configPDA: PublicKey,
  houseVaultPDA: PublicKey,
  authority: PublicKey
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      { pubkey: player, isSigner: true, isWritable: true },
      { pubkey: sessionPDA, isSigner: false, isWritable: true },
      { pubkey: configPDA, isSigner: false, isWritable: false },
      { pubkey: houseVaultPDA, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: buildCashOutData(),
  });
}

export function createLoseSessionInstruction(
  player: PublicKey,
  sessionPDA: PublicKey,
  houseVaultPDA: PublicKey,
  authority: PublicKey
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      { pubkey: player, isSigner: true, isWritable: true },
      { pubkey: sessionPDA, isSigner: false, isWritable: true },
      { pubkey: houseVaultPDA, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: buildLoseSessionData(),
  });
}

// ============================================================================
// Account Parsers
// ============================================================================

export interface ParsedSessionData {
  user: PublicKey;
  currentTreasure: BN;
  betAmount: BN;
  numDives: number;
  rngSeed: Buffer;
  sessionIndex: BN;
  status: number;
  bump: number;
}

export function parseSessionData(data: Buffer): ParsedSessionData {
  let offset = 8; // Skip discriminator

  const user = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  const currentTreasure = new BN(data.subarray(offset, offset + 8), "le");
  offset += 8;

  const betAmount = new BN(data.subarray(offset, offset + 8), "le");
  offset += 8;

  const numDives = data.readUInt16LE(offset);
  offset += 2;

  const rngSeed = data.subarray(offset, offset + 32);
  offset += 32;

  const sessionIndex = new BN(data.subarray(offset, offset + 8), "le");
  offset += 8;

  const status = data.readUInt8(offset);
  offset += 1;

  const bump = data.readUInt8(offset);

  return {
    user,
    currentTreasure,
    betAmount,
    numDives,
    rngSeed,
    sessionIndex,
    status,
    bump,
  };
}

export interface ParsedHouseVaultData {
  authority: PublicKey;
  totalReserved: BN;
  isLocked: boolean;
  bump: number;
}

export function parseHouseVaultData(data: Buffer): ParsedHouseVaultData {
  let offset = 8; // Skip discriminator

  const authority = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  const totalReserved = new BN(data.subarray(offset, offset + 8), "le");
  offset += 8;

  const isLocked = data.readUInt8(offset) === 1;
  offset += 1;

  const bump = data.readUInt8(offset);

  return {
    authority,
    totalReserved,
    isLocked,
    bump,
  };
}

export interface ParsedConfigData {
  admin: PublicKey;
  baseSurvivalPpm: number;
  decayPerDivePpm: number;
  minSurvivalPpm: number;
  treasureMultiplierNum: number;
  treasureMultiplierDen: number;
  maxPayoutMultiplier: number;
  maxDives: number;
  minBet: BN;
  maxBet: BN;
  bump: number;
}

export function parseConfigData(data: Buffer): ParsedConfigData {
  let offset = 8; // Skip discriminator

  const admin = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  const baseSurvivalPpm = data.readUInt32LE(offset);
  offset += 4;

  const decayPerDivePpm = data.readUInt32LE(offset);
  offset += 4;

  const minSurvivalPpm = data.readUInt32LE(offset);
  offset += 4;

  const treasureMultiplierNum = data.readUInt16LE(offset);
  offset += 2;

  const treasureMultiplierDen = data.readUInt16LE(offset);
  offset += 2;

  const maxPayoutMultiplier = data.readUInt16LE(offset);
  offset += 2;

  const maxDives = data.readUInt16LE(offset);
  offset += 2;

  const minBet = new BN(data.subarray(offset, offset + 8), "le");
  offset += 8;

  const maxBet = new BN(data.subarray(offset, offset + 8), "le");
  offset += 8;

  const bump = data.readUInt8(offset);

  return {
    admin,
    baseSurvivalPpm,
    decayPerDivePpm,
    minSurvivalPpm,
    treasureMultiplierNum,
    treasureMultiplierDen,
    maxPayoutMultiplier,
    maxDives,
    minBet,
    maxBet,
    bump,
  };
}

// ============================================================================
// Test Fixtures
// ============================================================================

export interface GameFixture {
  svm: LiteSVM;
  authority: Keypair;
  configPDA: PublicKey;
  houseVaultPDA: PublicKey;
  player: Keypair;
  sessionPDA: PublicKey;
  sessionIndex: BN;
}

export interface CreateBasicFixtureParams {
  svm: LiteSVM;
  authority: Keypair;
  configPDA: PublicKey;
  houseVaultPDA: PublicKey;
  configParams?: GameConfigParams;
  fundVault?: BN;
  skipInit?: boolean;
}

export function createBasicFixture(
  params: CreateBasicFixtureParams
): GameFixture {
  const {
    svm,
    authority,
    configPDA,
    houseVaultPDA,
    configParams = {},
    fundVault,
    skipInit = false,
  } = params;

  if (!skipInit) {
    // Initialize config
    const configIx = createInitConfigInstruction(
      authority.publicKey,
      configPDA,
      configParams
    );
    buildAndSendTx({
      svm,
      instructions: [configIx],
      signers: [authority],
    });

    // Initialize vault
    const vaultIx = createInitHouseVaultInstruction(
      authority.publicKey,
      houseVaultPDA,
      false
    );
    buildAndSendTx({
      svm,
      instructions: [vaultIx],
      signers: [authority],
    });

    // Fund vault if requested
    if (fundVault) {
      svm.airdrop(houseVaultPDA, BigInt(fundVault.toString()));
    }
  }

  // Create player
  const player = new Keypair();
  svm.airdrop(player.publicKey, 10n * BigInt(LAMPORTS_PER_SOL));

  // Get session PDA
  const sessionIndex = new BN(0);
  const [sessionPDA] = getSessionPDA(player.publicKey, sessionIndex);

  return {
    svm,
    authority,
    configPDA,
    houseVaultPDA,
    player,
    sessionPDA,
    sessionIndex,
  };
}

export interface StartGameSessionParams extends GameFixture {
  betAmount: BN;
}

export function startGameSession(params: StartGameSessionParams): void {
  const {
    svm,
    player,
    sessionPDA,
    configPDA,
    houseVaultPDA,
    authority,
    betAmount,
    sessionIndex,
  } = params;

  const startIx = createStartSessionInstruction(
    player.publicKey,
    sessionPDA,
    configPDA,
    houseVaultPDA,
    authority.publicKey,
    betAmount,
    sessionIndex
  );

  buildAndSendTx({
    svm,
    instructions: [startIx],
    signers: [player],
  });
}
