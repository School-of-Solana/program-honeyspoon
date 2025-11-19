/**
 * Solana Account Data Parsers
 *
 * DEPRECATED: This file is kept for backwards compatibility only.
 * 
 * NEW APPROACH: Use Anchor's official IDL-based parsers
 * - Types: lib/solana/types.ts (uses IdlAccounts<DiveGame>)
 * - Parsers: lib/solana/accountParsers.ts (uses Program.coder.accounts.decode())
 * 
 * These parsers use Anchor's BorshAccountsCoder which is:
 * - Automatically generated from IDL
 * - Guaranteed to match on-chain layout
 * - Zero-maintenance (updates with sync-idl)
 * 
 * See TYPE_GENERATION_APPROACHES.md for full explanation.
 */

// Re-export from official Anchor-based parsers
export {
  parseHouseVaultData,
  parseGameConfigData,
  parseGameSessionData,
  parseSessionData,
} from "../solana/accountParsers";

export type {
  HouseVaultAccount,
  GameConfigAccount,
  GameSessionAccount,
  SessionStatus,
} from "../solana/types";

// Legacy alias
export type { GameSessionAccount as SessionAccount } from "../solana/types";
