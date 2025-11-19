/**
 * Anchor Account Parsers using Official Anchor Coder
 * 
 * This is the OFFICIAL way to parse Anchor accounts.
 * Uses Anchor's BorshAccountsCoder which is generated from the IDL.
 * 
 * Benefits:
 * - Uses Anchor's official decoder (no manual parsing!)
 * - Automatically handles discriminators
 * - Types are guaranteed to match on-chain layout
 * - Zero-maintenance (updates with IDL)
 * 
 * This replaces our custom parser generator completely.
 */

import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import type { DiveGame } from "./idl/dive_game";
import  IDL from "./idl/dive_game.json";
import type { HouseVaultAccount, GameConfigAccount, GameSessionAccount } from "./types";

// Singleton program instance for decoding
let cachedProgram: Program<DiveGame> | null = null;

function getProgram(connection?: Connection): Program<DiveGame> {
  if (!cachedProgram) {
    const conn = connection || new Connection("https://api.devnet.solana.com");
    // We only need the program for its coder, not for transactions
    // So we can use a dummy wallet
    const provider = new AnchorProvider(conn, {} as any, {});
    cachedProgram = new Program(IDL as DiveGame, provider);
  }
  return cachedProgram;
}

/**
 * Parse HouseVault account using Anchor's official coder
 */
export function parseHouseVaultData(
  dataInput: Uint8Array | Buffer,
  connection?: Connection
): HouseVaultAccount {
  const program = getProgram(connection);
  const data = Buffer.from(dataInput);
  
  // Use Anchor's BorshAccountsCoder to decode
  const decoded = program.coder.accounts.decode("HouseVault", data);
  
  return {
    house_authority: decoded.houseAuthority,
    game_keeper: decoded.gameKeeper,
    locked: decoded.locked,
    total_reserved: new BN(decoded.totalReserved),
    bump: decoded.bump,
  };
}

/**
 * Parse GameConfig account using Anchor's official coder
 */
export function parseGameConfigData(
  dataInput: Uint8Array | Buffer,
  connection?: Connection
): GameConfigAccount {
  const program = getProgram(connection);
  const data = Buffer.from(dataInput);
  
  const decoded = program.coder.accounts.decode("GameConfig", data);
  
  return {
    admin: decoded.admin,
    base_survival_ppm: decoded.baseSurvivalPpm,
    decay_per_dive_ppm: decoded.decayPerDivePpm,
    min_survival_ppm: decoded.minSurvivalPpm,
    treasure_multiplier_num: decoded.treasureMultiplierNum,
    treasure_multiplier_den: decoded.treasureMultiplierDen,
    max_payout_multiplier: decoded.maxPayoutMultiplier,
    max_dives: decoded.maxDives,
    min_bet: new BN(decoded.minBet),
    max_bet: new BN(decoded.maxBet),
    bump: decoded.bump,
  };
}

/**
 * Parse GameSession account using Anchor's official coder
 */
export function parseGameSessionData(
  dataInput: Uint8Array | Buffer,
  connection?: Connection
): GameSessionAccount {
  const program = getProgram(connection);
  const data = Buffer.from(dataInput);
  
  const decoded = program.coder.accounts.decode("GameSession", data);
  
  return {
    user: decoded.user,
    house_vault: decoded.houseVault,
    status: decoded.status,
    bet_amount: new BN(decoded.betAmount),
    current_treasure: new BN(decoded.currentTreasure),
    max_payout: new BN(decoded.maxPayout),
    dive_number: decoded.diveNumber,
    bump: decoded.bump,
    last_active_slot: new BN(decoded.lastActiveSlot),
  };
}

// Legacy alias
export const parseSessionData = parseGameSessionData;
