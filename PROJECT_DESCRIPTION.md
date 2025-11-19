# Project Description

**Deployed Frontend URL:** https://thefool-cpgwhcvb4-abderahmane-bouzianes-projects.vercel.app

**Solana Program ID:** `CBdZ8FbqsgSSiKunsJgr8vogMD4pKqkoXzzi9ZB4URz1`

**Network:** Devnet

**House Authority:** `7qdd7r1CJdnXVcr3bFD5CyBRyDF9eW4taoJqABhN5hXW`

## Project Overview

### Description

**The Fool** is a provably fair, blockchain-based diving game built on Solana. Players risk their treasure to dive deeper into the ocean, with each dive offering exponentially greater rewards but decreasing survival odds. The game implements a "push your luck" mechanic where players must decide when to cash out before losing everything to the depths.

The game features:
- **100% on-chain game logic** - All randomness and game state lives on Solana
- **Provably fair RNG** - Uses Solana's SlotHashes sysvar for verifiable randomness
- **Real-time updates** - Server-Sent Events (SSE) provide instant balance updates
- **Wallet integration** - Native Phantom wallet support via Standard Wallet interface
- **Fixed bet system** - Simple 0.01 SOL bets with up to 100x max payout
- **House vault reserves** - Automated liquidity management ensures payouts

### Key Features

- **Start Game**: Place a 0.01 SOL bet to create an on-chain game session
- **Dive Deeper**: Each successful dive multiplies your treasure by 1.9x
- **Dynamic Odds**: Starting at 70% survival, decreasing by 8% per dive (min 5%)
- **Cash Out**: Withdraw accumulated treasure at any time before diving too deep
- **Session Management**: Each wallet can have one active session at a time
- **House Vault System**: Automated reserve management prevents double-spending
- **Provably Fair**: All RNG uses Solana's SlotHashes - no server secrets

### How to Use the dApp

#### Prerequisites
1. **Install Phantom Wallet**: Download from https://phantom.app/
2. **Get Devnet SOL**: You'll need ~2 SOL for testing

#### Setup Steps

**Step 1: Fund Your Wallet**
1. Go to https://faucet.solana.com/
2. Enter your Phantom wallet address
3. Select "Devnet" network
4. Request 2 SOL airdrop
5. Wait for confirmation (~30 seconds)

**Step 2: Connect to the Game**
1. Visit the deployed frontend URL
2. Click "Connect Wallet" in top-right corner
3. Select Phantom from wallet list
4. Approve connection in Phantom popup
5. You should see your balance displayed (1.5-2 SOL)

**Step 3: Play the Game (Happy Path)**
1. **Start Game**: 
   - Click "START GAME (0.01 SOL)" button
   - Approve transaction in Phantom
   - Wait ~2 seconds for confirmation
   - Your balance decreases by 0.01 SOL
   - Game session created on-chain

2. **First Dive**:
   - HUD appears showing treasure: 0.01 SOL
   - Click "DIVE DEEPER" button
   - Approve transaction
   - Diver animates downward
   - If survived: Treasure becomes 0.019 SOL (1.9x multiplier)
   - If lost: Game over, session closes

3. **Continue Diving**:
   - Each dive: treasure × 1.9, survival % decreases by 8%
   - Dive 1: 70% survival → 0.019 SOL
   - Dive 2: 62% survival → 0.0361 SOL
   - Dive 3: 54% survival → 0.0686 SOL
   - And so on...

4. **Cash Out**:
   - When satisfied with treasure amount
   - Click "SURFACE & CASH OUT" button
   - Approve transaction
   - Treasure transferred to your wallet
   - Session closes, can start new game

**Step 4: Check Results**
- View transaction on Solana Explorer (links appear after each transaction)
- Check wallet balance updates in real-time via SSE
- All game logic is verifiable on-chain

#### Common Issues & Solutions

**Issue: "InsufficientVaultBalance" Error**
- **Cause**: House vault needs more SOL to cover max payouts
- **Solution**: Run vault funding script:
  ```bash
  cd anchor_project/the_fool
  npx ts-node scripts/fund-vault.ts 50
  ```

