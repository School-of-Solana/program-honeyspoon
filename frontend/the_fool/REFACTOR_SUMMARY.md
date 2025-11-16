# SOLANA REFACTORING - QUICK REFERENCE

## THE BIG IDEA

Instead of rewriting everything for Solana, we create a **single interface** (`GameChainPort`) that both in-memory and Solana implementations follow. The rest of your code never changes.

```
┌─────────────────────────────────────────┐
│         UI & Game Logic                 │
│       (stays exactly the same)          │
└──────────────┬──────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│       GameChainPort Interface            │
│  (placeBet, playRound, cashOut)          │
└─────────┬────────────────────────┬───────┘
          │                        │
          ▼                        ▼
┌─────────────────┐      ┌──────────────────┐
│ LocalGameChain  │      │ SolanaGameChain  │
│  (in-memory)    │      │  (Anchor PDAs)   │
└─────────────────┘      └──────────────────┘
```

## WHAT NEEDS TO CHANGE

### 1. CREATE ABSTRACTION (New Files)
- `lib/ports/GameChainPort.ts` - Interface definition
- `lib/ports/GameErrors.ts` - Structured error codes
- `lib/utils/lamports.ts` - SOL/lamports conversion
- `lib/ports/LocalGameChain.ts` - Wraps existing logic
- `lib/ports/index.ts` - Factory to get chain instance

### 2. REFACTOR EXISTING (Modify Files)
- `app/actions/gameEngine.ts` - Use `getGameChain()` instead of direct `walletStore`
- `app/page.tsx` - Check `error.code` instead of `message.includes()`
- `app/actions/gameActions.ts` - Re-throw `GameError` properly

### 3. ADD TESTS (New Files)
- `tests/unit/ports/GameChainPort.test.ts` - Black-box contract tests
- `tests/unit/ports/GameErrors.test.ts` - Error code scenarios

## THE 4 SOLANA INSTRUCTIONS (Future)

When you're ready, you'll build an Anchor program with only:

```rust
pub fn place_bet(ctx, amount: u64, max_payout: u64)
pub fn play_round(ctx, round_num: u64, treasure: u64)  
pub fn cash_out(ctx, final_treasure: u64)
pub fn cancel_session(ctx)
```

That's it! **No game logic in the contract.** All probabilities, multipliers, and rules stay in TypeScript.

## WHY THIS WORKS

| Before Refactor | After Refactor |
|----------------|----------------|
| Game logic + storage tightly coupled | Clean separation via interface |
| String error messages | Typed error codes |
| Dollar amounts (float) | Lamports (bigint) - Solana native |
| Direct wallet mutations | Immutable state updates |
| 900 lines to migrate | 200 lines to swap |

## SWITCHING TO SOLANA (When Ready)

```typescript
// In .env
BLOCKCHAIN_MODE=local   // Current
BLOCKCHAIN_MODE=solana  // Just flip this!

// That's it. Zero code changes.
```

## FILE STRUCTURE

```
lib/
├── ports/                    [NEW DIRECTORY]
│   ├── GameChainPort.ts     Interface
│   ├── GameErrors.ts        Error codes
│   ├── LocalGameChain.ts    In-memory impl
│   ├── SolanaGameChain.ts   Solana impl (future)
│   └── index.ts             Factory
├── utils/
│   └── lamports.ts          [NEW] SOL conversion
└── [existing files unchanged]

app/actions/
├── gameEngine.ts            [REFACTORED] Uses getGameChain()
└── gameActions.ts           [MINOR] Better error handling

tests/unit/ports/
└── GameChainPort.test.ts    [NEW] Black-box tests
```

## PRIORITY ORDER

**MUST DO NOW:**
1. Create `GameChainPort` interface
2. Create error codes enum
3. Wrap existing logic in `LocalGameChain`
4. Update server actions to use chain port
5. Fix UI error handling (use codes)

**NICE TO HAVE:**
- Abstract randomness
- Add contract tests
- Create Solana stub

**LATER (When Integrating):**
- Build Anchor program
- Implement `SolanaGameChain`
- Deploy to devnet
- Test with real SOL

## KEY PRINCIPLES

1. **Minimize On-Chain Logic** - Only store state, not compute rules
2. **Use Error Codes** - Maps to Anchor's error enums  
3. **Think in Lamports** - Native Solana units, avoid float bugs
4. **Interface-First** - Swap implementations, not consumers
5. **Test the Contract** - Black-box tests work for both impls

## BENEFITS

✅ **Zero breaking changes** - Existing code keeps working  
✅ **Type-safe** - Compiler catches mismatches  
✅ **Testable** - Mock the interface easily  
✅ **Future-proof** - Swap backends without touching game logic  
✅ **Cheaper** - 1 transaction per game vs 50  
✅ **Safer** - Structured errors, no string matching  

## TOTAL EFFORT

- **8 new files** (~1200 lines)
- **4 modified files** (~100 lines changed)
- **0 breaking changes**

---

See `SOLANA_REFACTOR_PLAN.md` for detailed implementation steps.
