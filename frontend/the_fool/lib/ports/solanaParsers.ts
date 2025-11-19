/**
 * Solana Account Data Parsers
 *
 * Functions to deserialize on-chain account data into TypeScript types.
 *
 * CRITICAL: Parsing logic MUST match the on-chain account layouts exactly!
 * See: anchor_project/the_fool/programs/dive_game/src/states.rs
 *
 * NOTE: Types and parsers are AUTO-GENERATED from Rust structs.
 * Run `npm run generate-parsers` to regenerate from states.rs
 */

// Re-export all generated types and parsers
export type {
  SessionStatus,
  HouseVaultAccount,
  GameConfigAccount,
  GameSessionAccount,
} from "./solanaParsers.generated";

export {
  parseSessionStatus,
  SessionStatusToVariant,
  parseHouseVaultData,
  parseGameConfigData,
  parseGameSessionData,
} from "./solanaParsers.generated";

// Legacy aliases for backwards compatibility
export type { GameSessionAccount as SessionAccount } from "./solanaParsers.generated";
export { parseGameSessionData as parseSessionData } from "./solanaParsers.generated";