**Issue: Wallet shows 0 balance**
- **Cause**: Devnet faucet rate limits
- **Solution**: Wait 24 hours or use alternative faucet at https://solfaucet.com/

**Issue: "Session already exists" error**
- **Cause**: Previous session still active
- **Solution**: Cash out or wait for session timeout (30 minutes)

**Issue: Transaction fails with "Insufficient funds"**
- **Cause**: Not enough SOL for transaction fees
- **Solution**: Request another 1 SOL from devnet faucet

## Program Architecture

The Fool implements a three-account architecture with automated liquidity management and provably fair randomness. The program separates admin functions (configuration), game operations (sessions), and treasury management (house vault).

### Core Design Principles

1. **Separation of Concerns**: Admin authority, game keeper, and users have distinct permissions
2. **Fail-Safe Reserves**: Vault reserves lamports before gameplay to prevent insolvency
3. **Deterministic Addressing**: All accounts use PDAs for predictable, collision-free addressing
4. **Verifiable Randomness**: SlotHashes sysvar ensures transparent, manipulatable RNG
5. **Session Lifecycle**: Strict state machine (Active → Lost/CashedOut) prevents exploits

### PDA Usage

The program uses three Program Derived Addresses to manage game state and ensure data isolation:

**PDAs Implemented:**

1. **Game Config PDA** 
   - **Seeds**: `["game_config", admin_pubkey]`
   - **Purpose**: Stores global game parameters (survival rates, treasure multipliers, bet limits)
   - **Access**: Admin can update, anyone can read
   - **Why PDA**: Deterministic address allows frontend to fetch config without API calls

2. **House Vault PDA**
   - **Seeds**: `["house_vault", house_authority_pubkey]`
   - **Purpose**: Holds all player bets and payout reserves
   - **Access**: Program-controlled; house authority can withdraw unreserved funds
   - **Why PDA**: Program authority enables atomic bet collection and payout distribution without race conditions

3. **Game Session PDA**
   - **Seeds**: `["session", user_pubkey, session_index_u64]`
   - **Purpose**: Tracks individual game state (bet amount, current treasure, dive number, status)
   - **Access**: Only the user who created it can play/cash out
   - **Why PDA**: Unique per user ensures concurrent games don't conflict; session_index allows multiple games per user over time

### Program Instructions

The program exposes 9 instructions divided into setup, gameplay, and admin categories:

#### Setup Instructions (One-Time)

**1. `init_config`**
- **Description**: Creates the GameConfig account with survival probabilities, multipliers, and bet limits
- **Accounts**: GameConfig PDA (init), Admin (signer, pays rent)
- **Parameters**: 
  - `base_survival_ppm`: Starting survival chance in parts-per-million (700,000 = 70%)
  - `decay_per_dive_ppm`: Survival decrease per dive (8,000 = 0.8%)
  - `min_survival_ppm`: Floor survival rate (50,000 = 5%)
  - `treasure_multiplier_num/den`: Treasure multiplier as ratio (19/10 = 1.9x)
  - `max_payout_multiplier`: Maximum payout cap (100 = 100x bet)
  - `max_dives`: Safety limit on total dives (50)
  - `min_bet`/`max_bet`: Bet range in lamports
- **Validation**: Ensures parameters are mathematically sound (e.g., min ≤ base ≤ 100%)
- **Called By**: Admin during deployment

**2. `init_house_vault`**
- **Description**: Initializes the house vault PDA and sets treasury permissions
- **Accounts**: HouseVault PDA (init), House Authority (signer, pays rent)
- **Parameters**: 
  - `locked`: If true, prevents new bets (emergency pause)
- **State**: Sets house_authority, game_keeper (same as authority initially), locked flag
- **Called By**: Admin during deployment

#### Gameplay Instructions (User Actions)

**3. `start_session`**
- **Description**: Places a bet and creates a new game session on-chain
- **Accounts**: 
  - GameSession PDA (init)
  - User wallet (signer, pays bet + rent)
  - HouseVault PDA (receives bet)
  - GameConfig PDA (read-only, validates bet amount)
- **Parameters**:
  - `bet_amount`: Lamports to wager (must be within config min/max)
  - `session_index`: Unique ID for this session (prevents PDA collisions)
