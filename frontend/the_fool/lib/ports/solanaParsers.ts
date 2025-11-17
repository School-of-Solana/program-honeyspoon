/**
 * Solana Account Data Parsers
 * 
 * Functions to deserialize on-chain account data into TypeScript types.
 * 
 * CRITICAL: Parsing logic MUST match the on-chain account layouts exactly!
 * See: anchor_project/the_fool/programs/dive_game/src/states.rs
 */

import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

/**
 * Session status enum - matches contract SessionStatus
 */
export type SessionStatus = "Active" | "Lost" | "CashedOut";

/**
 * GameSession account data
 * Matches: pub struct GameSession in states.rs
 */
export interface SessionAccount {
  user: PublicKey;           // Pubkey
  houseVault: PublicKey;     // Pubkey
  status: SessionStatus;     // enum SessionStatus
  betAmount: BN;             // u64
  currentTreasure: BN;       // u64
  maxPayout: BN;             // u64
  diveNumber: number;        // u16
  bump: number;              // u8
  rngSeed: Buffer;           // [u8; 32]
}

/**
 * HouseVault account data
 * Matches: pub struct HouseVault in states.rs
 */
export interface HouseVaultAccount {
  houseAuthority: PublicKey; // Pubkey
  locked: boolean;           // bool
  totalReserved: BN;         // u64
  bump: number;              // u8
}

/**
 * GameConfig account data
 * Matches: pub struct GameConfig in states.rs
 */
export interface GameConfigAccount {
  admin: PublicKey;                 // Pubkey
  baseSurvivalPpm: number;          // u32
  decayPerDivePpm: number;          // u32
  minSurvivalPpm: number;           // u32
  treasureMultiplierNum: number;    // u16
  treasureMultiplierDen: number;    // u16
  maxPayoutMultiplier: number;      // u16
  maxDives: number;                 // u16
  minBet: BN;                       // u64
  maxBet: BN;                       // u64
  bump: number;                     // u8
}

/**
 * Parse GameSession account data
 * 
 * Layout:
 * - [0..8]    discriminator (8 bytes)
 * - [8..40]   user (Pubkey, 32 bytes)
 * - [40..72]  house_vault (Pubkey, 32 bytes)
 * - [72..73]  status (enum variant, 1 byte)
 * - [73..81]  bet_amount (u64, 8 bytes)
 * - [81..89]  current_treasure (u64, 8 bytes)
 * - [89..97]  max_payout (u64, 8 bytes)
 * - [97..99]  dive_number (u16, 2 bytes)
 * - [99..100] bump (u8, 1 byte)
 * - [100..132] rng_seed ([u8; 32], 32 bytes)
 */
export function parseSessionData(dataInput: Uint8Array | Buffer): SessionAccount {
  const data = Buffer.from(dataInput);
  let offset = 8; // skip 8-byte discriminator

  const user = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  const houseVault = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  const statusVariant = data.readUInt8(offset);
  offset += 1;
  
  // SessionStatus enum variants: Active = 0, Lost = 1, CashedOut = 2
  const status: SessionStatus =
    statusVariant === 0 
      ? "Active" 
      : statusVariant === 1 
        ? "Lost" 
        : "CashedOut";

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
  // offset += 32; // not needed, end of struct

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
 * Parse HouseVault account data
 * 
 * Layout:
 * - [0..8]    discriminator (8 bytes)
 * - [8..40]   house_authority (Pubkey, 32 bytes)
 * - [40..41]  locked (bool, 1 byte)
 * - [41..49]  total_reserved (u64, 8 bytes)
 * - [49..50]  bump (u8, 1 byte)
 */
export function parseHouseVaultData(
  dataInput: Uint8Array | Buffer
): HouseVaultAccount {
  const data = Buffer.from(dataInput);
  let offset = 8; // skip discriminator

  const houseAuthority = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  const locked = data.readUInt8(offset) === 1;
  offset += 1;

  const totalReserved = new BN(data.slice(offset, offset + 8), "le");
  offset += 8;

  const bump = data.readUInt8(offset);
  // offset += 1; // not needed, end of struct

  return {
    houseAuthority,
    locked,
    totalReserved,
    bump,
  };
}

/**
 * Parse GameConfig account data
 * 
 * Layout:
 * - [0..8]     discriminator (8 bytes)
 * - [8..40]    admin (Pubkey, 32 bytes)
 * - [40..44]   base_survival_ppm (u32, 4 bytes)
 * - [44..48]   decay_per_dive_ppm (u32, 4 bytes)
 * - [48..52]   min_survival_ppm (u32, 4 bytes)
 * - [52..54]   treasure_multiplier_num (u16, 2 bytes)
 * - [54..56]   treasure_multiplier_den (u16, 2 bytes)
 * - [56..58]   max_payout_multiplier (u16, 2 bytes)
 * - [58..60]   max_dives (u16, 2 bytes)
 * - [60..68]   min_bet (u64, 8 bytes)
 * - [68..76]   max_bet (u64, 8 bytes)
 * - [76..77]   bump (u8, 1 byte)
 */
export function parseGameConfigData(
  dataInput: Uint8Array | Buffer
): GameConfigAccount {
  const data = Buffer.from(dataInput);
  let offset = 8; // skip discriminator

  const admin = new PublicKey(data.slice(offset, offset + 32));
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

  const minBet = new BN(data.slice(offset, offset + 8), "le");
  offset += 8;

  const maxBet = new BN(data.slice(offset, offset + 8), "le");
  offset += 8;

  const bump = data.readUInt8(offset);
  // offset += 1; // not needed, end of struct

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

/**
 * Helper: Parse SessionStatus enum variant
 */
export function parseSessionStatus(variant: number): SessionStatus {
  switch (variant) {
    case 0:
      return "Active";
    case 1:
      return "Lost";
    case 2:
      return "CashedOut";
    default:
      throw new Error(`Unknown SessionStatus variant: ${variant}`);
  }
}

/**
 * Helper: Convert SessionStatus to variant number
 */
export function sessionStatusToVariant(status: SessionStatus): number {
  switch (status) {
    case "Active":
      return 0;
    case "Lost":
      return 1;
    case "CashedOut":
      return 2;
    default:
      throw new Error(`Unknown SessionStatus: ${status}`);
  }
}
