# Game Architecture - Generic Multiplier Engine

## Overview

The codebase is now split into two layers:

1. **Generic Game Engine** - Theme-agnostic gambling logic
2. **Theme Layer** - Visual skin/narrative (diving, space, mining, etc.)

This architecture allows the same backend logic to power multiple game themes without code duplication.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (THEME LAYER)                   │
│                                                              │
│  • Ocean graphics (OceanScene.tsx)                          │
│  • Diving terminology (dive, depth, treasure, oxygen)       │
│  • Shipwreck generation (procedural content)                │
│  • Depth zones (visual theming)                             │
│                                                              │
│  Could be replaced with:                                    │
│  • Space graphics (stars, planets, nebulae)                 │
│  • Space terminology (warp, light-years, fuel)              │
│  • Planet generation                                         │
│  • Space regions                                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   ADAPTER LAYER (gameActions.ts)            │
│                                                              │
│  Theme-specific wrappers:                                   │
│  • performDive() → executeRound() + shipwreck               │
│  • surfaceWithTreasure() → cashOut()                        │
│  • startGame() → startGameSession()                         │
│                                                              │
│  Translations:                                              │
│  • diveNumber ↔ roundNumber                                 │
│  • currentTreasure ↔ currentValue                           │
│  • depth (added by theme)                                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              GENERIC GAME ENGINE (gameEngine.ts)            │
│                                                              │
│  Pure gambling logic:                                       │
│  • calculateRoundStats(roundNumber) → probability/multiplier│
│  • executeRound() → random roll, win/lose                   │
│  • cashOut() → transfer funds                               │
│  • startGameSession() → place bet, reserve funds            │
│                                                              │
│  Math:                                                      │
│  • P(round) = max(minP, baseP × e^(-k×(round-1)))          │
│  • multiplier = (1 - houseEdge) / P(round)                 │
│  • EV = P(round) × multiplier = (1 - houseEdge) [CONSTANT] │
│                                                              │
│  No theme-specific logic!                                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  WALLET MANAGEMENT (walletLogic.ts)         │
│                                                              │
│  • Fund validation (min/max bets, house limits)            │
│  • Risk management (reserve funds, max exposure)            │
│  • Balance updates (user wins/losses, house payouts)        │
│  • Transaction logging                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Files

### Generic Engine Layer

| File | Purpose |
|------|---------|
| `lib/gameEngine.ts` | Core gambling math (probability curves, multipliers, EV) |
| `app/actions/gameEngine.ts` | Generic server actions (startGameSession, executeRound, cashOut) |
| `lib/walletLogic.ts` | Wallet validation and risk management |
| `lib/walletStore.ts` | In-memory wallet storage (would be replaced with DB) |
| `lib/walletTypes.ts` | TypeScript types for wallets, sessions, transactions |

### Theme Layer (Diving)

| File | Purpose |
|------|---------|
| `lib/gameLogic.ts` | Diving theme wrapper (adds depth, zones, shipwrecks) |
| `app/actions/gameActions.ts` | Adapter layer (diving terminology → generic engine) |
| `components/DeepSeaDiver/OceanScene.tsx` | Diving visuals (Kaplay canvas) |
| `lib/constants.ts` | Theme-specific data (depth zones, shipwreck names, etc.) |
| `lib/types.ts` | Theme-specific types (DiveStats, Shipwreck, etc.) |

---

## Game Flow

### 1. Start Game

```
Frontend: startGame($50, userId, sessionId)
    ↓
Adapter: gameActions.startGame()
    ↓
Engine: gameEngine.startGameSession()
    • Validates bet amount ($50)
    • Checks user balance
    • Calculates max potential payout (~$4,000 for 10 rounds)
    • Reserves house funds
    • Deducts $50 from user
    • Creates game session
    ↓
Result: { success: true, sessionId: "abc123" }
```

### 2. Execute Round

```
Frontend: performDive(round=1, value=$50, sessionId, userId)
    ↓
Adapter: gameActions.performDive()
    • Calls generic engine
    • Adds diving theme (depth, shipwreck)
    ↓
Engine: gameEngine.executeRound()
    • Gets round stats: P(win)=95%, multiplier=0.894x
    • Generates crypto-random roll: 47
    • Threshold: 5 (need roll >= 5 to survive)
    • Result: 47 >= 5 → SURVIVED!
    • New value: $50 × 0.894 = $44
    ↓
Adapter adds theme:
    • depth = 25m (round × 25)
    • shipwreck = { name: "HMS Valiant Pearl", ... }
    ↓
Result: { 
  survived: true, 
  totalTreasure: $44,
  depth: 25m,
  shipwreck: {...}
}
```

### 3. Cash Out