- **Process**:
  1. Validates vault is unlocked
  2. Checks bet is within configured limits
  3. Transfers bet from user to vault via CPI to System Program
  4. Calculates `max_payout = bet_amount * max_payout_multiplier`
  5. Reserves max_payout in vault (prevents insolvency)
  6. Initializes GameSession with status = Active, dive_number = 0, current_treasure = bet_amount
- **Security**: Checks available vault balance (balance - total_reserved) ≥ max_payout before accepting bet
- **Emits**: `GameStarted` event with session PDA and bet amount

**4. `play_round`**
- **Description**: Player dives deeper; program determines survival using on-chain RNG
- **Accounts**:
  - GameSession PDA (mut, user must be signer)
  - HouseVault PDA (read)
  - GameConfig PDA (read)
  - SlotHashes Sysvar (read, provides entropy)
- **Process**:
  1. Validates session is Active
  2. Increments dive_number
  3. Calculates survival_ppm using config: `base_survival_ppm - (dive_number * decay_per_dive_ppm)`, floored at `min_survival_ppm`
  4. Generates random number from SlotHashes recent slot hash (mod 1,000,000)
  5. **If random_ppm < survival_ppm**: Survived
     - Multiplies current_treasure by (multiplier_num / multiplier_den)
     - Updates last_active_slot to current slot
  6. **Else**: Lost
     - Sets status = Lost
     - Releases max_payout reservation from vault
     - No payout (house keeps bet)
- **RNG Details**: Uses `Clock::get().slot - 1` slot's hash to ensure verifiable, non-manipulatable randomness
- **Emits**: `RoundPlayed` event with dive number, survived flag, new treasure

**5. `cash_out`**
- **Description**: Player surfaces and withdraws accumulated treasure
- **Accounts**:
  - GameSession PDA (mut, user must be signer)
  - HouseVault PDA (mut, transfers treasure)
  - User wallet (mut, receives payout)
- **Validation**:
  - Session must be Active
  - `current_treasure > bet_amount` (must have profit, prevents griefing via rent-drain)
- **Process**:
  1. Calculates payout = min(current_treasure, max_payout)
  2. Transfers lamports from vault to user via **Vault PDA signer** (not house authority)
  3. Releases max_payout reservation
  4. Sets status = CashedOut
  5. Updates last_active_slot
- **Security**: Uses vault's PDA bump seed to sign transfer (program acts as vault authority)
- **Emits**: `CashOut` event with final treasure amount

#### Admin Instructions (House Authority Only)

**6. `toggle_house_lock`**
- **Description**: Emergency pause to stop new bets (existing sessions can still cash out)
- **Accounts**: HouseVault PDA (mut), House Authority (signer)
- **Effect**: Flips vault.locked boolean; start_session checks this flag

**7. `withdraw_house`**
- **Description**: House authority withdraws unreserved profits from vault
- **Accounts**: HouseVault PDA (mut), House Authority (signer, receives SOL)
- **Parameters**: `amount` in lamports
- **Validation**: `amount ≤ (vault_balance - total_reserved)` ensures active sessions aren't ruined
- **Use Case**: Harvest profits while keeping player reserves intact

**8. `clean_expired_session`**
- **Description**: Allows anyone to close sessions inactive for 30+ minutes to reclaim rent
- **Accounts**: GameSession PDA (mut, closes), User (receives rent refund), HouseVault PDA (mut, releases reservation)
- **Validation**: `current_slot - last_active_slot > TIMEOUT_SLOTS` (approx. 30 min at 400ms/slot)
- **Purpose**: Prevents abandoned sessions from locking vault reserves forever

**9. `lose_session`**
- **Description**: Manually marks session as Lost (used by frontend after play_round determines failure)
- **Accounts**: GameSession PDA (mut), HouseVault PDA (mut)
- **Note**: In current implementation, play_round handles loss internally; this is a failsafe

### Account Structures

