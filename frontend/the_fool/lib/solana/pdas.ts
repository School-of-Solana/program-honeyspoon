/**
 * PDA (Program Derived Address) derivation helpers
 * 
 * CRITICAL: These seeds MUST match the contract exactly!
 * Contract repo: dive-game-chain
 * 
 * Seeds used in contract:
 * - HouseVault: [HOUSE_VAULT_SEED, house_authority.key()]
 * - GameSession: [SESSION_SEED, user.key(), nonce/index]
 * 
 * NOTE: This file will require @solana/web3.js when implementing SolanaGameChain.
 * For now, it provides the seed constants for reference.
 */

/**
 * Seed constants - MUST match contract exactly
 */
export const HOUSE_VAULT_SEED = "HOUSE_VAULT";
export const SESSION_SEED = "SESSION_SEED";

/**
 * TODO: When implementing SolanaGameChain, add these functions:
 * 
 * import { PublicKey } from "@solana/web3.js";
 * 
 * export function getHouseVaultAddress(
 *   houseAuthority: PublicKey,
 *   programId: PublicKey
 * ): [PublicKey, number] {
 *   return PublicKey.findProgramAddressSync(
 *     [
 *       Buffer.from(HOUSE_VAULT_SEED),
 *       houseAuthority.toBuffer(),
 *     ],
 *     programId
 *   );
 * }
 * 
 * export function getSessionAddress(
 *   user: PublicKey,
 *   sessionNonce: Buffer,
 *   programId: PublicKey
 * ): [PublicKey, number] {
 *   return PublicKey.findProgramAddressSync(
 *     [
 *       Buffer.from(SESSION_SEED),
 *       user.toBuffer(),
 *       sessionNonce,
 *     ],
 *     programId
 *   );
 * }
 * 
 * export function sessionNonceFromIndex(index: number): Buffer {
 *   const buf = Buffer.alloc(8);
 *   buf.writeBigUInt64LE(BigInt(index));
 *   return buf;
 * }
 */

/**
 * Helper: Generate a mock PDA for LocalGameChain
 * This is NOT cryptographically valid, just for in-memory simulation
 */
export function mockPDA(prefix: string, ...keys: string[]): string {
  return `${prefix}_${keys.join('_')}`;
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
