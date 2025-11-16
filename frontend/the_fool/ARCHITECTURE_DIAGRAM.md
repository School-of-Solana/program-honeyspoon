# ARCHITECTURE: BEFORE & AFTER REFACTORING

## CURRENT ARCHITECTURE (Tightly Coupled)

```
┌─────────────────────────────────────────────────────┐
│                    page.tsx (UI)                    │
│  • handleStartGame()                                │
│  • handleDive()                                     │
│  • handleSurface()                                  │
│  • Error handling: message.includes("session")     │
└────────────────────┬────────────────────────────────┘
                     │ Server Action Calls
                     ▼
┌─────────────────────────────────────────────────────┐
│           app/actions/gameEngine.ts                 │
│  • startGameSession()                               │
│  • executeRound()                                   │
│  • cashOut()                                        │
│  • Direct calls to walletStore                      │
└────────────────────┬────────────────────────────────┘
                     │ Direct mutations
                     ▼
┌─────────────────────────────────────────────────────┐
│              lib/walletStore.ts                     │
│  • userWallets: Map<userId, UserWallet>            │
│  • houseWallet: HouseWallet                        │
│  • activeSessions: Map<sessionId, GameSession>    │
│  • Direct in-memory mutations                       │
└─────────────────────────────────────────────────────┘

PROBLEMS:
❌ Game logic + storage tightly coupled
❌ Can't swap storage without rewriting everything
❌ String error matching is brittle
❌ Float dollar amounts cause precision bugs
❌ Hard to test in isolation
```

---

## NEW ARCHITECTURE (Port & Adapter Pattern)

```
┌──────────────────────────────────────────────────────┐
│                   page.tsx (UI)                      │
│  • handleStartGame()                                 │
│  • handleDive()                                      │
│  • handleSurface()                                   │
│  • Error handling: switch(error.code) { ... }       │
└────────────────────┬─────────────────────────────────┘
                     │ Server Action Calls
                     │ (NO CHANGES NEEDED)
                     ▼
┌──────────────────────────────────────────────────────┐
│           app/actions/gameEngine.ts                  │
│  • startGameSession()                                │
│  • executeRound()                                    │
│  • cashOut()                                         │
│  • Uses: const chain = getGameChain()               │
└────────────────────┬─────────────────────────────────┘
                     │ Interface calls
                     ▼
┌──────────────────────────────────────────────────────┐
│            lib/ports/GameChainPort.ts                │
│  ┌────────────────────────────────────────────────┐ │
│  │  INTERFACE (The Contract)                      │ │
│  │  • placeBet(params) → session                  │ │
│  │  • playRound(params) → state                   │ │
│  │  • cashOut(params) → finalAmount               │ │
│  │  • getHouseStatus() → status                   │ │
│  └────────────────────────────────────────────────┘ │
└────────────────────┬──────────────────┬──────────────┘
                     │                  │
        ┌────────────┘                  └────────────┐
        │                                            │
        ▼                                            ▼
┌─────────────────────┐                 ┌────────────────────┐
│  LocalGameChain     │                 │  SolanaGameChain   │
│  (In-Memory)        │                 │  (Blockchain)      │
├─────────────────────┤                 ├────────────────────┤
│ • Uses walletStore  │                 │ • Uses Anchor SDK  │
│ • Immediate updates │                 │ • Async txs        │
│ • No fees           │                 │ • SOL fees         │
│ • Development mode  │                 │ • Production mode  │
└─────────┬───────────┘                 └────────┬───────────┘
          │                                      │
          ▼                                      ▼
┌─────────────────────┐                 ┌────────────────────┐
│   walletStore.ts    │                 │   Solana Program   │
│  (In-memory Maps)   │                 │   (Anchor/Rust)    │
├─────────────────────┤                 ├────────────────────┤
│ userWallets: Map    │                 │ UserBank PDA       │
│ houseWallet: Object │                 │ HouseVault PDA     │
│ activeSessions: Map │                 │ GameSession PDA    │
└─────────────────────┘                 └────────────────────┘

BENEFITS:
✅ Swap implementations via env var
✅ Structured error codes
✅ Lamports (bigint) for precision
✅ Immutable state updates
✅ Easy to mock/test
✅ Zero breaking changes
```

---

## DATA FLOW COMPARISON

### BEFORE: Direct Mutations

```typescript
// Server Action
async function startGameSession(bet, userId, sessionId) {
  const userWallet = getUserWallet(userId);     // Get from Map
  userWallet.balance -= bet;                    // Mutate!
  updateUserWallet(userWallet);                 // Put back
  
  const houseWallet = getHouseWallet();         // Get singleton
  houseWallet.balance += bet;                   // Mutate!
  updateHouseWallet(houseWallet);               // Put back
  
  const session = { /* ... */ };
  setGameSession(session);                      // Add to Map
  
  return { success: true };
}
```