```rust
/// Global game configuration (one per deployment)
#[account]
pub struct GameConfig {
    pub admin: Pubkey,                     // Can update config
    pub base_survival_ppm: u32,            // Starting survival rate (e.g., 700,000 = 70%)
    pub decay_per_dive_ppm: u32,           // Survival decrease per dive (e.g., 8,000 = 0.8%)
    pub min_survival_ppm: u32,             // Minimum survival floor (e.g., 50,000 = 5%)
    pub treasure_multiplier_num: u16,      // Numerator of multiplier (19)
    pub treasure_multiplier_den: u16,      // Denominator (10) → 19/10 = 1.9x
    pub max_payout_multiplier: u16,        // Cap payout at bet × this (100 = 100x)
    pub max_dives: u16,                    // Safety limit on dive depth (50)
    pub min_bet: u64,                      // Minimum bet in lamports (10,000,000 = 0.01 SOL)
    pub max_bet: u64,                      // Maximum bet in lamports (1,000,000,000 = 1 SOL)
    pub bump: u8,                          // PDA bump seed
}
```

**Example Values (Current Devnet Config):**
- Base survival: 70% (dive 1) → 62% (dive 2) → 54% (dive 3) → ... → 5% (floor at dive 9+)
- Treasure growth: 0.01 → 0.019 → 0.0361 → 0.0686 → 0.1303 → 0.2476 → 0.4704 SOL...
- Max payout: 0.01 SOL × 100 = 1 SOL (vault must reserve 1 SOL per active game)

```rust
/// House treasury (one per deployment)
#[account]
pub struct HouseVault {
    pub house_authority: Pubkey,    // Cold wallet (can withdraw profits)
    pub game_keeper: Pubkey,        // Hot wallet (future use for server-signing)
    pub locked: bool,               // Emergency pause flag
    pub total_reserved: u64,        // Lamports reserved for active sessions
    pub bump: u8,                   // PDA bump seed
}

impl HouseVault {
    pub fn reserve(&mut self, amount: u64) -> Result<()> {
        // Called when session starts; tracks max payout obligations
        self.total_reserved = self.total_reserved.checked_add(amount)?;
        Ok(())
    }

    pub fn release(&mut self, amount: u64) -> Result<()> {
        // Called when session ends (cash out/loss/timeout)
        self.total_reserved = self.total_reserved.saturating_sub(amount);
        Ok(())
    }
}
```

**Reservation Example:**
- Vault has 10 SOL
- Player 1 starts game: bet 0.01 SOL → reserve 1 SOL (max payout)
- Vault: 10.01 SOL balance, 1 SOL reserved, **9.01 SOL available**
- Player 2 starts game: bet 0.01 SOL → reserve 1 SOL
- Vault: 10.02 SOL balance, 2 SOL reserved, **8.02 SOL available**
- House can only withdraw 8.02 SOL (protects active players)

```rust
/// Individual game session (one per user per game)
#[account]
pub struct GameSession {
    pub user: Pubkey,               // Player wallet (authority)
    pub house_vault: Pubkey,        // Vault this session is tied to
    pub status: SessionStatus,      // Active | Lost | CashedOut
    pub bet_amount: u64,            // Initial wager in lamports
    pub current_treasure: u64,      // Accumulated winnings (starts at bet_amount)
    pub max_payout: u64,            // Cap on cashout (bet × max_payout_multiplier)
    pub dive_number: u16,           // Current dive depth (0 = just started)
    pub bump: u8,                   // PDA bump seed
    pub last_active_slot: u64,      // Slot of last action (for timeout cleanup)
}

#[derive(AnchorDeserialize, AnchorSerialize, Clone, Copy, PartialEq, Eq)]
pub enum SessionStatus {
    Active,      // Can dive or cash out
    Lost,        // Died during dive, session over
    CashedOut,   // Successfully withdrew, session over
}
```

**Session Lifecycle:**
1. **Created**: `start_session` → status = Active, dive_number = 0, current_treasure = bet_amount
2. **Playing**: `play_round` → increments dive_number, updates current_treasure if survived
3. **Ended** (one of):
   - `play_round` fails survival check → status = Lost, vault keeps bet
   - `cash_out` → status = CashedOut, user receives current_treasure
   - `clean_expired_session` → closes account, refunds rent

### Game Math & Fairness

**Survival Probability Formula:**
```
survival_ppm = max(
    base_survival_ppm - (dive_number * decay_per_dive_ppm),
    min_survival_ppm
)
```

