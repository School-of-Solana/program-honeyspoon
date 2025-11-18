# Deep Sea Diver Game - Comprehensive Refactoring & Security Enhancement Plan

## Overview

This document outlines a phased approach to refactor and enhance the Deep Sea Diver game smart contract. The plan prioritizes safety, maintainability, and security while minimizing breaking changes. We'll implement changes incrementally, testing thoroughly at each phase.

---

## Phase 0: Low-Risk Refactors (No Behavior Changes)

**Objective:** Improve code maintainability and reduce duplication before adding new features. These changes make the codebase easier to reason about without altering game behavior.

### 0.1 Centralize Configuration Validation

**Problem:** Config validation logic is duplicated across multiple locations (instruction handlers, tests). This makes it hard to maintain consistency and evolve validation rules.

**Solution:** Create a single source of truth for all config validation rules.

**Implementation Steps:**

1. **Add validation method to `GameConfig` in `states.rs`:**
   ```rust
   impl GameConfig {
       /// Validates all configuration parameters
       /// This is the single source of truth for config validation
       pub fn validate(&self) -> Result<()> {
           // Treasury multiplier validation
           require!(
               self.treasure_multiplier_den > 0,
               GameError::InvalidConfig,
               "Treasure multiplier denominator must be > 0"
           );
           require!(
               self.treasure_multiplier_num > 0,
               GameError::InvalidConfig,
               "Treasure multiplier numerator must be > 0"
           );
           
           // Payout multiplier validation
           require!(
               self.max_payout_multiplier > 0,
               GameError::InvalidConfig,
               "Max payout multiplier must be > 0"
           );
           
           // Survival probability validation (must be <= 100%)
           require!(
               self.base_survival_ppm <= 1_000_000,
               GameError::InvalidConfig,
               "Base survival PPM cannot exceed 1,000,000 (100%)"
           );
           require!(
               self.min_survival_ppm <= self.base_survival_ppm,
               GameError::InvalidConfig,
               "Min survival PPM cannot exceed base survival PPM"
           );
           
           // Dive limit validation
           require!(
               self.max_dives > 0,
               GameError::InvalidConfig,
               "Max dives must be > 0"
           );
           
           // Bet range validation (only if max_bet is set)
           if self.max_bet > 0 {
               require!(
                   self.min_bet <= self.max_bet,
                   GameError::InvalidConfig,
                   "Min bet cannot exceed max bet"
               );
           }
           
           Ok(())
       }
   }
   ```

2. **Replace inline validation in `init_config.rs`:**
   - Remove all individual `require!` statements for config validation
   - Replace with single call: `config.validate()?;`
   - This happens after all config fields are set but before emitting events

3. **Update Rust unit tests:**
   - Remove test helper functions that duplicate validation logic
   - Create tests that directly mutate `GameConfig` instances and call `.validate()`
   - Test each validation rule independently
   - Test combinations of invalid parameters

**Benefits:**
- Single source of truth for validation
- Easier to add new validation rules
- Tests become simpler and more maintainable
- Clear error messages for each validation failure

---

### 0.2 Enforce Invariants via Helper Methods

**Problem:** Critical invariants (balance tracking, status checks) are enforced inconsistently across instructions. Manual arithmetic operations risk bugs and make the code harder to audit.

**Solution:** Encapsulate all state mutations behind helper methods that enforce invariants automatically.

**Implementation Steps:**

1. **Add balance management helpers to `HouseVault` in `states.rs`:**
   ```rust
   impl HouseVault {
       /// Reserves funds for a new game session
       /// Ensures total_reserved never overflows and stays valid
       pub fn reserve(&mut self, amount: u64) -> Result<()> {
           self.total_reserved = self.total_reserved
               .checked_add(amount)
               .ok_or(GameError::Overflow)?;
           
           // Future enhancement: Could add check that total_reserved <= vault_balance
           // but that requires passing in the account's lamports
           
           Ok(())
       }
       
       /// Releases reserved funds when a session ends
       /// Ensures we never release more than we have reserved
       pub fn release(&mut self, amount: u64) -> Result<()> {
           require!(
               self.total_reserved >= amount,
               GameError::Overflow,
               "Cannot release more funds than are reserved"
           );
           
           self.total_reserved = self.total_reserved
               .checked_sub(amount)
               .ok_or(GameError::Overflow)?;
           
           Ok(())
       }
   }
   ```

2. **Add status check helper to `GameSession` in `states.rs`:**
   ```rust
   impl GameSession {
       /// Ensures the session is in Active status
       /// Should be called at the start of any instruction that requires active gameplay
       pub fn ensure_active(&self) -> Result<()> {
           require!(
               self.status == SessionStatus::Active,
               GameError::InvalidSessionStatus,
               "Session must be Active for this operation"
           );
           Ok(())
       }
       
       /// Marks the session as Lost and validates the state transition
       pub fn mark_lost(&mut self) -> Result<()> {
           self.ensure_active()?;
           self.status = SessionStatus::Lost;
           Ok(())
       }
       
       /// Marks the session as CashedOut and validates the state transition
       pub fn mark_cashed_out(&mut self) -> Result<()> {
           self.ensure_active()?;
           self.status = SessionStatus::CashedOut;
           Ok(())
       }
   }
   ```

3. **Update all instructions to use helpers:**
   - **`play_round.rs`:** Replace manual `total_reserved +=` with `house_vault.reserve()`
   - **`lose_session.rs`:** Replace manual `total_reserved -=` with `house_vault.release()`
   - **`cash_out.rs`:** Use `house_vault.release()` and `session.mark_cashed_out()`
   - **All gameplay instructions:** Add `session.ensure_active()?` at the start

4. **Add Rust unit tests for helpers:**
   ```rust
   #[cfg(test)]
   mod tests {
       use super::*;
       
       #[test]
       fn test_house_vault_reserve_prevents_overflow() {
           let mut vault = HouseVault {
               total_reserved: u64::MAX - 100,
               // ... other fields
           };
           
           // Should succeed
           assert!(vault.reserve(50).is_ok());
           assert_eq!(vault.total_reserved, u64::MAX - 50);
           
           // Should fail with overflow
           assert!(vault.reserve(100).is_err());
           // Verify no state change on failure
           assert_eq!(vault.total_reserved, u64::MAX - 50);
       }
       
       #[test]
       fn test_house_vault_release_requires_sufficient_funds() {
           let mut vault = HouseVault {
               total_reserved: 1000,
               // ... other fields
           };
           
           // Should succeed
           assert!(vault.release(500).is_ok());
           assert_eq!(vault.total_reserved, 500);
           
           // Should fail - trying to release more than reserved
           assert!(vault.release(600).is_err());
           // Verify no state change on failure
           assert_eq!(vault.total_reserved, 500);
       }
       
       #[test]
       fn test_session_ensure_active_rejects_non_active() {
           let session = GameSession {
               status: SessionStatus::Lost,
               // ... other fields
           };
           
           assert!(session.ensure_active().is_err());
       }
   }
   ```