### AFTER: Interface + Adapter

```typescript
// Server Action
async function startGameSession(bet, userId, sessionId) {
  const chain = getGameChain();  // Factory returns LocalGameChain or SolanaGameChain
  
  const result = await chain.placeBet({
    userPubkey: userId,
    amountLamports: dollarsToLamports(bet),
    maxPayoutLamports: dollarsToLamports(calculateMaxPayout(bet))
  });
  
  return { success: true, sessionId: result.session };
}

// LocalGameChain.placeBet() (hidden behind interface)
async placeBet(params) {
  // Same logic as before, just wrapped
  const userWallet = getUserWallet(params.userPubkey);
  userWallet.balance -= lamportsToDollars(params.amountLamports);
  updateUserWallet(userWallet);
  // ... etc
}

// SolanaGameChain.placeBet() (future - totally different!)
async placeBet(params) {
  // Build Anchor transaction
  const tx = await this.program.methods
    .placeBet(params.amountLamports, params.maxPayoutLamports)
    .accounts({
      user: this.wallet.publicKey,
      userBank: userBankPDA,
      houseVault: houseVaultPDA,
      gameSession: sessionPDA,
    })
    .rpc();
  
  return { session: tx, state: { /* fetch from PDA */ } };
}
```

**Key Insight:** Server actions call the SAME interface. Implementation swaps underneath.

---

## ERROR HANDLING COMPARISON

### BEFORE: String Matching (Brittle)

```typescript
// Server throws
throw new Error("Invalid or inactive game session");

// UI catches
try {
  await startGame(...);
} catch (error) {
  if (error.message.includes("session")) {
    showError("Session expired");
  } else if (error.message.includes("Insufficient")) {
    showError("Not enough balance");
  }
  // What if message changes? BREAKS!
}
```

### AFTER: Error Codes (Type-Safe)

```typescript
// Server throws
throw new GameError(
  GameErrorCode.INVALID_OR_INACTIVE_SESSION,
  "Invalid or inactive game session",
  { sessionId }
);

// UI catches
try {
  await startGame(...);
} catch (error) {
  if (error instanceof GameError) {
    switch (error.code) {
      case GameErrorCode.INVALID_OR_INACTIVE_SESSION:
        showError("Session expired");
        break;
      case GameErrorCode.INSUFFICIENT_USER_FUNDS:
        showError("Not enough balance");
        break;
      // Compiler warns if we miss a case!
    }
  }
}
```

**Bonus:** When you add Solana, Anchor errors map directly to GameErrorCode enum!

---

## SOLANA PROGRAM DESIGN (Future)

### Accounts (PDAs)

```
┌─────────────────────────────────────────┐
│         HouseVault PDA                  │
│  Seeds: ["house_vault"]                 │
├─────────────────────────────────────────┤
│  authority: Pubkey                      │
│  balance: u64 (lamports)                │
│  reserved: u64 (lamports)               │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│         UserBank PDA                    │
│  Seeds: ["user_bank", user_wallet]     │
├─────────────────────────────────────────┤
│  owner: Pubkey                          │
│  games_played: u64                      │
│  total_wagered: u64                     │
│  total_won: u64                         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│       GameSession PDA                   │
│  Seeds: ["session", user, seed]        │
├─────────────────────────────────────────┤
│  user: Pubkey                           │
│  bet_amount: u64                        │
│  current_treasure: u64                  │
│  round_number: u64                      │
│  max_payout: u64                        │
│  status: SessionStatus                  │
│  start_time: i64                        │
└─────────────────────────────────────────┘
```

### Instructions (Minimal!)

```rust
#[program]
pub mod honeyspoon_bank {
    
    // 1. User places bet
    pub fn place_bet(
        ctx: Context<PlaceBet>,
        amount: u64,
        max_payout: u64,
        session_seed: [u8; 32]
    ) -> Result<()> {
        // Transfer: user → house_vault
        // Create: game_session PDA
        // Update: house reserved += max_payout
    }
    
    // 2. Update session after round
    pub fn play_round(
        ctx: Context<PlayRound>,
        round_number: u64,
        new_treasure: u64,
        survived: bool
    ) -> Result<()> {
        // Validate: round_number matches session
        // Update: session.current_treasure
        // If !survived: close session, release reserves
    }
    
    // 3. Cash out winnings
    pub fn cash_out(
        ctx: Context<CashOut>,
        final_treasure: u64
    ) -> Result<()> {
        // Validate: treasure matches session
        // Transfer: house_vault → user
        // Close: session PDA
        // Update: house reserved -= max_payout
    }
    
    // 4. Cancel session (timeout/refund)
    pub fn cancel_session(
        ctx: Context<Cancel>
    ) -> Result<()> {
        // Refund: house_vault → user (original bet)
        // Close: session PDA
    }
}
```