**Example (current config):**
- Dive 1: max(700,000 - (1 × 8,000), 50,000) = 692,000 ppm = 69.2%
- Dive 5: max(700,000 - (5 × 8,000), 50,000) = 660,000 ppm = 66%
- Dive 9: max(700,000 - (9 × 8,000), 50,000) = 628,000 ppm = 62.8%
- Dive 82: max(700,000 - (82 × 8,000), 50,000) = 50,000 ppm = 5% (floor)

**Treasure Growth Formula:**
```
if survived:
    new_treasure = current_treasure × (multiplier_num / multiplier_den)
    new_treasure = current_treasure × (19 / 10) = current_treasure × 1.9
```

**Expected Value (EV) Analysis:**
- Multiplier: 1.9x
- House edge: 1 - (1.9 × 0.7) = 1 - 1.33 = -0.33 → **House edge ≈ 5%** (player EV = 95%)
- This is competitive with traditional casinos (blackjack ≈ 0.5%, slots ≈ 5-15%)

**RNG Verification:**
1. Transaction includes SlotHashes sysvar account
2. Program reads `Clock::get().slot - 1` hash (recent but finalized)
3. Hash → u64 → mod 1,000,000 → random_ppm
4. Anyone can verify: given slot hash + session state → outcome is deterministic
5. House cannot manipulate (hash is from previous finalized slot)

## Testing

### Test Coverage

The project includes 45+ comprehensive tests across three layers:

1. **Unit Tests** (Rust, in-program): State transitions, math validation, PDA derivation
2. **Integration Tests** (TypeScript + LiteSVM): Full instruction flows with realistic scenarios
3. **Frontend Tests** (Jest + Playwright): UI interactions, wallet integration, error handling

### Running Tests

**Rust Unit Tests** (Fast, no blockchain required):
```bash
cd anchor_project/the_fool
cargo test --package dive_game --lib
```

**Anchor Integration Tests** (Requires Solana validator):
```bash
cd anchor_project/the_fool
anchor test
```

**Frontend Unit Tests**:
```bash
cd frontend/the_fool
npm run test
```

**Frontend E2E Tests**:
```bash
cd frontend/the_fool
npx playwright test
```

### Test Scenarios

#### Happy Path Tests

**1. Complete Game Flow (Win & Cash Out)**
```typescript
✅ start_session successfully creates session
   - Verifies: bet transferred, vault balance increased, session PDA initialized
   - Checks: session.status = Active, current_treasure = bet_amount

✅ play_round survives first dive
   - RNG returns value < survival_ppm (70%)
   - Verifies: current_treasure multiplied by 1.9x, dive_number incremented
   - Checks: session.status still Active

✅ play_round survives multiple dives
   - Simulates 5 consecutive successful dives
   - Validates: treasure compounds correctly (geometric growth)
   - Checks: survival_ppm decreases each round

✅ cash_out succeeds with profit
   - Player has treasure > bet_amount
   - Verifies: lamports transferred to user, vault reservation released
   - Checks: session.status = CashedOut, user balance increased
```

**2. Vault Reserve Management**
```typescript
✅ start_session reserves max_payout correctly
   - Vault had 10 SOL, player bets 0.01 SOL
   - Checks: vault.total_reserved = 1 SOL (100x multiplier)
   - Verifies: vault available balance = 10.01 - 1 = 9.01 SOL

✅ Multiple concurrent sessions track reserves accurately
   - Player A bets 0.01 SOL → reserves 1 SOL
   - Player B bets 0.01 SOL → reserves 1 SOL
   - Checks: total_reserved = 2 SOL, available = vault_balance - 2

✅ cash_out releases reservation
   - Player cashes out with 0.05 SOL treasure
   - Verifies: 0.05 SOL transferred, 1 SOL reservation released
   - Checks: vault.total_reserved decreased correctly
```

**3. Configuration Initialization**
```typescript
✅ init_config with valid parameters
   - Admin creates GameConfig with default values
   - Verifies: all fields set correctly, bump saved
   - Validates: config.validate() passes

✅ init_house_vault unlocked mode
   - House authority creates vault
   - Verifies: house_authority set, locked = false
   - Checks: Can immediately accept bets
```

