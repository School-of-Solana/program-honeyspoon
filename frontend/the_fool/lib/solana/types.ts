/**
 * Anchor-Generated Account Types
 * 
 * These types are automatically inferred from the IDL using Anchor's utility types.
 * This is the official, clean way to get TypeScript types for Solana/Anchor programs.
 * 
 * Benefits:
 * - Types are guaranteed to match the on-chain program (generated from IDL)
 * - No manual parsing or code generation needed
 * - Automatically updated when IDL changes (via sync-idl.sh)
 * - Uses Anchor's official type system
 * 
 * AUTO-GENERATED FROM IDL - DO NOT EDIT MANUALLY
 * Run `npm run sync-idl` to regenerate from on-chain program
 */

import { IdlAccounts, IdlTypes } from "@coral-xyz/anchor";
import type { DiveGame } from "./idl/dive_game";

// Account types (matches on-chain struct layout)
export type HouseVaultAccount = IdlAccounts<DiveGame>["HouseVault"];
export type GameConfigAccount = IdlAccounts<DiveGame>["GameConfig"];
export type GameSessionAccount = IdlAccounts<DiveGame>["GameSession"];

// Custom types and enums
export type SessionStatus = IdlTypes<DiveGame>["SessionStatus"];

// Event types
export type InitializeHouseVaultEvent = IdlTypes<DiveGame>["InitializeHouseVaultEvent"];
export type ToggleHouseLockEvent = IdlTypes<DiveGame>["ToggleHouseLockEvent"];

// Re-export for convenience
export type { DiveGame };