**CRITICAL:** No game logic! No probabilities, multipliers, or RNG in the contract. Just state storage and SOL transfers.

---

## DEPLOYMENT COMPARISON

### Current (In-Memory)

```bash
# Development
npm run dev
# ✅ Instant
# ✅ Free
# ✅ Easy to debug

# Production
npm run build
npm start
# ✅ Single server
# ✅ No blockchain needed
# ❌ Not decentralized
# ❌ Users trust your server
```

### Future (Solana)

```bash
# Development
BLOCKCHAIN_MODE=local npm run dev
# ✅ Still instant
# ✅ Still free
# ✅ Test without blockchain

# Testnet
BLOCKCHAIN_MODE=solana SOLANA_NETWORK=devnet npm start
# ✅ Real blockchain
# ✅ Free SOL via faucet
# ✅ Test with real txs

# Production
BLOCKCHAIN_MODE=solana SOLANA_NETWORK=mainnet npm start
# ✅ Fully decentralized
# ✅ Trustless (on-chain proof)
# ✅ Transparent (anyone can audit)
# ⚠️ Transaction fees (~$0.002 per game)
```

---

## MIGRATION PATH

```
Phase 1: REFACTOR (This PR)
├── Create GameChainPort interface
├── Wrap walletStore in LocalGameChain
├── Update server actions to use chain port
├── Add structured error codes
└── Add contract tests
     ↓
     Status: ✅ Works exactly as before
     Breaking changes: 0
     
Phase 2: STUB (Next PR)
├── Create SolanaGameChain stub
├── Add lamports utilities
├── Abstract randomness
└── Design Anchor program accounts
     ↓
     Status: ✅ Still works, Solana not used yet
     Breaking changes: 0
     
Phase 3: ANCHOR PROGRAM (Week 3)
├── Init Anchor project
├── Implement 4 instructions
├── Write Anchor tests
└── Deploy to devnet
     ↓
     Status: ✅ Both backends available
     Breaking changes: 0 (env var switch)
     
Phase 4: SOLANA ADAPTER (Week 4)
├── Implement SolanaGameChain methods
├── Add wallet adapter UI
├── Test on devnet
└── Deploy to mainnet
     ↓
     Status: ✅ Production-ready
     Breaking changes: 0 (still supports local mode)
```

**The Beauty:** Each phase is fully functional. You can stop at any point and have a working app.

---

## TESTING STRATEGY

```
┌─────────────────────────────────────────┐
│     Contract Tests                      │
│  (Test the interface, not impl)         │
│                                         │
│  ✅ placeBet creates session            │
│  ✅ playRound updates state             │
│  ✅ cashOut transfers funds             │
│  ✅ Errors throw correct codes          │
│  ✅ House balance conserved             │
│                                         │
│  Run against BOTH:                      │
│  • LocalGameChain                       │
│  • SolanaGameChain                      │
└─────────────────────────────────────────┘
         │                    │
         ▼                    ▼
┌──────────────────┐  ┌──────────────────┐
│  Unit Tests      │  │  Integration     │
│  (Fast)          │  │  Tests (Slow)    │
│                  │  │                  │
│  • LocalGameChain│  │  • SolanaGameChain│
│  • Error codes   │  │  • Real devnet   │
│  • Lamports util │  │  • Phantom wallet│
│  • RandomSource  │  │  • TX confirmations│
└──────────────────┘  └──────────────────┘
```

**Why this works:** Contract tests validate behavior, not implementation. Both backends must pass the same tests.

---

## KEY FILES SUMMARY

| File | Purpose | Lines | Status |
|------|---------|-------|--------|
| `lib/ports/GameChainPort.ts` | Interface definition | ~150 | NEW |
| `lib/ports/GameErrors.ts` | Error codes + factory | ~80 | NEW |
| `lib/utils/lamports.ts` | SOL conversion | ~40 | NEW |
| `lib/ports/LocalGameChain.ts` | Wrap walletStore | ~400 | NEW |
| `lib/ports/index.ts` | Factory + env switch | ~30 | NEW |
| `app/actions/gameEngine.ts` | Use getGameChain() | ~430 | REFACTOR |
| `app/page.tsx` | Use error codes | ~800 | REFACTOR |
| `tests/unit/ports/*.test.ts` | Contract tests | ~500 | NEW |
| **TOTAL** | | **~2430** | **8 new, 2 modified** |

---

## NEXT STEPS

Ready to start? Run:

```bash
# 1. Read the plan
cat SOLANA_REFACTOR_PLAN.md

# 2. Check todo list
# (see todos in your editor)

# 3. Start with high-priority tasks
# Task 1: Create GameChainPort interface
# Task 2: Create GameErrors
# Task 3: Create lamports utils
# ... (see todo list)

# 4. Run tests after each step
npm run test:unit

# 5. Verify game still works
npm run dev
```

Questions? Check `REFACTOR_SUMMARY.md` for quick reference.