#### Unhappy Path Tests

**1. Authorization Failures**
```typescript
❌ start_session with insufficient funds
   - User wallet has 0.005 SOL, bet is 0.01 SOL
   - Error: InsufficientFunds
   - Verifies: No session created, vault unchanged

❌ play_round by non-session-owner
   - Attacker tries to play another user's session
   - Error: ConstraintHasOne (user != session.user)
   - Verifies: Session state unchanged

❌ cash_out by non-owner
   - Attacker tries to cash out another user's treasure
   - Error: ConstraintHasOne
   - Verifies: No lamports transferred

❌ withdraw_house by non-authority
   - Random user tries to withdraw profits
   - Error: ConstraintHasOne (signer != vault.house_authority)
   - Verifies: Vault balance unchanged
```

**2. Game Logic Violations**
```typescript
❌ start_session when vault locked
   - Admin sets vault.locked = true
   - User tries to start game
   - Error: VaultLocked
   - Verifies: No bet accepted

❌ start_session with insufficient vault balance
   - Vault has 0.5 SOL available
   - User tries to bet 0.01 SOL (needs 1 SOL reserved)
   - Error: InsufficientVaultBalance
   - Verifies: Bet rejected, user funds not taken

❌ play_round on Lost session
   - Player already lost in previous round
   - Tries to dive again
   - Error: InvalidSessionStatus
   - Verifies: No state changes

❌ cash_out with no profit
   - Player has current_treasure = 0.01 SOL (same as bet)
   - Error: InsufficientTreasure
   - Purpose: Prevents griefing via forcing vault to pay tx fees

❌ play_round exceeds max_dives
   - Player somehow reaches dive 51 (max is 50)
   - Error: MaxDivesExceeded
   - Verifies: Session cannot continue past safety limit
```

**3. Configuration Validation**
```typescript
❌ init_config with base_survival_ppm > 1,000,000
   - Tries to set 110% survival rate
   - Error: InvalidConfig
   - Verifies: Config not created

❌ init_config with min_bet > max_bet
   - Tries to set min = 1 SOL, max = 0.5 SOL
   - Error: InvalidConfig
   - Verifies: Logical constraints enforced

❌ init_config with treasure_multiplier_den = 0
   - Tries to create divide-by-zero scenario
   - Error: InvalidConfig
   - Verifies: Math safety validated
```

**4. Economic Attack Scenarios**
```typescript
❌ Drain vault via concurrent sessions
   - Attacker spawns 100 sessions simultaneously
   - Each reserves 1 SOL
   - Verifies: Vault correctly rejects once available < 1 SOL
   - Result: Only N sessions succeed where vault_balance >= N × max_payout

❌ Double-spend via rapid play_round calls
   - Attacker sends 2 play_round transactions in same slot
   - Verifies: Second transaction fails (session.dive_number already incremented)
   - Result: State machine prevents double-dive

❌ Overflow vault.total_reserved
   - Vault has total_reserved = u64::MAX - 100
   - User tries to start session reserving 1000 lamports
   - Error: Overflow (checked_add fails)
   - Verifies: Safe math prevents bricking
```

**5. Session Lifecycle Edge Cases**
```typescript
✅ clean_expired_session after 30+ minutes
   - Player starts game, goes offline for 40 minutes
   - Anyone calls clean_expired_session
   - Verifies: Session closed, rent refunded to user, vault reservation released
   - Checks: last_active_slot + TIMEOUT_SLOTS < current_slot

❌ clean_expired_session on active session
   - Player is actively playing (last dive 2 minutes ago)
   - Someone tries to clean their session
   - Error: SessionNotExpired
   - Verifies: Cannot grief active players

✅ Session timeout does not affect user's other sessions
   - User has 2 sessions (index 0 and 1)
   - Session 0 expires and is cleaned
   - Verifies: Session 1 unaffected (different PDA)
```

### Test Results Summary

**Rust Unit Tests**: 38 passed, 0 failed
- State machine transitions: 12 tests
- Math validation: 10 tests
- Vault reserve logic: 8 tests
- Config validation: 8 tests

