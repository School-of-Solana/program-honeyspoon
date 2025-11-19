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
  // Returns account with snake_case field names matching the IDL
  const decoded = program.coder.accounts.decode("HouseVault", data);
  
  return decoded as HouseVaultAccount;
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
  
  // Returns account with snake_case field names matching the IDL
  const decoded = program.coder.accounts.decode("GameConfig", data);
  
  return decoded as GameConfigAccount;
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
  
  // Returns account with snake_case field names matching the IDL
  const decoded = program.coder.accounts.decode("GameSession", data);
  
  return decoded as GameSessionAccount;
}

// Legacy alias
export const parseSessionData = parseGameSessionData;