```
Frontend: surfaceWithTreasure($200, sessionId, userId)
    ↓
Adapter: gameActions.surfaceWithTreasure()
    ↓
Engine: gameEngine.cashOut()
    • Validates session is active
    • Adds $200 to user balance
    • Deducts $200 from house
    • Releases reserved funds
    • Records transaction
    • Ends game session
    ↓
Result: { success: true, finalAmount: $200, profit: $150 }
```

---

## Key Design Decisions

### 1. **Fixed Expected Value (EV)**

The game uses a **fixed house edge** (15%) regardless of rounds played:

```
EV = P(win) × multiplier = constant (0.85)
```

This is achieved by deriving the multiplier from the probability:

```typescript
multiplier = (1 - houseEdge) / P(win)
```

**Example:**
- Round 1: P=95%, multiplier=0.894x → EV = 0.95 × 0.894 = 0.85 ✓
- Round 5: P=52%, multiplier=1.63x → EV = 0.52 × 1.63 = 0.85 ✓

### 2. **Exponential Probability Decay**

Survival probability decreases exponentially:

```typescript
P(round) = max(minP, baseP × e^(-k × (round-1)))
```

Parameters:
- `baseP = 0.95` (start at 95%)
- `k = 0.15` (decay rate)
- `minP = 0.01` (floor at 1%)

This creates a smooth difficulty curve.

### 3. **Cryptographic Randomness**

Random rolls use `crypto.randomBytes()` for fairness:

```typescript
const randomBytes = crypto.randomBytes(4);
const randomRoll = randomBytes.readUInt32BE(0) % 100; // 0-99
```

This is cryptographically secure and auditable.

### 4. **House Fund Reservation**

When a bet is placed, the house reserves funds to cover the maximum potential payout:

```typescript
maxPayout = initialBet × (multiplier1 × multiplier2 × ... × multiplier10)
```

This prevents the house from accepting bets it can't pay.

### 5. **Theme Separation**

The engine knows **nothing** about:
- Diving, depth, oxygen
- Shipwrecks, treasures
- Space, planets, fuel
- Mining, caves, gems

It only knows:
- Round numbers (1, 2, 3, ...)
- Probabilities (0.95, 0.87, 0.78, ...)
- Multipliers (0.894x, 0.976x, 1.09x, ...)
- Win/lose/cash out

The theme layer adds the flavor.

---

## Creating a New Theme

Want to create a **space exploration** theme? Here's how:

### 1. Create theme logic file

```typescript
// lib/spaceLogic.ts
import { calculateRoundStats } from './gameEngine';

export function calculateWarpStats(warpNumber: number) {
  const roundStats = calculateRoundStats(warpNumber);
  
  return {
    warpNumber,
    survivalProbability: roundStats.winProbability,
    multiplier: roundStats.multiplier,
    expectedValue: roundStats.expectedValue,
    lightYears: warpNumber * 100, // Theme-specific
    fuelLevel: Math.max(5, 100 - warpNumber * 4), // Theme-specific
    region: getSpaceRegion(warpNumber * 100), // Theme-specific
  };
}

function getSpaceRegion(lightYears: number) {
  if (lightYears < 200) return "Asteroid Belt";
  if (lightYears < 500) return "Nebula";
  if (lightYears < 1000) return "Black Hole Region";
  return "Dark Matter Void";
}
```

### 2. Create theme adapter

```typescript
// app/actions/spaceActions.ts
import { startGameSession, executeRound, cashOut } from './gameEngine';
import { calculateWarpStats, generatePlanet } from '@/lib/spaceLogic';

export async function launchMission(bet, userId, sessionId) {
  return startGameSession(bet, userId, sessionId);
}

export async function performWarp(warpNumber, currentFuel, sessionId, userId) {
  const result = await executeRound(warpNumber, currentFuel, sessionId, userId);
  const warpStats = calculateWarpStats(warpNumber);
  const planet = result.survived ? generatePlanet(warpNumber, sessionId) : undefined;
  
  return {
    ...result,
    lightYears: warpStats.lightYears,
    region: warpStats.region,
    planet,
  };
}

export async function returnToBase(finalFuel, sessionId, userId) {
  return cashOut(finalFuel, sessionId, userId);
}
```

### 3. Create theme UI

```typescript
// components/SpaceScene.tsx
// Render stars, planets, spaceship, etc.
// Use same game state management as OceanScene
```

### 4. Done!

The backend math, wallet management, and security are **shared** across all themes.

---

## Testing

### Unit Tests

Run unit tests for the generic engine:

```bash
npm test -- lib/gameEngine.test.ts
```

Test coverage:
- ✓ Probability calculation
- ✓ Multiplier calculation  
- ✓ EV validation (always 0.85)
- ✓ Round simulation
- ✓ Edge cases (min/max rounds)

### Integration Tests

Run integration tests for wallet/game flow:

```bash
npm test -- tests/unit/walletGameIntegration.test.ts
```