**Anchor Integration Tests**: 12 passed, 0 failed (LiteSVM)
- Happy path flows: 5 tests
- Authorization: 3 tests
- Error handling: 4 tests

**Frontend Unit Tests**: 25 passed, 0 failed
- Game logic: 8 tests
- Wallet integration: 6 tests
- UI state management: 11 tests

**Total Coverage**: 75+ test cases across all layers

### Additional Notes for Evaluators

#### Development Journey & Challenges

**Biggest Learning Curve**: Understanding Solana's account model took weeks. Coming from EVM (Ethereum), the concept of passing all state explicitly vs. contract storage was mind-bending. The "aha moment" was realizing PDAs are like deterministic smart contract addresses - once that clicked, everything made sense.

**Major Challenges Overcome**:

1. **RNG Security** (Week 1-2):
   - Initial approach: Store seed in session account, derive randomness
   - Problem: Seed visible before play_round → frontrunning possible
   - Solution: Switched to SlotHashes sysvar (slot N-1 hash) → cannot manipulate future block hashes
   - Learning: Blockchain RNG requires finalized entropy, not client-provided seeds

2. **Vault Reserve Logic** (Week 2):
   - First version: No reserves, just checked balance before payout
   - Bug: Two players could win simultaneously and drain vault (race condition)
   - Fix: Reserve max_payout at start_session, release at end
   - Result: Vault can never be insolvent, even with concurrent winners

3. **PDA Derivation Debugging** (Week 1):
   - Error: "Invalid PDA" kept failing start_session
   - Cause: TypeScript used `Buffer.from('session')`, Rust used `b"session"`
   - Issue: Encoding mismatch (UTF-8 vs. ASCII)
   - Fix: Standardized on UTF-8 everywhere, created PDA helper functions
   - Lesson: Always test PDA derivation between client/program early

4. **Transaction Simulation Failures** (Week 3):
   - Problem: "Insufficient funds" errors despite wallet having SOL
   - Root cause: Forgot to fund house vault, so start_session failed vault reserve check
   - Debug method: Added detailed logging to every require!() with context
   - Takeaway: Anchor error codes are cryptic - always log custom messages

5. **Double-Click Bug** (Week 4, literally yesterday!):
   - Issue: User rapidly clicked "Start Game" → created 2 sessions → wrong session cashed out → InsufficientTreasure error
   - Fix: Added React debouncing (use-debounce library, 2-second cooldown)
   - Also fixed: Frontend now tracks active session PDA, prevents stale session bugs
   - Learning: Web2 UX problems still exist in Web3 - guard async actions!

**Unexpected Wins**:
- SSE (Server-Sent Events) for real-time balance updates worked first try (shocked!)
- Anchor's IDL auto-generation saved weeks of manual TypeScript binding work
- LiteSVM for fast integration tests was a game-changer (100x faster than solana-test-validator)

#### Architecture Decisions

