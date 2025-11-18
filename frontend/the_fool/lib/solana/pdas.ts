/**
 * PDA (Program Derived Address) derivation helpers
 *
 * CRITICAL: These seeds MUST match the contract exactly!
 *
 * Seeds used in contract (from states.rs):
 * - GameConfig: ["game_config"]
 * - HouseVault: ["house_vault", house_authority.key()]
 * - GameSession: ["session", user.key(), session_index.to_le_bytes()]
 */

import { PublicKey } from "@solana/web3.js";

/**
 * Seed constants - MUST match contract exactly (states.rs)
 */
export const GAME_CONFIG_SEED = "game_config";
export const HOUSE_VAULT_SEED = "house_vault";
export const SESSION_SEED = "session";

/**
 * Derive the game config PDA
 * Seeds: ["game_config"]
 */
export function getGameConfigAddress(
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(GAME_CONFIG_SEED)],
    programId
  );
}

/**
 * Derive the house vault PDA
 * Seeds: ["house_vault", house_authority.key()]
 */
export function getHouseVaultAddress(
  houseAuthority: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(HOUSE_VAULT_SEED), houseAuthority.toBuffer()],
    programId
  );
}

/**
 * Helper: Convert u64 to little-endian buffer (browser-compatible)
 */
function u64ToBuffer(value: number | bigint): Buffer {
  const bigValue = BigInt(value);
  const arr = new Uint8Array(8);
  const view = new DataView(arr.buffer);
  view.setBigUint64(0, bigValue, true); // true = little-endian
  return Buffer.from(arr);
}

/**
 * Derive the game session PDA
 * Seeds: ["session", user.key(), session_index.to_le_bytes()]
 */
export function getSessionAddress(
  user: PublicKey,
  sessionIndex: bigint | number,
  programId: PublicKey
): [PublicKey, number] {
  const indexBuf = u64ToBuffer(sessionIndex);

  return PublicKey.findProgramAddressSync(
    [Buffer.from(SESSION_SEED), user.toBuffer(), indexBuf],
    programId
  );
}

/**
 * Helper: Convert session index to buffer for PDA derivation
 */
export function sessionIndexToBuffer(index: number | bigint): Buffer {
  return u64ToBuffer(index);
}

/**
 * Helper: Generate a mock PDA for LocalGameChain
 * This is NOT cryptographically valid, just for in-memory simulation
 */
export function mockPDA(prefix: string, ...keys: string[]): string {
  return `${prefix}_${keys.join("_")}`;
}

/**
 * Helper: Generate mock house vault PDA
 */
export function mockHouseVaultPDA(authority: string): string {
  return mockPDA(HOUSE_VAULT_SEED, authority);
}

/**
 * Helper: Generate mock session PDA
 */
export function mockSessionPDA(user: string, nonce: string): string {
  return mockPDA(SESSION_SEED, user, nonce);
}
