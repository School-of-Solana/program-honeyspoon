# TypeScript Type Generation for Anchor Programs

## Overview

We explored multiple approaches to generate TypeScript types and parsers from Rust/Anchor code. Here's what we found:

## ✅ RECOMMENDED: Anchor's Built-in IDL Types + BorshAccountsCoder

**File**: `/frontend/the_fool/lib/solana/accountParsers.ts`

### How It Works:
1. Anchor automatically generates `dive_game.ts` from IDL (via `sync-idl.sh`)
2. Use `IdlAccounts<DiveGame>` to extract account types
3. Use `Program.coder.accounts.decode()` to parse account data

### Benefits:
- ✅ **Official Anchor solution** - uses built-in tools
- ✅ **Zero maintenance** - updates automatically with IDL
- ✅ **Type-safe** - TypeScript types match on-chain layout
- ✅ **No manual parsing** - Anchor handles Borsh deserialization
- ✅ **Handles discriminators** - automatically strips 8-byte discriminator

### Code Example:
```typescript
import { IdlAccounts, Program } from "@coral-xyz/anchor";
import type { DiveGame } from "./idl/dive_game";

// Extract types from IDL
export type HouseVaultAccount = IdlAccounts<DiveGame>["HouseVault"];

// Parse using Anchor's coder
export function parseHouseVaultData(data: Buffer): HouseVaultAccount {
  const program = new Program(IDL as DiveGame, provider);
  return program.coder.accounts.decode("HouseVault", data);
}
```

### Workflow:
```
1. Update Rust code
2. Run: anchor build
3. Run: npm run sync-idl (syncs IDL to frontend)
4. Types are automatically updated!
```

---

## ❌ NOT RECOMMENDED: tsify

**What It Is**: Rust crate that generates TS types for wasm-bindgen

### Why Not Use It:
- ❌ Designed for **wasm-bindgen**, not Anchor
- ❌ Uses **serde serialization**, but Anchor uses **Borsh**
- ❌ Doesn't understand Anchor **discriminators**
- ❌ Would need to compile Rust to WASM (unnecessary)
- ❌ Adds complexity without benefits for Anchor projects

### When To Use:
- ✅ WASM projects using wasm-bindgen
- ✅ Projects that need runtime type conversion
- ❌ **Never for Anchor/Solana projects**

---

## ⚠️ HACKY BUT WORKED: Custom Parser Generator

**File**: `/scripts/generate-parsers.ts` (deprecated)

### How It Worked:
- Regex parsing of Rust `states.rs` file
- Generated TypeScript interfaces and manual parsers
- Calculated byte offsets manually

### Why We Built It:
- Fixed the **missing `gameKeeper` field bug** that caused 7.4B SOL misread
- Proved that auto-generation prevents bugs

### Why It's Hacky:
- ❌ Regex parsing is fragile
- ❌ Doesn't handle complex types (enums, nested structs)
- ❌ Requires maintenance when Rust syntax changes
- ❌ Duplicates what Anchor already does

### Value:
- ✅ Demonstrated the concept
- ✅ Fixed the immediate bug
- ✅ Led us to discover the proper solution

---

## The Bug We Fixed

### Root Cause:
TypeScript parser was missing the `game_keeper` field (32 bytes), causing it to read wrong memory offsets:

```rust
// Rust struct (states.rs)
pub struct HouseVault {
    pub house_authority: Pubkey, // 32 bytes
    pub game_keeper: Pubkey,     // 32 bytes ← MISSING in TS!
    pub locked: bool,            // 1 byte
    pub total_reserved: u64,     // 8 bytes
    pub bump: u8,                // 1 byte
}
```

```typescript
// OLD TypeScript parser (WRONG)
offset = 8; // skip discriminator
houseAuthority = data.slice(offset, offset + 32); offset += 32;
locked = data.readUInt8(offset); // ❌ Reading game_keeper bytes!
totalReserved = data.slice(offset, offset + 8); // ❌ Reading garbage!
```

**Result**: `totalReserved` read as 7,492,452,401.936 SOL instead of 0!

### The Fix:
Using Anchor's `BorshAccountsCoder` automatically handles all fields correctly:

```typescript
// NEW: Using Anchor's decoder (CORRECT)
const decoded = program.coder.accounts.decode("HouseVault", data);
// ✅ All fields parsed correctly, including game_keeper!
```

---

## Comparison Table

| Approach | Maintenance | Type Safety | Correctness | Recommended |
|----------|-------------|-------------|-------------|-------------|
| **Anchor IDL + Coder** | Zero | ✅ Perfect | ✅ Guaranteed | ✅ **YES** |
| Custom Generator | High | ⚠️ Manual | ⚠️ Bug-prone | ❌ No |
| tsify | Medium | ✅ Good | ❌ Wrong format | ❌ No |
| Manual Parsing | Very High | ❌ None | ❌ Error-prone | ❌ No |

---

## Final Recommendation

**Use Anchor's Built-in Tools:**

1. **Types**: Extract from IDL using `IdlAccounts<YourProgram>`
2. **Parsers**: Use `Program.coder.accounts.decode()`
3. **Updates**: Run `npm run sync-idl` after building contract

This is the official, supported, zero-maintenance approach that the Anchor team designed for this exact use case.

---

## References

- [Anchor TypeScript Client](https://www.anchor-lang.com/docs/typescript-client)
- [Anchor IDL Specification](https://www.anchor-lang.com/docs/idl-specification)
- [BorshAccountsCoder API](https://coral-xyz.github.io/anchor/ts/classes/BorshAccountsCoder.html)