**Benefits:**
- Impossible to forget to update `total_reserved` correctly
- Clear invariant enforcement in one place
- Easier to audit for correctness
- Self-documenting code (method names explain intent)
- Atomic failure (state doesn't change if operation fails)

---

### 0.3 Clarify House Lock Semantics

**Problem:** The current implementation is ambiguous about what "locked" means. Can players continue existing sessions when the house is locked? This creates uncertainty for both developers and users.

**Current Behavior:**
- `start_session` checks `!house_vault.locked`
- Other instructions don't check the lock
- This means: lock prevents NEW sessions but allows existing sessions to continue

**Decision Required:** Choose one of these options:

#### Option A: Strict Lock (Recommended)
**Semantics:** When house is locked, ALL gameplay stops.
- ✅ Clearest semantics for emergency situations
- ✅ Matches user expectations ("closed for business")
- ✅ Allows house to pause completely for maintenance
- ❌ More disruptive to active players

**Implementation:**
```rust
// In play_round.rs
pub fn play_round(ctx: Context<PlayRound>) -> Result<()> {
    let house_vault = &ctx.accounts.house_vault;
    require!(!house_vault.locked, GameError::HouseLocked);
    // ... rest of logic
}

// In cash_out.rs
pub fn cash_out(ctx: Context<CashOut>) -> Result<()> {
    let house_vault = &ctx.accounts.house_vault;
    require!(!house_vault.locked, GameError::HouseLocked);
    // ... rest of logic
}

// lose_session might or might not check - decision: allow cleanup even when locked
```

#### Option B: Permissive Lock (Current)
**Semantics:** Lock only prevents new sessions; existing sessions can complete.
- ✅ Less disruptive to active players
- ✅ Allows "soft close" (no new games, finish existing ones)
- ❌ More complex semantics
- ❌ Can't fully stop gameplay for emergencies

**Implementation:** Keep current behavior, but add explicit tests.

**My Recommendation:** **Option A (Strict Lock)**
- Simpler to explain and understand
- Better for emergency situations
- House can always unlock quickly if needed
- Most real-world "maintenance mode" systems work this way

**Implementation Steps (Option A):**

1. **Add lock check to `play_round.rs`:**
   ```rust
   pub fn play_round(ctx: Context<PlayRound>) -> Result<()> {
       let config = &ctx.accounts.config;
       let session = &mut ctx.accounts.session;
       let house_vault = &mut ctx.accounts.house_vault;
       
       // Check house lock status first
       require!(!house_vault.locked, GameError::HouseLocked);
       
       // Then check session is active
       session.ensure_active()?;
       
       // ... rest of logic
   }
   ```

2. **Add lock check to `cash_out.rs`:**
   ```rust
   pub fn cash_out(ctx: Context<CashOut>) -> Result<()> {
       let session = &mut ctx.accounts.session;
       let house_vault = &mut ctx.accounts.house_vault;
       
       require!(!house_vault.locked, GameError::HouseLocked);
       session.ensure_active()?;
       
       // ... rest of logic
   }
   ```

3. **Decision on `lose_session`:**
   - **Allow cleanup even when locked** - this makes sense because:
     - Player is voluntarily ending their session
     - No payout happens (house takes the bet)
     - Cleanup should always be possible
   - Don't add lock check to `lose_session`

4. **Add comprehensive tests in LiteSVM:**
   ```typescript
   describe("House Lock Enforcement", () => {
     it("should reject start_session when locked", async () => {
       await toggleHouseLock(true);
       const result = await startSession(player, betAmount);
       expectTxFailedWith(result, "HouseLocked");
     });
     
     it("should reject play_round when locked", async () => {
       const session = await startSession(player, betAmount);
       await toggleHouseLock(true);
       const result = await playRound(player, session);
       expectTxFailedWith(result, "HouseLocked");
     });
     
     it("should reject cash_out when locked", async () => {
       const session = await startSession(player, betAmount);
       await playRound(player, session); // win a round
       await toggleHouseLock(true);
       const result = await cashOut(player, session);
       expectTxFailedWith(result, "HouseLocked");
     });
     
     it("should allow lose_session even when locked (cleanup)", async () => {
       const session = await startSession(player, betAmount);
       await toggleHouseLock(true);
       const result = await loseSession(player, session);
       expect(result).to.be.successful();
       // Verify funds were released correctly
     });
     
     it("should allow play after unlocking", async () => {
       const session = await startSession(player, betAmount);
       await toggleHouseLock(true);
       await playRound(player, session); // fails
       await toggleHouseLock(false);
       const result = await playRound(player, session);
       expect(result).to.be.successful(); // now works
     });
   });
   ```

**Benefits:**
- Clear, unambiguous semantics
- Better emergency response capability
- Easier to explain to users
- Comprehensive test coverage

---

## Phase 1: RNG Security Enhancement (CRITICAL)

**Objective:** Make game outcomes unpredictable per-round to prevent "simulation attacks" where attackers pre-compute all possible outcomes before committing to play.

### Current Vulnerability

**Problem:** The current RNG seed is generated once at session start using:
- Slot number at session creation
- Unix timestamp
- Session PDA address

This means an attacker can:
1. Simulate all possible outcomes for the entire game at session creation
2. Only start sessions where they win
3. Abandon sessions where they would lose
4. Essentially "see the future" of their game

**Example Attack:**
```typescript
// Attacker's code
function simulateEntireGame(sessionPDA, initialSlot, timestamp) {
  const seed = generateSeed(sessionPDA, initialSlot, timestamp);
  const outcomes = [];
  
  for (let dive = 1; dive <= maxDives; dive++) {
    const survived = simulateRound(seed, dive);
    outcomes.push(survived);
    if (!survived) break;
  }
  
  return outcomes;
}

// Try many session indices until finding a winning one
for (let i = 0; i < 1000; i++) {
  const sessionPDA = deriveSessionPDA(player, i);
  const outcomes = simulateEntireGame(sessionPDA, currentSlot, currentTime);
  
  if (isWinning(outcomes)) {
    // Start this session!
    await startSession(betAmount, i);
    break;
  }
}
```

### Solution: Mix Per-Round Entropy

**Approach:** Keep the base session seed, but mix it with fresh chain entropy for each round using the SlotHashes sysvar.

**Key Insight:** The SlotHashes sysvar contains recent block hashes that:
- Change every slot (~400ms)
- Are unpredictable at the time of session creation
- Are globally consistent (can't be manipulated by individual users)
- Are accessible without additional accounts or fees

**Implementation Steps:**

1. **Update `PlayRound` account structure in `play_round.rs`:**
   ```rust
   use anchor_lang::prelude::*;
   use anchor_lang::solana_program::sysvar;
   
   #[derive(Accounts)]
   pub struct PlayRound<'info> {
       #[account(mut)]
       pub user: Signer<'info>,
       
       #[account(
           seeds = [GAME_CONFIG_SEED.as_bytes()],
           bump = config.bump,
       )]
       pub config: Account<'info, GameConfig>,
       
       #[account(
           mut,
           has_one = user,
           has_one = house_vault,
       )]
       pub session: Account<'info, GameSession>,
       
       #[account(mut)]
       pub house_vault: Account<'info, HouseVault>,
       
       /// CHECK: SlotHashes sysvar at canonical address
       /// Contains recent block hashes for unpredictable entropy
       #[account(address = sysvar::slot_hashes::id())]
       pub slot_hashes: UncheckedAccount<'info>,
   }
   ```

2. **Modify `play_round` function to use mixed entropy:**
   ```rust
   use anchor_lang::solana_program::{hash::hashv, sysvar::slot_hashes::SlotHashes};
   
   pub fn play_round(ctx: Context<PlayRound>) -> Result<()> {
       let config = &ctx.accounts.config;
       let session = &mut ctx.accounts.session;
       let house_vault = &mut ctx.accounts.house_vault;
       let clock = Clock::get()?;
       
       // Security: Check house isn't locked
       require!(!house_vault.locked, GameError::HouseLocked);
       
       // Ensure session is active
       session.ensure_active()?;
       
       // Check dive limit
       require!(
           session.dive_number < config.max_dives,
           GameError::MaxDivesReached
       );
       
       // ==========================================
       // CRITICAL SECURITY: Generate per-round seed
       // ==========================================
       
       // Parse SlotHashes sysvar for fresh entropy
       let slot_hashes_account = &ctx.accounts.slot_hashes;
       let data = slot_hashes_account.try_borrow_data()?;
       
       // SlotHashes structure:
       // - 8 bytes: number of entries
       // - 16 bytes: padding/header
       // - Entries: each is 8 bytes slot + 32 bytes hash
       // We extract 32 bytes of entropy from the recent data
       require!(data.len() >= 48, GameError::InvalidConfig); // Safety check
       let dynamic_entropy = &data[16..48]; // Extract 32 bytes of fresh entropy
       
       // Mix three sources of entropy:
       // 1. Session seed (set at session start, prevents front-running)
       // 2. Recent block hashes (unpredictable at session creation)
       // 3. Current dive number (ensures each round is unique)
       let per_round_seed = hashv(&[
           &session.rng_seed,              // Base session randomness
           dynamic_entropy,                 // Fresh chain entropy
           &session.dive_number.to_le_bytes(), // Round number
       ]).to_bytes();
       
       // Generate random roll using mixed seed
       let roll = crate::rng::random_roll_bps(&per_round_seed, 0);
       
       // Calculate survival probability for this dive
       let survival_prob = game_math::survival_probability_bps(
           config,
           session.dive_number
       );
       
       // Determine outcome
       let survived = roll < survival_prob;
       
       if survived {
           // Player survives - calculate new treasure
           let new_treasure = game_math::calculate_treasure(
               config,
               session.bet_amount,
               session.dive_number + 1,
           );
           
           // Ensure we don't exceed max payout
           session.current_treasure = std::cmp::min(new_treasure, session.max_payout);
           session.dive_number += 1;
           session.last_active_slot = clock.slot; // Update activity timestamp
           
           // Emit survival event
           emit!(RoundSurvivedEvent {
               session: session.key(),
               dive_number: session.dive_number,
               treasure: session.current_treasure,
               roll,
               survival_prob,
           });
       } else {
           // Player loses - transition to Lost status
           session.mark_lost()?;
           house_vault.release(session.max_payout)?;
           
           // Emit loss event
           emit!(SessionLostEvent {
               session: session.key(),
               final_dive: session.dive_number,
               roll,
               survival_prob,
           });
       }
       
       Ok(())
   }
   ```

3. **Keep session seed generation simple in `start_session.rs`:**
   ```rust
   // In start_session - this stays mostly the same
   // The base seed prevents front-running at session creation
   let mut seed_material = [0u8; 32];
   seed_material[0..8].copy_from_slice(&clock.slot.to_le_bytes());
   seed_material[8..16].copy_from_slice(&clock.unix_timestamp.to_le_bytes());
   seed_material[16..32].copy_from_slice(&session.key().to_bytes()[0..16]);
   
   let rng_seed = rng::generate_seed(&seed_material, &session.key());
   session.rng_seed = rng_seed;
   session.last_active_slot = clock.slot; // Initialize activity tracking
   ```

4. **Update TypeScript test helpers:**
   ```typescript
   import { SYSVAR_SLOT_HASHES_PUBKEY } from "@solana/web3.js";
   
   export function buildPlayRoundInstruction(
     player: PublicKey,
     sessionPDA: PublicKey,
     configPDA: PublicKey,
     houseVaultPDA: PublicKey
   ): TransactionInstruction {
     const data = buildPlayRoundData();
     
     return new TransactionInstruction({
       keys: [
         { pubkey: player, isSigner: true, isWritable: true },
         { pubkey: configPDA, isSigner: false, isWritable: false },
         { pubkey: sessionPDA, isSigner: false, isWritable: true },
         { pubkey: houseVaultPDA, isSigner: false, isWritable: true },
         // NEW: Include SlotHashes sysvar
         { pubkey: SYSVAR_SLOT_HASHES_PUBKEY, isSigner: false, isWritable: false },
       ],
       programId: PROGRAM_ID,
       data,
     });
   }
   ```

5. **Add security tests in LiteSVM:**
   ```typescript
   describe("RNG Security", () => {
     it("should require slot_hashes account in play_round", async () => {
       const session = await startSession(player, betAmount);
       
       // Try to call without slot_hashes account
       const data = buildPlayRoundData();
       const ix = new TransactionInstruction({
         keys: [
           { pubkey: player.publicKey, isSigner: true, isWritable: true },
           { pubkey: configPDA, isSigner: false, isWritable: false },
           { pubkey: sessionPDA, isSigner: false, isWritable: true },
           { pubkey: houseVaultPDA, isSigner: false, isWritable: true },
           // Missing slot_hashes!
         ],
         programId: PROGRAM_ID,
         data,
       });
       
       const tx = new Transaction().add(ix);
       tx.recentBlockhash = svm.latestBlockhash();
       tx.sign(player);
       
       const result = svm.sendTransaction(tx);
       expect(result.constructor.name).to.equal("FailedTransactionMetadata");
     });
     
     it("should use fresh entropy per round", async () => {
       // This test verifies that outcomes can differ based on slot
       // Note: This is probabilistic, not deterministic
       
       const player1 = new Keypair();
       const player2 = new Keypair();
       svm.airdrop(player1.publicKey, 10 * LAMPORTS_PER_SOL);
       svm.airdrop(player2.publicKey, 10 * LAMPORTS_PER_SOL);
       
       // Start two sessions at same slot with same session index
       // They'll have different base seeds due to different player pubkeys
       const [session1] = getSessionPDA(player1.publicKey, new BN(0));
       const [session2] = getSessionPDA(player2.publicKey, new BN(0));
       
       await startSession(player1, betAmount, 0);
       await startSession(player2, betAmount, 0);
       
       // Play one round on session1
       const clock1 = svm.getClock();
       await playRound(player1, session1);
       const data1 = getSessionData(svm, session1);
       const outcome1 = data1.status;
       
       // Warp to different slot
       svm.warpToSlot(clock1.slot + 100n);
       
       // Play one round on session2 (different slot = different entropy)
       await playRound(player2, session2);
       const data2 = getSessionData(svm, session2);
       const outcome2 = data2.status;
       
       // Can't assert outcomes differ (probabilistic)
       // But we can assert both succeeded without panicking
       expect(data1).to.not.be.null;
       expect(data2).to.not.be.null;
     });
     
     it("should produce consistent outcomes for same inputs", async () => {
       // This verifies determinism given same entropy sources
       // (Important for replay/verification)
       
       // Start session
       const session = await startSession(player, betAmount);
       const initialData = getSessionData(svm, session);
       
       // Don't warp clock - use same slot
       // With same slot, SlotHashes entropy is the same
       // But we can't test this directly in LiteSVM as we can't replay
       // This test mainly documents expected behavior
     });
   });
   ```

**Security Analysis:**

**Before:**
- ❌ Attacker can simulate entire game at session start
- ❌ Vulnerable to "cherry picking" sessions
- ❌ Expected value exploitation possible

**After:**
- ✅ Each round uses unpredictable entropy
- ✅ Can't simulate future rounds at session start
- ✅ Must commit to each round before knowing outcome
- ✅ Maintains fairness for all participants

**Trade-offs:**
- Outcomes are less deterministic (can't replay from just session seed)
- Slightly more complex RNG logic
- Requires additional account in instruction

**Benefits far outweigh costs** - this is a critical security improvement.

---

## Phase 2: Session Lifecycle & Solvency Features

**Objective:** Improve session lifecycle management to prevent dead capital lock and enable better system health.

### Problem: Abandoned Sessions Lock Capital

**Current Issue:**
- Player starts session → `max_payout` reserved in `house_vault.total_reserved`
- Player never finishes (network issues, loses interest, etc.)
- Funds stay reserved FOREVER
- No mechanism to clean up abandoned sessions
- House vault slowly becomes unusable

**Example Scenario:**
1. 100 players start sessions with 1 SOL bets each
2. Max payout per session: 100 SOL
3. Total reserved: 10,000 SOL
4. 50 players abandon their sessions
5. 5,000 SOL locked forever
6. House can't accept new sessions due to lack of available capital

### Solution: Timeout-Based Cleanup

**Approach:**
1. Track when each session was last active
2. Allow permissionless cleanup of expired sessions
3. Incentivize cleanup by giving rent to the caller (crank)

---

### 2.1 Add Activity Tracking

**Implementation Steps:**

1. **Extend `GameSession` struct in `states.rs`:**
   ```rust
   #[account]
   #[derive(InitSpace)]
   pub struct GameSession {
       pub user: Pubkey,           // 32 bytes
       pub house_vault: Pubkey,    // 32 bytes
       pub status: SessionStatus,   // 1 byte + 1 byte enum
       pub bet_amount: u64,         // 8 bytes
       pub current_treasure: u64,   // 8 bytes
       pub max_payout: u64,         // 8 bytes
       pub dive_number: u16,        // 2 bytes
       pub bump: u8,                // 1 byte
       pub rng_seed: [u8; 32],     // 32 bytes
       
       /// NEW: Slot number when session was last active
       /// Used for timeout-based cleanup of abandoned sessions
       /// Updated on: start_session, play_round (if survived), cash_out
       pub last_active_slot: u64,   // 8 bytes
   }
   // Total: 133 bytes + 8 bytes discriminator = 141 bytes
   ```

2. **Update `start_session.rs` to initialize tracking:**
   ```rust
   pub fn start_session(
       ctx: Context<StartSession>,
       bet_amount: u64,
       _session_index: u64,
   ) -> Result<()> {
       let config = &ctx.accounts.config;
       let house_vault = &mut ctx.accounts.house_vault;
       let session = &mut ctx.accounts.session;
       let clock = Clock::get()?;
       
       // ... existing validation and setup ...
       
       // Initialize session fields
       session.user = ctx.accounts.user.key();
       session.house_vault = house_vault.key();
       session.status = SessionStatus::Active;
       session.bet_amount = bet_amount;
       session.current_treasure = bet_amount;
       session.max_payout = max_payout;
       session.dive_number = 1;
       session.bump = ctx.bumps.session;
       session.rng_seed = rng_seed;
       
       // NEW: Initialize activity tracking
       session.last_active_slot = clock.slot;
       
       // ... emit event ...
       
       Ok(())
   }
   ```

3. **Update `play_round.rs` to track activity:**
   ```rust
   pub fn play_round(ctx: Context<PlayRound>) -> Result<()> {
       let config = &ctx.accounts.config;
       let session = &mut ctx.accounts.session;
       let house_vault = &mut ctx.accounts.house_vault;
       let clock = Clock::get()?;
       
       // ... validation and RNG logic ...
       
       if survived {
           // Player survives
           session.current_treasure = new_treasure;
           session.dive_number += 1;
           
           // NEW: Update activity tracking on survival
           session.last_active_slot = clock.slot;
           
           // ... emit event ...
       } else {
           // Player loses
           session.mark_lost()?;
           house_vault.release(session.max_payout)?;
           
           // Note: Don't update last_active_slot on loss
           // Session is about to be closed anyway
           
           // ... emit event ...
       }
       
       Ok(())
   }
   ```

4. **Update `cash_out.rs` to track activity:**
   ```rust
   pub fn cash_out(ctx: Context<CashOut>) -> Result<()> {
       let session = &mut ctx.accounts.session;
       let house_vault = &mut ctx.accounts.house_vault;
       let clock = Clock::get()?;
       
       // ... validation and payout logic ...
       
       // NEW: Update activity before closing session
       session.last_active_slot = clock.slot;
       session.mark_cashed_out()?;
       
       // ... payout and cleanup ...
       
       Ok(())
   }
   ```

**Note on `lose_session`:**
- This instruction explicitly marks a session as lost
- It's called when player voluntarily ends their session
- We don't need to update `last_active_slot` since session is ending
- The timeout cleanup is for ABANDONED sessions, not voluntarily ended ones

---

### 2.2 Implement Timeout-Based Cleanup

**Design Decisions:**

1. **Timeout Duration:**
   - Solana slots: ~400ms each
   - 1 hour ≈ 9,000 slots
   - 24 hours ≈ 216,000 slots
   - **Recommended: 9,000 slots (1 hour)** - balances user convenience with capital efficiency

2. **Incentive Model:**
   - Give session account rent to the cleanup caller (crank)
   - Typical session account: ~0.001 SOL rent
   - Enough incentive for automated cranks
   - Prevents spam (must pay tx fees to crank)

3. **Who Can Clean:**
   - **Permissionless** - anyone can call
   - No special authority required
   - Encourages decentralized cleanup
   - Can be automated by bots/keepers

**Implementation Steps:**

1. **Add error code in `errors.rs`:**
   ```rust
   #[error_code]
   pub enum GameError {
       // ... existing errors ...
       
       #[msg("Session has not expired yet - cannot clean up")]
       SessionNotExpired,
   }
   ```

2. **Create new instruction `clean_expired_session.rs`:**
   ```rust
   use anchor_lang::prelude::*;
   use crate::states::*;
   use crate::errors::GameError;
   use crate::events::SessionCleanedEvent;
   
   /// Timeout duration in slots
   /// Approximately 1 hour at 400ms per slot
   /// Can be made configurable in future versions
   pub const TIMEOUT_SLOTS: u64 = 9_000;
   
   /// Cleans up an expired session that was abandoned by the player
   /// 
   /// This is a permissionless instruction that:
   /// 1. Checks if session has been inactive for TIMEOUT_SLOTS
   /// 2. Releases reserved funds back to house vault
   /// 3. Closes the session account
   /// 4. Sends rent to the caller as incentive
   /// 
   /// This prevents capital from being locked forever in abandoned sessions
   pub fn clean_expired_session(ctx: Context<CleanExpired>) -> Result<()> {
       let session = &ctx.accounts.session;
       let house_vault = &mut ctx.accounts.house_vault;
       let clock = Clock::get()?;
       
       // Verify session has expired
       let slots_inactive = clock.slot
           .checked_sub(session.last_active_slot)
           .ok_or(GameError::Overflow)?;
       
       require!(
           slots_inactive > TIMEOUT_SLOTS,
           GameError::SessionNotExpired
       );
       
       // Only clean Active sessions (Lost/CashedOut already closed)
       // This check prevents double-cleanup
       require!(
           session.status == SessionStatus::Active,
           GameError::InvalidSessionStatus
       );
       
       // Release reserved funds
       house_vault.release(session.max_payout)?;
       
       // Close account and send rent to crank as incentive
       let session_account = session.to_account_info();
       let crank_account = ctx.accounts.crank.to_account_info();
       
       let session_lamports = session_account.lamports();
       
       // Transfer all lamports from session to crank
       **crank_account.try_borrow_mut_lamports()? = crank_account
           .lamports()
           .checked_add(session_lamports)
           .ok_or(GameError::Overflow)?;
       
       **session_account.try_borrow_mut_lamports()? = 0;
       
       // Emit cleanup event for monitoring
       emit!(SessionCleanedEvent {
           session: session.key(),
           user: session.user,
           crank: ctx.accounts.crank.key(),
           released_amount: session.max_payout,
           slots_inactive,
       });
       
       Ok(())
   }
   
   #[derive(Accounts)]
   pub struct CleanExpired<'info> {
       /// The crank/keeper calling this instruction
       /// Receives the rent as incentive
       #[account(mut)]
       pub crank: Signer<'info>,
       
       /// The house vault to release funds to
       #[account(mut)]
       pub house_vault: Account<'info, HouseVault>,
       
       /// The expired session to clean up
       #[account(
           mut,
           has_one = house_vault,
       )]
       pub session: Account<'info, GameSession>,
   }
   ```

3. **Add event in `events.rs`:**
   ```rust
   #[event]
   pub struct SessionCleanedEvent {
       pub session: Pubkey,
       pub user: Pubkey,
       pub crank: Pubkey,
       pub released_amount: u64,
       pub slots_inactive: u64,
   }
   ```

4. **Export instruction in `lib.rs`:**
   ```rust
   pub mod instructions;
   pub use instructions::*;
   
   #[program]
   pub mod dive_game {
       use super::*;
       
       // ... existing instructions ...
       
       pub fn clean_expired_session(ctx: Context<CleanExpired>) -> Result<()> {
           instructions::clean_expired_session::clean_expired_session(ctx)
       }
   }
   ```

5. **Add comprehensive tests in LiteSVM:**
   ```typescript
   describe("Session Timeout & Cleanup", () => {
     const TIMEOUT_SLOTS = 9000;
     
     it("should reject cleanup before timeout expires", async () => {
       // Start session
       const session = await startSession(player, betAmount);
       
       // Try to clean immediately (should fail)
       const result = await cleanExpiredSession(crank, session);
       expectTxFailedWith(result, "SessionNotExpired");
       
       // Warp forward by less than timeout
       const clock = svm.getClock();
       svm.setClock({
         slot: clock.slot + BigInt(TIMEOUT_SLOTS - 100),
         unixTimestamp: clock.unixTimestamp,
       });
       
       // Still should fail
       const result2 = await cleanExpiredSession(crank, session);
       expectTxFailedWith(result2, "SessionNotExpired");
     });
     
     it("should allow cleanup after timeout expires", async () => {
       // Start session
       const betAmount = lamports(1.0);
       const maxPayout = betAmount.muln(100);
       const session = await startSession(player, betAmount);
       
       // Get initial balances
       const initialVaultData = getVaultData(svm, houseVaultPDA);
       const initialCrankBalance = svm.getBalance(crank.publicKey);
       const sessionAccount = svm.getAccount(sessionPDA);
       const sessionRent = sessionAccount.lamports;
       
       // Warp forward past timeout
       const clock = svm.getClock();
       svm.setClock({
         slot: clock.slot + BigInt(TIMEOUT_SLOTS + 1),
         unixTimestamp: clock.unixTimestamp + BigInt(TIMEOUT_SLOTS + 1) * 400n / 1000n,
       });
       
       // Clean up session
       const result = await cleanExpiredSession(crank, session);
       expect(result.constructor.name).to.equal("TransactionMetadata");
       
       // Verify session account is closed
       const closedSession = svm.getAccount(sessionPDA);
       expect(closedSession).to.be.null;
       
       // Verify reserved funds were released
       const finalVaultData = getVaultData(svm, houseVaultPDA);
       expect(
         initialVaultData.totalReserved.sub(finalVaultData.totalReserved).toString()
       ).to.equal(maxPayout.toString());
       
       // Verify crank received rent
       const finalCrankBalance = svm.getBalance(crank.publicKey);
       const crankGain = finalCrankBalance - initialCrankBalance;
       // Account for tx fees (very small)
       expect(Number(crankGain)).to.be.closeTo(Number(sessionRent), 10000);
     });
     
     it("should not clean already-closed sessions", async () => {
       // Start session and close it normally
       const session = await startSession(player, betAmount);
       await loseSession(player, session);
       
       // Verify session is closed
       expect(svm.getAccount(sessionPDA)).to.be.null;
       
       // Warp forward past timeout
       const clock = svm.getClock();
       svm.setClock({
         slot: clock.slot + BigInt(TIMEOUT_SLOTS + 1),
         unixTimestamp: clock.unixTimestamp,
       });
       
       // Try to clean (should fail - account doesn't exist)
       const result = await cleanExpiredSession(crank, session);
       expect(result.constructor.name).to.equal("FailedTransactionMetadata");
     });
     
     it("should handle multiple expired sessions", async () => {
       const players = [new Keypair(), new Keypair(), new Keypair()];
       const sessions = [];
       
       // Start multiple sessions
       for (const p of players) {
         svm.airdrop(p.publicKey, 10 * LAMPORTS_PER_SOL);
         const [sessionPDA] = getSessionPDA(p.publicKey, new BN(0));
         await startSession(p, betAmount, 0);
         sessions.push({ player: p, pda: sessionPDA });
       }
       
       // Warp forward
       const clock = svm.getClock();
       svm.setClock({
         slot: clock.slot + BigInt(TIMEOUT_SLOTS + 1),
         unixTimestamp: clock.unixTimestamp,
       });
       
       // Clean all sessions
       for (const { pda } of sessions) {
         const result = await cleanExpiredSession(crank, pda);
         expect(result.constructor.name).to.equal("TransactionMetadata");
         expect(svm.getAccount(pda)).to.be.null;
       }
       
       // Verify all funds released
       const vaultData = getVaultData(svm, houseVaultPDA);
       // All 3 sessions cleaned, so reserved should be reduced
     });
     
     it("should preserve session if player continues playing", async () => {
       // Start session
       const session = await startSession(player, betAmount);
       
       // Warp forward but not past timeout
       let clock = svm.getClock();
       svm.setClock({
         slot: clock.slot + BigInt(TIMEOUT_SLOTS - 100),
         unixTimestamp: clock.unixTimestamp,
       });
       
       // Play a round (updates last_active_slot)
       await playRound(player, session);
       
       // Warp forward again (total > TIMEOUT but time since last activity < TIMEOUT)
       clock = svm.getClock();
       svm.setClock({
         slot: clock.slot + BigInt(TIMEOUT_SLOTS - 100),
         unixTimestamp: clock.unixTimestamp,
       });
       
       // Should still not be cleanable
       const result = await cleanExpiredSession(crank, session);
       expectTxFailedWith(result, "SessionNotExpired");
     });
   });
   ```

**Monitoring & Operations:**

1. **Set up automated crank:**
   ```typescript
   // Example crank bot
   async function cleanupCrank() {
     const provider = anchor.AnchorProvider.env();
     const program = anchor.workspace.DiveGame;
     
     while (true) {
       // Query all active sessions (via getProgramAccounts)
       const sessions = await program.account.gameSession.all([
         {
           memcmp: {
             offset: 8 + 32 + 32, // After discriminator + user + vault
             bytes: bs58.encode([0]), // SessionStatus::Active
           }
         }
       ]);
       
       const clock = await provider.connection.getSlot();
       
       for (const session of sessions) {
         const slotsInactive = clock - session.account.lastActiveSlot;
         
         if (slotsInactive > TIMEOUT_SLOTS) {
           try {
             await program.methods
               .cleanExpiredSession()
               .accounts({
                 crank: crankKeypair.publicKey,
                 houseVault: session.account.houseVault,
                 session: session.publicKey,
               })
               .signers([crankKeypair])
               .rpc();
             
             console.log(`Cleaned session ${session.publicKey.toBase58()}`);
           } catch (err) {
             console.error(`Failed to clean ${session.publicKey.toBase58()}:`, err);
           }
         }
       }
       
       // Wait before next check
       await sleep(60000); // 1 minute
     }
   }
   ```

2. **Monitoring dashboard should show:**
   - Number of active sessions
   - Number of expired but uncleaned sessions
   - Total capital locked in expired sessions
   - Crank activity metrics

**Benefits:**
- Prevents permanent capital lock
- Improves house vault liquidity
- Permissionless (anyone can run crank)
- Incentivized cleanup (rent reward)
- Protects honest players (only affects abandoned sessions)

---

### 2.3 Decision: Atomic Loss vs Separate `lose_session`

**Current Design:**
- `play_round` can set status to `Lost`
- Separate `lose_session` instruction closes the account
- Two transactions required for full cleanup

**Alternative: Atomic Loss**
- `play_round` closes account immediately on loss
- One transaction, immediate cleanup
- Less on-chain state

**Comparison:**

| Aspect | Current (Separate) | Atomic Loss |
|--------|-------------------|-------------|
| Transactions | 2 (play_round + lose_session) | 1 (play_round) |
| History | Session account exists until closed | No on-chain record after loss |
| Complexity | Simpler per-instruction logic | More complex lamport handling |
| Analytics | Full on-chain history | Must rely on events/indexer |
| Gas cost | Higher (2 tx) | Lower (1 tx) |
| UX | Requires 2 clicks | Automatic cleanup |

**My Recommendation: Keep Separate `lose_session` for Now**

**Reasoning:**
1. **With timeout cleanup, abandoned sessions aren't a problem** - expired sessions get cleaned automatically
2. **Simpler code** - each instruction has clear responsibility
3. **Better analytics** - can query all Lost sessions on-chain
4. **Easier debugging** - can inspect Lost sessions
5. **Less risky** - atomic loss requires careful lamport handling

**However, if you want atomic loss later:**
- It's a good optimization once core mechanics are solid
- Can be added as Phase 4 enhancement
- Requires careful testing of lamport transfers
- Should emit comprehensive event before closing account

**Action for now:** Keep current design, document this decision, revisit after Phase 3 is complete.

---

## Phase 3: Test Infrastructure Upgrades

**Objective:** Make tests maintainable, resilient to changes, and comprehensive.

### Current Test Issues

1. **Manual encoding/decoding:**
   - Hand-coded discriminators (`Buffer.from([23, 235, ...])`)
   - Byte offset arithmetic for parsing accounts
   - Breaks when struct layouts change
   - Hard to maintain

2. **Incomplete coverage:**
   - Missing tests for error conditions
   - Insufficient event verification
   - Limited edge case testing

3. **Code duplication:**
   - Setup code repeated in every test
   - Common operations not abstracted
   - Hard to maintain consistency

---

### 3.1 Switch to Anchor BorshCoder

**Problem:** Manual encoding is brittle and error-prone.

**Solution:** Use Anchor's built-in encoder/decoder.

**Implementation Steps:**

1. **Ensure IDL is generated:**
   ```bash
   anchor build
   # Produces: target/idl/dive_game.json
   # Produces: target/types/dive_game.ts
   ```

2. **Create test helper utilities in `test-helpers.ts`:**
   ```typescript
   import * as anchor from "@coral-xyz/anchor";
   import { Program } from "@coral-xyz/anchor";
   import { DiveGame } from "../../target/types/dive_game";
   import IDL from "../../target/idl/dive_game.json";
   
   // Initialize coder
   const coder = new anchor.BorshCoder(IDL as anchor.Idl);
   
   // ==========================================
   // Instruction Builders
   // ==========================================
   
   export function encodeInitConfig(params: {
     baseSurvivalPpm?: number;
     decayPerDivePpm?: number;
     minSurvivalPpm?: number;
     treasureMultiplierNum?: number;
     treasureMultiplierDen?: number;
     maxPayoutMultiplier?: number;
     maxDives?: number;
     minBet?: BN;
     maxBet?: BN;
   }): Buffer {
     return coder.instruction.encode("initConfig", params);
   }
   
   export function encodeStartSession(
     betAmount: BN,
     sessionIndex: BN
   ): Buffer {
     return coder.instruction.encode("startSession", {
       betAmount: betAmount.toString(),
       sessionIndex: sessionIndex.toString(),
     });
   }
   
   export function encodePlayRound(): Buffer {
     return coder.instruction.encode("playRound", {});
   }
   
   export function encodeCashOut(): Buffer {
     return coder.instruction.encode("cashOut", {});
   }
   
   export function encodeLoseSession(): Buffer {
     return coder.instruction.encode("loseSession", {});
   }
   
   export function encodeToggleHouseLock(): Buffer {
     return coder.instruction.encode("toggleHouseLock", {});
   }
   
   export function encodeCleanExpiredSession(): Buffer {
     return coder.instruction.encode("cleanExpiredSession", {});
   }
   
   // ==========================================
   // Account Decoders
   // ==========================================
   
   export interface GameConfigData {
     admin: PublicKey;
     baseSurvivalPpm: number;
     decayPerDivePpm: number;
     minSurvivalPpm: number;
     treasureMultiplierNum: number;
     treasureMultiplierDen: number;
     maxPayoutMultiplier: number;
     maxDives: number;
     minBet: BN;
     maxBet: BN;
     bump: number;
   }
   
   export function decodeConfig(data: Buffer): GameConfigData {
     return coder.accounts.decode("gameConfig", data);
   }
   
   export interface HouseVaultData {
     houseAuthority: PublicKey;
     locked: boolean;
     totalReserved: BN;
     bump: number;
   }
   
   export function decodeVault(data: Buffer): HouseVaultData {
     return coder.accounts.decode("houseVault", data);
   }
   
   export interface GameSessionData {
     user: PublicKey;
     houseVault: PublicKey;
     status: { active?: {}; lost?: {}; cashedOut?: {} };
     betAmount: BN;
     currentTreasure: BN;
     maxPayout: BN;
     diveNumber: number;
     bump: number;
     rngSeed: Buffer;
     lastActiveSlot: BN;
   }
   
   export function decodeSession(data: Buffer): GameSessionData {
     return coder.accounts.decode("gameSession", data);
   }
   
   // ==========================================
   // SVM Account Getters
   // ==========================================
   
   export function getConfig(
     svm: LiteSVM,
     address: PublicKey
   ): GameConfigData | null {
     const account = svm.getAccount(address);
     if (!account) return null;
     return decodeConfig(account.data);
   }
   
   export function getVault(
     svm: LiteSVM,
     address: PublicKey
   ): HouseVaultData | null {
     const account = svm.getAccount(address);
     if (!account) return null;
     return decodeVault(account.data);
   }
   
   export function getSession(
     svm: LiteSVM,
     address: PublicKey
   ): GameSessionData | null {
     const account = svm.getAccount(address);
     if (!account) return null;
     return decodeSession(account.data);
   }
   
   // ==========================================
   // Status Helper
   // ==========================================
   
   export function getSessionStatus(
     session: GameSessionData
   ): "Active" | "Lost" | "CashedOut" {
     if (session.status.active !== undefined) return "Active";
     if (session.status.lost !== undefined) return "Lost";
     if (session.status.cashedOut !== undefined) return "CashedOut";
     throw new Error("Unknown session status");
   }
   ```

3. **Update all test files to use new helpers:**
   ```typescript
   import {
     encodeStartSession,
     encodePlayRound,
     encodeCashOut,
     getSession,
     getVault,
     getConfig,
     getSessionStatus,
   } from "./test-helpers";
   
   // Example: Replace manual parsing
   // OLD:
   const sessionData = parseSessionData(sessionAccount.data);
   expect(sessionData.betAmount.toString()).to.equal("100000000");
   
   // NEW:
   const sessionData = getSession(svm, sessionPDA);
   expect(sessionData.betAmount.toString()).to.equal("100000000");
   
   // OLD:
   const data = buildStartSessionData(betAmount, sessionIndex);
   
   // NEW:
   const data = encodeStartSession(betAmount, sessionIndex);
   ```

4. **Delete old parsing functions:**
   - Remove `parseSessionData`
   - Remove `parseHouseVaultData`
   - Remove `parseConfigData`
   - Remove `buildInitConfigData`
   - Remove `buildStartSessionData`
   - Remove `buildPlayRoundData`
   - Remove `buildCashOutData`
   - Remove `buildLoseSessionData`
   - Remove `buildToggleHouseLockData`

5. **Run full test suite and fix any issues:**
   ```bash
   npm run test:litesvm:only
   ```

**Benefits:**
- Tests automatically adapt to struct changes
- No more byte offset calculations
- Type-safe account data access
- Easier to understand and maintain
- Catches mismatches at compile time

---

### 3.2 Improve Test Coverage

**Add comprehensive tests for new functionality:**

1. **RNG security tests:**
   ```typescript
   describe("RNG Security", () => {
     it("requires slot_hashes account");
     it("uses fresh entropy per round");
     it("produces different outcomes in different slots");
     it("cannot be predicted at session start");
   });
   ```

2. **Timeout cleanup tests:**
   ```typescript
   describe("Session Timeout", () => {
     it("rejects cleanup before timeout");
     it("allows cleanup after timeout");
     it("releases reserved funds on cleanup");
     it("sends rent to crank");
     it("handles multiple expired sessions");
     it("preserves active sessions");
   });
   ```

3. **House lock tests:**
   ```typescript
   describe("House Lock", () => {
     it("prevents start_session when locked");
     it("prevents play_round when locked");
     it("prevents cash_out when locked");
     it("allows lose_session when locked");
     it("works after unlock");
   });
   ```

4. **Error condition tests:**
   ```typescript
   describe("Error Handling", () => {
     it("rejects invalid config");
     it("rejects play_round on lost session");
     it("rejects double cash_out");
     it("rejects cross-user manipulation");
     it("handles insufficient vault balance");
   });
   ```

5. **Event verification:**
   ```typescript
   describe("Events", () => {
     it("emits SessionStartedEvent on start");
     it("emits RoundSurvivedEvent on win");
     it("emits SessionLostEvent on loss");
     it("emits SessionCashedOutEvent on cash out");
     it("emits SessionCleanedEvent on cleanup");
   });
   ```

---

### 3.3 Test Helper Cleanup

**Create reusable setup helpers:**

```typescript
// In test-helpers.ts

export interface TestContext {
  svm: LiteSVM;
  authority: Keypair;
  configPDA: PublicKey;
  houseVaultPDA: PublicKey;
}

export function setupTestEnvironment(): TestContext {
  const svm = new LiteSVM();
  
  // Load program
  const programPath = path.join(__dirname, "../../target/deploy/dive_game.so");
  const programBytes = fs.readFileSync(programPath);
  svm.addProgram(PROGRAM_ID, programBytes);
  
  // Setup authority
  const authority = new Keypair();
  svm.airdrop(authority.publicKey, 100n * BigInt(LAMPORTS_PER_SOL));
  
  // Derive PDAs
  const [configPDA] = getConfigPDA();
  const [houseVaultPDA] = getHouseVaultPDA(authority.publicKey);
  
  return { svm, authority, configPDA, houseVaultPDA };
}

export async function initializeGame(
  ctx: TestContext,
  configParams?: Partial<GameConfig>
): Promise<void> {
  // Initialize config
  const configData = encodeInitConfig(configParams || {});
  const configIx = new TransactionInstruction({
    keys: [
      { pubkey: ctx.authority.publicKey, isSigner: true, isWritable: true },
      { pubkey: ctx.configPDA, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: configData,
  });
  
  const configTx = new Transaction();
  configTx.recentBlockhash = ctx.svm.latestBlockhash();
  configTx.add(configIx);
  configTx.sign(ctx.authority);
  ctx.svm.sendTransaction(configTx);
  
  // Initialize vault
  const vaultData = encodeInitHouseVault(false);
  const vaultIx = new TransactionInstruction({
    keys: [
      { pubkey: ctx.authority.publicKey, isSigner: true, isWritable: true },
      { pubkey: ctx.houseVaultPDA, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: vaultData,
  });
  
  const vaultTx = new Transaction();
  vaultTx.recentBlockhash = ctx.svm.latestBlockhash();
  vaultTx.add(vaultIx);
  vaultTx.sign(ctx.authority);
  ctx.svm.sendTransaction(vaultTx);
  
  // Fund vault
  ctx.svm.airdrop(ctx.houseVaultPDA, 10000n * BigInt(LAMPORTS_PER_SOL));
}

export function createFundedPlayer(svm: LiteSVM): Keypair {
  const player = new Keypair();
  svm.airdrop(player.publicKey, 10n * BigInt(LAMPORTS_PER_SOL));
  return player;
}

export async function startTestSession(
  ctx: TestContext,
  player: Keypair,
  betAmount: BN,
  sessionIndex: number = 0
): Promise<PublicKey> {
  const [sessionPDA] = getSessionPDA(player.publicKey, new BN(sessionIndex));
  const data = encodeStartSession(betAmount, new BN(sessionIndex));
  
  const ix = new TransactionInstruction({
    keys: [
      { pubkey: player.publicKey, isSigner: true, isWritable: true },
      { pubkey: ctx.configPDA, isSigner: false, isWritable: false },
      { pubkey: ctx.houseVaultPDA, isSigner: false, isWritable: true },
      { pubkey: ctx.authority.publicKey, isSigner: false, isWritable: false },
      { pubkey: sessionPDA, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });
  
  const tx = new Transaction();
  tx.recentBlockhash = ctx.svm.latestBlockhash();
  tx.add(ix);
  tx.sign(player);
  ctx.svm.sendTransaction(tx);
  
  return sessionPDA;
}

// Example usage in tests:
describe("Game Flow", () => {
  let ctx: TestContext;
  
  beforeEach(() => {
    ctx = setupTestEnvironment();
    initializeGame(ctx);
  });
  
  it("should play a complete game", () => {
    const player = createFundedPlayer(ctx.svm);
    const sessionPDA = startTestSession(ctx, player, lamports(0.1));
    
    // Continue with test...
  });
});
```

---

## Phase 4: Optional Nice-to-Have Features

These can be implemented after core refactoring is complete.

### 4.1 Minimum Dives Before Cashout

**Motivation:** Prevent "instant cashout" spam, encourage meaningful gameplay.

**Implementation:**
```rust
// In GameConfig
pub min_dives_before_cashout: u16, // Default: 2

// In cash_out.rs
require!(
    session.dive_number >= config.min_dives_before_cashout,
    GameError::TooEarlyCashOut
);
```

### 4.2 Configurable Timeout

**Motivation:** Different deployments may want different timeout durations.

**Implementation:**
```rust
// In GameConfig
pub session_timeout_slots: u64, // Default: 9000

// In clean_expired_session.rs
require!(
    slots_inactive > config.session_timeout_slots,
    GameError::SessionNotExpired
);
```

### 4.3 Debug Logging Feature Flag

**Motivation:** Reduce log spam in production while keeping debug ability.

**Implementation:**
```rust
// In Cargo.toml
[features]
debug-logs = []

// In code
#[cfg(feature = "debug-logs")]
msg!("Debug: player roll = {}", roll);
```

### 4.4 Advanced Analytics Events

**Motivation:** Better off-chain analytics and monitoring.

**Implementation:**
```rust
#[event]
pub struct DetailedRoundEvent {
    pub session: Pubkey,
    pub dive_number: u16,
    pub roll: u16,
    pub survival_prob: u16,
    pub treasure_before: u64,
    pub treasure_after: u64,
    pub slot: u64,
}
```

---

## Implementation Order Summary

### Week 1: Phase 0 (Foundation)
- Day 1-2: Config validation centralization
- Day 3-4: Helper methods for invariants
- Day 5: House lock semantics

### Week 2: Phase 1 (Security)
- Day 1-3: RNG security with SlotHashes
- Day 4-5: Testing and validation

### Week 3: Phase 2 (Lifecycle)
- Day 1-2: Activity tracking
- Day 3-4: Timeout cleanup
- Day 5: Testing and monitoring

### Week 4: Phase 3 (Testing)
- Day 1-2: BorshCoder migration
- Day 3-4: Comprehensive test coverage
- Day 5: Test cleanup and documentation

### Week 5: Phase 4 (Optional)
- Implement nice-to-have features as needed

---

## Testing Strategy

### After Each Phase:

1. **Run full test suite:**
   ```bash
   anchor test
   npm run test:litesvm:only
   ```

2. **Check test coverage:**
   ```bash
   cargo tarpaulin --workspace
   ```

3. **Run lints:**
   ```bash
   cargo clippy -- -D warnings
   cargo fmt --check
   ```

4. **Manual testing:**
   - Deploy to local net
   - Test with UI (if available)
   - Verify expected behavior

### Before Production:

1. **Security audit checklist**
2. **Performance testing**
3. **Stress testing (many concurrent sessions)**
4. **Economic simulation**

---

## Risk Management

### Migration Considerations:

If already deployed to mainnet:
- Cannot change struct layouts without migration
- New fields require account migration program
- Consider versioning strategy

### Backward Compatibility:

- Keep old instruction signatures working
- Add new instructions alongside old ones
- Deprecate gradually

### Rollback Plan:

- Keep previous program binary
- Document rollback procedure
- Test rollback in devnet

---

## Success Metrics

### Phase 0:
- ✅ All validation in one place
- ✅ Zero manual balance arithmetic
- ✅ Clear lock semantics with tests

### Phase 1:
- ✅ RNG uses per-round entropy
- ✅ Cannot simulate future rounds
- ✅ Security audit passes

### Phase 2:
- ✅ No sessions locked > timeout
- ✅ Automated cleanup working
- ✅ Capital efficiency improved

### Phase 3:
- ✅ No manual encoding/decoding
- ✅ >90% test coverage
- ✅ Tests pass on struct changes

### Phase 4:
- ✅ Additional features working
- ✅ User feedback positive
- ✅ Analytics comprehensive

---

## Next Steps

**Decision Points Needed:**

1. **House Lock Semantics:** Option A (strict) or Option B (permissive)?
   - My recommendation: Option A

2. **Atomic Loss:** Keep separate or combine?
   - My recommendation: Keep separate for now

Once you decide on these, I'll provide exact diffs for implementation.

**To Start Phase 0:**

1. Create feature branch: `git checkout -b refactor/phase-0`
2. Implement 0.1: Config validation
3. Test thoroughly
4. Implement 0.2: Helper methods
5. Test thoroughly
6. Implement 0.3: Lock semantics
7. Test thoroughly
8. Merge to main

Let me know when you're ready to start, and I'll provide step-by-step implementation guidance!