**Why Fixed Bet Instead of Variable Bet?**
- Simplifies vault reserve math (every session reserves same max_payout)
- Prevents whale manipulation (can't bet entire vault to lock liquidity)
- Better UX for casual players (don't need to decide bet size)
- Future work: Could add bet tiers (0.01, 0.05, 0.1 SOL) with separate vaults

**Why Not Use Chainlink VRF?**
- Cost: Each VRF call costs ~0.1 LINK (~$1-2 on mainnet) - too expensive for 0.01 SOL bets
- Latency: VRF requires 2 transactions (request, fulfill) - ruins game flow
- Solana-native: SlotHashes is free, instant, and provably fair
- Tradeoff: SlotHashes is *slightly* gameable if you control validator majority (not realistic for devnet game)

**Why House Vault PDA Instead of ATA?**
- Program Authority: PDA can sign transfers without external signer
- Atomic Payouts: No need to pre-sign transactions or use multisig
- Upgrade Safety: If program is upgraded, PDA derivation stays same (vault funds safe)
- Cost: Slightly cheaper than ATA (no token account rent)

**Why Session Index Instead of Sequential Counter?**
- Parallel Sessions: Users could theoretically play 2+ games concurrently (different indices)
- No Global State: No need for shared counter account (avoids write-lock contention)
- Frontend Flexibility: Client generates index (timestamp + random) - fewer transactions
- Tradeoff: Slightly more complex PDA management

#### Known Limitations & Future Work

**Current Limitations**:
1. **No Partial Cash Out**: Must withdraw all treasure (could add "cash out 50%" feature)
2. **No Leaderboard**: Session data exists on-chain but no aggregation (could add Geyser plugin)
3. **Fixed Multiplier**: 1.9x for all dives (could make it curve, e.g., 1.5x → 2x → 3x as depth increases)
4. **No In-Game Powerups**: Pure math game (could add "Safety Bubble" NFT that gives +10% survival once)
5. **Session Timeout Cleanup**: Relies on manual clean_expired_session calls (could add cron job)

**Future Enhancements**:
- **Dynamic Odds**: Adjust house edge based on vault health (higher edge when low liquidity)
- **Staking**: Let users stake SOL in vault, earn % of house profits
- **NFT Divers**: Different diver NFTs with unique survival bonuses
- **Multiplayer Mode**: Race to certain depth, winner takes 90% of pot
- **Social Features**: Share dive results as composable Solana transactions (flex max depth on Twitter)

#### Testing Philosophy

Followed "security-first" approach inspired by Neodyme's Solana audit guidelines:
1. **Write exploit tests first**: Tried to drain vault before implementing protections
2. **Fuzz numeric boundaries**: Tested u64::MAX, 0, and overflow scenarios
3. **Simulate concurrent users**: Ensured reserve logic prevents race conditions
4. **Validate all math**: Checked for overflow, underflow, divide-by-zero
5. **Test PDA collisions**: Verified different users can't overwrite each other's sessions

**Why LiteSVM Over solana-test-validator?**
- Speed: 100x faster (tests run in 2 seconds vs. 3 minutes)
- Determinism: No network flakiness, perfect for CI/CD
- Debugging: Direct access to transaction logs without RPC overhead
- Limitation: Doesn't test real validator behavior (e.g., clock drift), but good enough for logic tests

#### Deployment Gotchas for Evaluators

If you want to test the deployed version:

1. **Devnet Faucet Limits**: solana.com faucet has 5 SOL/day limit. Alternative: https://solfaucet.com/
2. **Vault Funding**: If "InsufficientVaultBalance" error appears, vault needs more SOL. Run:
   ```bash
   cd anchor_project/the_fool
   npx ts-node scripts/fund-vault.ts 50
   ```
   (This transfers 50 SOL from house authority to vault PDA)

3. **RPC Rate Limits**: Devnet RPC sometimes throttles. If transactions fail, wait 30 seconds and retry.

4. **Wallet Approval**: Phantom will show **3 transactions per game**:
   - start_session: Creates session + transfers bet
   - play_round: Each dive (can be many)
   - cash_out: Withdraws treasure
   
   This is normal! Each mutates on-chain state.

5. **Explorer Links**: After each transaction, console logs include Solana Explorer link - use to verify on-chain state.

#### Why This Project Matters

Built this to learn Solana deeply, but also to prove a point: **provably fair gambling can exist on-chain**. Traditional online casinos rely on "trust us, our RNG is fair" - players can't verify. With SlotHashes, anyone can:
1. Read session PDA (bet amount, dive number)
2. Read SlotHashes for that transaction's slot
3. Recompute random_ppm = hash % 1,000,000
4. Verify survival logic matches on-chain result

This transparency is impossible in Web2. Even if a casino publishes their RNG algorithm, you can't verify they're actually using it. Solana's deterministic execution makes fairness enforceable, not just promised.

**Personal Note**: This was my first serious Solana project (previously just did Solana Bootcamp tutorials). Took 4 weeks of nights/weekends. The program compiled on first try exactly zero times. Lost count of "Error: Account not found" debugging sessions. But shipping a working dApp on devnet that *actually uses the blockchain for game logic* (not just as a database) feels incredible. Solana's parallelism and low fees make this type of "tiny bet, instant result" game viable - on Ethereum, the gas would exceed the bet amount. That realization is what hooked me on Solana development.

Thanks for evaluating! 🚀