Test coverage:
- ✓ Start game → bet validation → fund reservation
- ✓ Execute round → win → update session
- ✓ Execute round → lose → release funds, end session
- ✓ Cash out → transfer funds → end session

### E2E Tests

Run Playwright tests for full game flow:

```bash
npm test -- tests/game-flow.spec.ts
```

Test coverage:
- ✓ Place bet → dive → survive → dive → die
- ✓ Place bet → dive → survive → surface
- ✓ Wallet balance updates
- ✓ UI animations

---

## Configuration

### Game Config (Generic)

```typescript
// lib/gameEngine.ts
export const DEFAULT_CONFIG: GameConfig = {
  houseEdge: 0.15,           // 15% house edge
  baseWinProbability: 0.95,  // Start at 95%
  decayConstant: 0.15,       // Exponential decay
  minWinProbability: 0.01,   // Floor at 1%
  minBet: 10,
  maxBet: 500,
  maxPotentialWin: 100000,
  maxRounds: 50,
};
```

### Wallet Limits

```typescript
// lib/walletLogic.ts
export const DEFAULT_LIMITS: WalletLimits = {
  minBet: 10,
  maxBet: 500,
  maxPotentialWin: 100000,
  houseReserveRatio: 0.1, // Keep 10% in reserve
};
```

---

## API Reference

### Generic Engine

```typescript
// Start a game session
startGameSession(betAmount, userId, sessionId)
  → { success, error?, sessionId }

// Execute a round
executeRound(roundNumber, currentValue, sessionId, userId, testSeed?)
  → RoundResult { survived, newValue, totalValue, randomRoll, ... }

// Cash out
cashOut(finalValue, sessionId, userId)
  → { success, finalAmount, profit }

// Calculate round stats
calculateRoundStats(roundNumber)
  → { winProbability, multiplier, expectedValue, threshold }
```

### Theme Adapter (Diving)

```typescript
// Start game
startGame(betAmount, userId, sessionId)
  → { success, error?, sessionId }

// Perform dive
performDive(diveNumber, currentTreasure, sessionId, userId, testSeed?)
  → DiveResult { survived, totalTreasure, depth, shipwreck, ... }

// Surface
surfaceWithTreasure(finalTreasure, sessionId, userId)
  → { success, finalAmount, profit }

// Calculate dive stats
calculateDiveStats(diveNumber)
  → DiveStats { survivalProbability, multiplier, depth, depthZone, ... }
```

---

## Security Features

1. **Server-side RNG** - Random rolls happen on server using crypto.randomBytes()
2. **Session validation** - Every action validates session ownership
3. **Fund reservation** - House can't accept bets it can't pay
4. **Atomic transactions** - Wallet updates are logged
5. **Input validation** - All inputs sanitized and validated

---

## Future Enhancements

### 1. Database Integration

Replace in-memory storage with Postgres:

```typescript
// lib/walletStore.ts → lib/walletDb.ts
export async function getUserWallet(userId: string) {
  return await db.query('SELECT * FROM user_wallets WHERE user_id = $1', [userId]);
}
```

### 2. Provably Fair System

Add commit-reveal scheme for verifiable fairness:

```typescript
// Before round
const clientSeed = userProvidedSeed;
const serverSeed = crypto.randomBytes(32).toString('hex');
const commitment = sha256(serverSeed + clientSeed);

// After round
const randomRoll = parseInt(sha256(serverSeed + clientSeed + roundNumber).slice(0, 8), 16) % 100;

// User can verify: sha256(revealedServerSeed + clientSeed) === commitment
```

### 3. Multi-theme Support

Add theme selection to UI:

```typescript
<select onChange={e => setTheme(e.target.value)}>
  <option value="diving">🤿 Deep Sea Diving</option>
  <option value="space">🚀 Space Exploration</option>
  <option value="mining">⛏️ Cave Mining</option>
</select>
```

Each theme uses the same backend!

### 4. Leaderboards

Track high scores per theme:

```typescript
// Top 10 deepest dives
SELECT user_id, MAX(rounds) as max_rounds, MAX(payout) as max_payout
FROM game_sessions
WHERE theme = 'diving' AND ended_at > NOW() - INTERVAL '7 days'
GROUP BY user_id
ORDER BY max_rounds DESC
LIMIT 10;
```

---

## Summary

✅ **Generic engine** handles all gambling logic (math, RNG, wallets)  
✅ **Theme layer** adds visuals and narrative (diving, space, mining, etc.)  
✅ **Adapter layer** translates theme terminology to generic API  
✅ **Same backend** powers infinite game themes  
✅ **Clean separation** of concerns (business logic vs presentation)  
✅ **Fully tested** (unit, integration, E2E)  
✅ **Cryptographically secure** random number generation  
✅ **Provably fair** math (fixed EV)  

The backend doesn't care if you're diving for treasure or mining for gems—it just generates random numbers and multiplies values. The theme makes it fun! 🎮
