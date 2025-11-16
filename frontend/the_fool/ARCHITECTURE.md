# Abyss Fortune - Architecture Documentation

**Last Updated:** 2025-11-16  
**Version:** 1.0.0

---

## Overview

Abyss Fortune is a provably fair multiplier-based gambling game with a deep-sea diving theme. Built on Next.js 16 with Kaplay game engine, it features server-side validation, cryptographic randomness, and a generic gambling engine that can be reskinned for other themes.

---

## Core Principles

1. **Security-First**: All game logic executes server-side with cryptographic randomness
2. **Generic Engine**: Theme-agnostic core can power other game types
3. **Risk Management**: House fund reservation prevents bankruptcy
4. **Provably Fair**: All outcomes are deterministic and auditable
5. **Clean Code**: Separation of concerns, single source of truth, TypeScript safety

---

## Architecture Layers

### Layer 1: Generic Game Engine (`lib/gameEngine.ts`)

**Purpose:** Theme-agnostic gambling mechanics

**Features:**

- Fixed house edge (15%)
- Exponential probability decay
- EV calculations
- Round simulation
- Configurable parameters

**Can be reskinned for:**

- Space exploration (fuel reserves)
- Mining operations (depth levels)
- Mountain climbing (altitude zones)
- Any risk/reward multiplier game

**Key Functions:**

```typescript
calculateRoundStats(round: number): { winProbability, multiplier, threshold }
simulateRound(round: number, currentValue: number): RoundResult
calculateMaxPotentialPayout(initialBet: number, maxRounds: number): number
```

---

### Layer 2: Theme Wrapper (`lib/gameLogic.ts`, `lib/constants.ts`)

**Purpose:** Diving-specific flavor and visuals

**Features:**

