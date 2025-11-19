/**
 * Anchor Account Parsers using Borsh Coder
 * 
 * This implementation uses Anchor's BorshCoder directly to decode accounts
 * without needing a full Program instance.
 */

import { BN, BorshCoder, Idl } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import  IDL_JSON from "./idl/dive_game.json";
import type { HouseVaultAccount, GameConfigAccount, GameSessionAccount } from "./types";

// Singleton coder instance for decoding
let cachedCoder: BorshCoder | null = null;

function getCoder(): BorshCoder {
  if (!cachedCoder) {
    console.log('[accountParsers] Creating BorshCoder from IDL');
    cachedCoder = new BorshCoder(IDL_JSON as Idl);
  }
  return cachedCoder;
}

/**
 * Parse HouseVault account using Borsh coder
 */
export function parseHouseVaultData(
  dataInput: Uint8Array | Buffer
): HouseVaultAccount {
  try {
    const coder = getCoder();
    const data = Buffer.from(dataInput);
    
    console.log('[accountParsers] Decoding HouseVault, data length:', data.length);
    console.log('[accountParsers] First 16 bytes (hex):', data.slice(0, 16).toString('hex'));
    
    // Use Borsh coder to decode - it handles the discriminator automatically
    const decoded = coder.accounts.decode("houseVault", data);
    console.log('[accountParsers] HouseVault decoded successfully!');
    
    return decoded as HouseVaultAccount;
  } catch (error: any) {
    console.error('[accountParsers] Error decoding HouseVault:', error);
    console.error('[accountParsers] Error message:', error.message);
    console.error('[accountParsers] Error stack:', error.stack);
    throw error;
  }
}

/**
 * Parse GameConfig account using Borsh coder
 */
export function parseGameConfigData(
  dataInput: Uint8Array | Buffer
): GameConfigAccount {
  try {
    const coder = getCoder();
    const data = Buffer.from(dataInput);
    
    console.log('[accountParsers] Decoding GameConfig, data length:', data.length);
    
    // Use Borsh coder to decode
    const decoded = coder.accounts.decode("gameConfig", data);
    console.log('[accountParsers] GameConfig decoded successfully:', decoded);
    return decoded as GameConfigAccount;
  } catch (error) {
    console.error('[accountParsers] Error decoding GameConfig:', error);
    throw error;
  }
}

/**
 * Parse GameSession account using Borsh coder
 */
export function parseGameSessionData(
  dataInput: Uint8Array | Buffer
): GameSessionAccount {
  try {
    const coder = getCoder();
    const data = Buffer.from(dataInput);
    
    console.log('[accountParsers] Decoding GameSession, data length:', data.length);
    
    // Use Borsh coder to decode
    const decoded = coder.accounts.decode("gameSession", data);
    console.log('[accountParsers] GameSession decoded successfully!');
    
    return decoded as GameSessionAccount;
  } catch (error: any) {
    console.error('[accountParsers] Error decoding GameSession:', error);
    throw error;
  }
}

// Legacy alias
export const parseSessionData = parseGameSessionData;