- Depth zones (Sunlight 0-200m → Hadal 6000m+)
- Procedural shipwrecks with lore
- Oxygen depletion (visual only, doesn't affect gameplay)
- Sea creature spawning by depth

**Depth Zones:**

```typescript
DEPTH_ZONES = [
  { name: "Sunlight Zone", depth: 0, color: "#4A90E2", light: 1.0 },
  { name: "Twilight Zone", depth: 200, color: "#2E5C8A", light: 0.7 },
  { name: "Midnight Zone", depth: 1000, color: "#1A2F4A", light: 0.4 },
  { name: "Abyssal Zone", depth: 4000, color: "#0D1B2A", light: 0.2 },
  { name: "Hadal Zone", depth: 6000, color: "#050A14", light: 0.1 },
];
```

---

### Layer 3: Wallet System (`lib/walletLogic.ts`, `lib/walletStore.ts`)

**Purpose:** Two-wallet architecture with risk management

**Components:**

#### User Wallets

```typescript
interface UserWallet {
  userId: string;
  balance: number;
  totalWagered: number;
  totalWon: number;
  totalLost: number;
  gamesPlayed: number;
  lastUpdated: number;
}
```

#### House Wallet

```typescript
interface HouseWallet {
  balance: number; // Total bankroll
  totalPaidOut: number; // Historical payouts
  totalReceived: number; // Historical bets received
  reservedFunds: number; // Currently reserved for active games
  lastUpdated: number;
}
```

**Critical Feature: Fund Reservation**

When a bet is placed, the house reserves the maximum potential payout:

```typescript
// Example: $50 bet with 50 max rounds
const maxPayout = calculateMaxPotentialPayout(50, 50); // = $100,000
reservedFunds += maxPayout;
```

This prevents the house from going bankrupt if multiple players win simultaneously.

---

### Layer 4: Server Actions (`app/actions/gameEngine.ts`, `gameActions.ts`)

**Purpose:** Next.js Server Actions for security

**Actions:**

1. **`startGameSession()`**
   - Validates bet amount
   - Checks user balance
   - Reserves house funds
   - Creates game session
   - Deducts bet from user

2. **`executeRound()`**
   - Validates session ownership
   - **Security: Validates round number** (prevents replay attacks)
   - **Security: Validates treasure value** (prevents inflation)
   - Generates crypto-random number (0-99)
   - Simulates round outcome
   - Updates session state

3. **`cashOut()`**
   - Validates treasure matches session
   - Transfers to user wallet
   - Deducts from house wallet
   - Releases reserved funds
   - Deletes session

**Security Features:**

```typescript
// Round validation - prevents replay attacks
if (roundNumber !== gameSession.diveNumber) {
  throw new Error(
    "Round mismatch: Expected round X, received Y. Please refresh."
  );
}

// Treasure validation - prevents tampering
if (currentValue !== expectedValue) {
  throw new Error(
    "Treasure mismatch: Expected $X, received $Y. Data corruption detected."
  );
}

// Cryptographic randomness
const randomBytes = crypto.randomBytes(4);
const randomRoll = randomBytes.readUInt32BE(0) % 100;
```

---

### Layer 5: Frontend (`app/page.tsx`, `components/`)

**Purpose:** React UI with Kaplay renderer

**State Management:**

- Game state: Local React state
- Canvas/Scene state: Zustand store (`lib/gameStore.ts`)
- Separation prevents UI rerenders from affecting game canvas

**Scene System:**

```
Beach Scene (Starting point)
    ↓ isDiving = true
Diving Scene (Main gameplay)
    ↓ shouldSurface = true OR survived = false
Surfacing Scene (Win) OR Beach Scene (Loss)
```

**Kaplay Integration:**

- Full-screen canvas
- Scene management via Zustand flags
- Entity system (bubbles, fish, jellyfish, predators)
- Parallax scrolling layers
- Particle effects

---

## File Structure

```
app/
├── actions/
│   ├── gameEngine.ts        # Generic server actions ⭐ SECURITY LAYER
│   └── gameActions.ts        # Theme wrapper for actions
├── page.tsx                  # Main UI (CANONICAL) ⭐ ENTRY POINT
└── layout.tsx

lib/
├── gameEngine.ts             # Generic gambling engine ⭐ CORE LOGIC
├── gameLogic.ts              # Theme layer (diving mechanics)
├── constants.ts              # Game config ⭐ SINGLE SOURCE OF TRUTH
├── walletLogic.ts            # Validation & risk management
├── walletStore.ts            # In-memory storage (⚠️ replace with DB for prod)
├── types.ts                  # TypeScript definitions
├── soundManager.ts           # Audio system
├── objectPool.ts             # Performance optimization (ready, not yet used)
├── gameStore.ts              # Zustand state (canvas/scene)
├── gameColors.ts             # UI color palette
└── spriteConfig.ts           # Sprite definitions

components/DeepSeaDiver/
├── OceanScene.tsx            # Kaplay initialization
├── scenes/
│   ├── BeachScene.ts         # Starting scene (boat, beach, decorations)
│   ├── DivingScene.ts        # Main gameplay scene (500+ lines)
│   └── SurfacingScene.ts     # Win animation scene
├── entities/
│   ├── bubble.ts             # Bubble spawning
│   ├── fish.ts               # Fish entities
│   ├── jellyfish.ts          # Jellyfish entities
│   ├── predator.ts           # Death predators (sharks, anglers)
│   ├── particles.ts          # Treasure particles
│   ├── treasure.ts           # Treasure chest
│   ├── death.ts              # Death animations
│   ├── boat.ts, palmtree.ts, crab.ts, etc.
│   └── parallax.ts           # Parallax layer builder
├── sceneConstants.ts         # Visual constants (spawn rates, colors, etc.)
└── GameErrorBoundary.tsx     # React error boundary

tests/
├── unit/                     # 16 unit test suites
│   ├── gameLogic.test.ts
│   ├── gameEngine.test.ts
│   ├── walletLogic.test.ts
│   ├── securityBlindspots.test.ts
│   ├── moneyConservation.test.ts
│   └── ... (11 more)
└── *.spec.ts                 # 7 Playwright E2E tests
```

---

## Game Flow

### Complete Game Cycle

```
1. BETTING PHASE (Beach Scene)
   User sees:
   - Balance: $1000 (starting balance)
   - Wager: $50 (fixed bet)
   - "START GAME" button

   ↓ User clicks "START GAME"

2. START GAME (Server)
   executeActions:
   - ✓ Validate balance >= $50
   - ✓ Deduct $50 from user wallet
   - ✓ Add $50 to house wallet
   - ✓ Reserve $100,000 (max potential payout)
   - ✓ Create session with ID

   clientSees:
   - Betting card fades out
   - HUD appears (Depth: 0m, Treasure: $0)
   - "DIVE DEEPER" button enabled

   ↓ User clicks "DIVE DEEPER"

3. DIVE ANIMATION (2.5 seconds)
   clientActions:
   - Set isDiving = true
   - Beach scene detects flag
   - Transition to diving scene
   - 2.5s animation plays

   visualEffects:
   - Diver descends
   - Parallax layers scroll
   - Bubbles rise
   - Speed lines appear

   ↓ After 2.5s animation

4. SERVER DIVE CALCULATION
   serverActions:
   - Generate crypto-random (0-99)
   - Calculate survival probability (95% → 70% → 50% → ...)
   - Compare random vs threshold
   - If survived: multiply treasure by 1.18x
   - If drowned: game over

   example:
   Round 1: 95% survival → random 42 < 95 → SURVIVED
           $50 × 1.18 = $59

   ↓ If SURVIVED

5. TREASURE ANIMATION (1.5 seconds)
   clientActions:
   - Show "TREASURE FOUND!" message
   - Spawn particle effects
   - Update HUD (Depth: 50m, Treasure: $59)

   ↓ User has choice

6. DECISION POINT
   Option A: Click "DIVE DEEPER" → Go to step 3 (repeat)
   Option B: Click "SURFACE" → Go to step 7

   ↓ User clicks "SURFACE"

7. SURFACING ANIMATION (3 seconds)
   clientActions:
   - Set shouldSurface = true
   - Transition to surfacing scene
   - Diver rises to boat
   - Colors transition dark → light

   serverActions:
   - ✓ Validate treasure matches session ($59)
   - ✓ Transfer $59 to user wallet
   - ✓ Deduct $59 from house wallet
   - ✓ Release reserved $100,000
   - ✓ Delete session

   userProfit: $59 - $50 = +$9 (18% gain)

   ↓ After 3s animation

8. BACK TO BETTING PHASE
   - New session ID generated
   - Betting card appears
   - Balance updated: $1009
   - Ready for next game

ALTERNATIVE PATH (DEATH):
   4. If drowned at any round:
      - Show "DROWNED!" message
      - Death predator animation (shark/angler)
      - Return to beach scene
      - User loses treasure
      - Balance unchanged (already deducted)
```

---

## Configuration

### Game Math (FIXED - DO NOT CHANGE WITHOUT TESTING)

**File:** `lib/constants.ts`

```typescript
export const GAME_CONFIG = {
  HOUSE_EDGE: 0.15, // 15% house advantage (provably fair)
  TARGET_EV: 0.85, // 85% RTP (return to player)
  BASE_WIN_PROB: 0.95, // 95% survival on round 1
  DECAY_CONSTANT: 0.15, // Exponential difficulty curve
  MIN_WIN_PROB: 0.01, // 1% minimum (never impossible)

  MIN_BET: 10, // $10 minimum
  MAX_BET: 500, // $500 maximum
  FIXED_BET: 50, // Current: fixed $50 bet
};
```

**Survival Probability Formula:**

```typescript
P(round) = max(
  MIN_WIN_PROB,
  BASE_WIN_PROB * exp(-DECAY_CONSTANT * (round - 1))
)

// Examples:
P(1)  = 0.95 = 95%
P(2)  = 0.81 = 81%
P(3)  = 0.69 = 69%
P(5)  = 0.48 = 48%
P(10) = 0.22 = 22%
P(20) = 0.05 = 5%
```

**⚠️ Changing these requires:**

1. Update all tests in `tests/unit/`
2. Recalculate house reserve ratio
3. Run Monte Carlo validation (10k+ trials)
4. Update documentation

---

### Visual Tuning

**File:** `components/DeepSeaDiver/sceneConstants.ts`

```typescript
export const SPAWN_RATES = {
  BUBBLE: 0.3, // 30% chance per frame (~18/sec at 60fps)
  FISH: 0.02, // 2% chance per frame
  JELLYFISH: 0.01, // 1% chance per frame
  PREDATOR_AMBIENT: 0.005, // 0.5% chance per frame
};

export const PARALLAX = {
  LAYERS: [
    { sprite: "seaweed", speed: 20, count: 8 }, // Slowest (far)
    { sprite: "corals", speed: 40, count: 6 }, // Medium
    { sprite: "rock", speed: 60, count: 4 }, // Fastest (near)
  ],
};
```

These can be adjusted for performance without affecting game logic.

---

## Security & Anti-Cheat

### Server-Side Validation

**All game logic runs on the server. The client is UNTRUSTED.**

1. **Round Number Validation**

   ```typescript
   // Prevents replay attacks (resubmitting old successful rounds)
   if (roundNumber !== gameSession.diveNumber) {
     throw new Error("Round mismatch");
   }
   ```

2. **Treasure Value Validation**

   ```typescript
   // Prevents client from inflating treasure
   const expectedValue = gameSession.currentTreasure;
   if (currentValue !== expectedValue) {
     throw new Error("Treasure mismatch");
   }
   ```

3. **Session Ownership**

   ```typescript
   // Prevents users from accessing other players' sessions
   if (gameSession.userId !== userId) {
     throw new Error("Session not found");
   }
   ```

4. **Cryptographic Randomness**
   ```typescript
   // Uses Node.js crypto module (not Math.random!)
   const randomBytes = crypto.randomBytes(4);
   const randomRoll = randomBytes.readUInt32BE(0) % 100;
   ```

---

## Production Checklist

Before deploying to production:

### Database Integration

- [ ] Replace `walletStore.ts` in-memory storage with PostgreSQL/MongoDB
- [ ] Add database migrations for wallets and sessions
- [ ] Implement connection pooling
- [ ] Add transaction logging for audits

### Authentication

- [ ] Integrate NextAuth or Web3 wallet
- [ ] Add JWT token validation
- [ ] Implement session management
- [ ] Add logout functionality

### Security

- [ ] Enable rate limiting (10 requests/min per user)
- [ ] Configure HTTPS and SSL certificates
- [ ] Add CORS protections
- [ ] Implement CSP headers
- [ ] Add input sanitization

### Monitoring

- [ ] Set up Sentry for error tracking
- [ ] Add DataDog/New Relic for performance
- [ ] Configure log aggregation (ELK stack)
- [ ] Add uptime monitoring

### Compliance

- [ ] Add KYC/AML verification
- [ ] Configure house wallet limits per jurisdiction
- [ ] Add responsible gambling limits (daily/weekly/monthly)
- [ ] Implement self-exclusion features
- [ ] Add age verification

### Payments

- [ ] Integrate payment provider (Stripe/PayPal)
- [ ] Add cryptocurrency support (optional)
- [ ] Implement withdrawal processing
- [ ] Add payment reconciliation

### Testing

- [ ] Run 100k+ Monte Carlo simulations
- [ ] Load test with 1000+ concurrent users
- [ ] Penetration testing
- [ ] Security audit by third party

---

## Testing Strategy

### Unit Tests (16 files, ~95% coverage)

**Core Logic:**

- `gameLogic.test.ts` - Depth zones, shipwrecks, stats
- `gameEngine.test.ts` - Round calculations, EV, probability
- `gameLogicExtended.test.ts` - Edge cases, boundary testing

**Wallet System:**

- `walletLogic.test.ts` - Validation, payouts, reserves
- `walletStore.test.ts` - In-memory operations
- `walletGameIntegration.test.ts` - End-to-end wallet flows

**Security:**

- `securityBlindspots.test.ts` - Round validation, treasure validation
- `serverBlindspots.test.ts` - Server-side security
- `remainingBlindspots.test.ts` - Transaction metadata

**Edge Cases:**

- `edgeCases.test.ts` - Boundary conditions
- `advancedEdgeCases.test.ts` - Float handling, large numbers
- `engineBlindspots.test.ts` - Config validation

**Probability:**

- `probabilityVerification.test.ts` - Statistical tests
- `moneyConservation.test.ts` - EV validation
- `reservationHorizon.test.ts` - House fund reservations

### E2E Tests (7 Playwright specs)

- `game-flow.spec.ts` - Complete game cycle
- `scene-transitions.spec.ts` - Canvas scene switching
- `scene-bugs-fixed.spec.ts` - Regression tests for scene bugs
- `wallet-integration.spec.ts` - Wallet operations
- `wallet-race-conditions.spec.ts` - Concurrent operations
- `comprehensive-test.spec.ts` - Full integration
- `edge-cases.spec.ts` - UI edge cases

### Monte Carlo Tests (Planned)

- 10,000 trials per round for statistical confidence
- 5,000 complete games for house edge verification
- Chi-squared goodness-of-fit tests
- Binomial confidence intervals
- Daily CI runs for regression detection

**Run Tests:**

```bash
npm test                    # E2E tests
npm run test:unit          # Unit tests
npm run test:all           # Both
```

---

## Performance Optimization

### Current Bottlenecks

1. **Bubble Spawning**
   - ~18 bubbles/second at 60fps
   - Each bubble = new GameObj allocation
   - High GC pressure

2. **Particle Effects**
   - 8-12 particles per treasure
   - Burst allocations

3. **Scene Complexity**
   - DivingScene.ts: 500+ lines
   - Multiple onUpdate() loops

### Object Pooling (Planned)

**Implementation in `lib/objectPool.ts` (ready, not yet integrated):**

```typescript
const bubblePool = new ObjectPool<PooledBubble>(
  createBubble, // Factory function
  resetBubble, // Reset function
  20, // Initial size
  100 // Max size
);

// Get from pool instead of creating
const bubble = bubblePool.get();

// Return to pool when done (auto-lifespan)
bubblePool.release(bubble);
```

**Expected Improvements:**

- 50-70% reduction in GC pressure
- 10-20% FPS improvement on low-end devices
- Smoother gameplay during particle bursts

---

## Common Pitfalls

### ⚠️ DO NOT modify treasure value client-side

```typescript
// ❌ WRONG
const newTreasure = gameState.currentTreasure * 1.5; // Client-side calculation
await performDive(round, newTreasure, session, user);

// ✅ CORRECT
await performDive(round, gameState.currentTreasure, session, user);
// Server calculates and validates
```

### ⚠️ DO NOT skip server validation

```typescript
// ❌ WRONG
if (result.survived) {
  setTreasure(currentTreasure * multiplier); // Trust client calculation
}

// ✅ CORRECT
if (result.survived) {
  setTreasure(result.totalTreasure); // Use server-calculated value
}
```

### ⚠️ DO NOT reuse session IDs

```typescript
// ❌ WRONG
const sessionId = "static-session-123";

// ✅ CORRECT
const sessionId = await generateSessionId(); // UUID v4
```

### ⚠️ DO NOT forget to release house reserves

```typescript
// ❌ WRONG
async function cashOut() {
  transferToUser(treasure);
  // Oops - reserved funds never released!
}

// ✅ CORRECT
async function cashOut() {
  transferToUser(treasure);
  releaseHouseFunds(session.initialBet); // Always release
}
```

---

## Extending the Codebase

### Adding a New Game Theme

**Example: Space Exploration Game**

1. **Create theme wrapper** (`lib/spaceLogic.ts`):

   ```typescript
   export const SPACE_ZONES = [
     { name: "Low Earth Orbit", altitude: 0, color: "#4A90E2" },
     { name: "Deep Space", altitude: 10000, color: "#1A2F4A" },
     // ...
   ];
   ```

2. **Create server actions wrapper** (`app/actions/spaceActions.ts`):

   ```typescript
   export async function launchMission(fuel: number, userId: string) {
     return startGameSession(fuel, userId, sessionId);
   }
   ```

3. **Build new scenes** (`components/SpaceExplorer/scenes/`):
   - LaunchPad.ts (equivalent to BeachScene)
   - SpaceFlight.ts (equivalent to DivingScene)
   - Landing.ts (equivalent to SurfacingScene)

4. **Reuse core engine unchanged**:
   - `lib/gameEngine.ts` - No changes needed
   - `lib/walletLogic.ts` - No changes needed
   - All probability math stays the same

**Mapping:**

- Rounds → Distance traveled
- Treasure → Fuel/supplies collected
- Depth zones → Space sectors
- Shipwrecks → Alien artifacts
- Survival probability → Mission success rate

---

## Support & Resources

**Documentation:**

- Main docs: `README.md`
- Deep analysis: `DEEP_ANALYSIS.md`
- Fixes implemented: `FIXES_IMPLEMENTED.md`
- Bug fixes: `BUG_FIXES_SUMMARY.md`

**Development:**

- Start dev server: `npm run dev`
- Build: `npm run build`
- Run tests: `npm test`

**Key Files to Understand:**

1. `lib/gameEngine.ts` - Core logic
2. `app/actions/gameEngine.ts` - Security layer
3. `app/page.tsx` - Main UI
4. `components/DeepSeaDiver/scenes/DivingScene.ts` - Main gameplay
5. `lib/constants.ts` - Configuration

---

**Last Updated:** 2025-11-16  
**Contributors:** Development Team  
**License:** Proprietary
