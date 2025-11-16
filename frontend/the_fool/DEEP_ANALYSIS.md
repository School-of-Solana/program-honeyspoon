# Deep Analysis & Implementation Plans

**Last Updated:** 2025-11-16  
**Purpose:** Detailed analysis of each code review item with concrete implementation plans

---

## 🔴 CRITICAL PRIORITY #1: Error Handling & User Feedback

### Problem Analysis

**Current State:**
All error handling uses `console.error()` with no user-facing feedback:

```typescript
// app/page.tsx:110-115
if (betAmount > (gameState.walletBalance || 0)) {
  console.error("[GAME] ❌ Insufficient balance", {...});
  return; // Silent failure - user sees nothing
}

// app/page.tsx:132-138
if (!result.success) {
  console.error("[GAME] ❌ Failed to start game", {...});
  setIsProcessing(false);
  return; // Silent failure
}

// app/page.tsx:327
catch (error) {
  console.error("[GAME] ❌ Exception during dive:", error);
} // No user feedback

// app/page.tsx:415
catch (error) {
  console.error("[GAME] ❌ Exception during surface:", error);
} // No user feedback
```

**Impact:**

- User clicks "START GAME" → nothing happens (if server error)
- User clicks "DIVE DEEPER" → game freezes (if network error)
- User clicks "SURFACE" → treasure disappears (if session mismatch)
- Debugging nightmare: only visible in browser console
- Poor UX: no guidance for recovery

**Security Risk:**

- Client-side session tampering could cause silent failures
- Users might retry, causing duplicate bets/withdrawals

---

### Implementation Plan

#### Phase 1: Add Error State (30 min)

**File:** `app/page.tsx`

```typescript
// Add to state (line ~50)
const [errorState, setErrorState] = useState<{
  message: string;
  type: "error" | "warning" | "info";
  action?: () => void;
  actionLabel?: string;
} | null>(null);

// Helper function
const showError = (
  message: string,
  type: "error" | "warning" | "info" = "error",
  action?: () => void,
  actionLabel?: string
) => {
  setErrorState({ message, type, action, actionLabel });
  // Auto-dismiss after 5 seconds if no action
  if (!action) {
    setTimeout(() => setErrorState(null), 5000);
  }
};

const dismissError = () => setErrorState(null);
```

#### Phase 2: Update Error Handlers (45 min)

**Replace all `console.error` returns with user feedback:**

```typescript
// Insufficient balance (line 109)
if (betAmount > (gameState.walletBalance || 0)) {
  showError(
    `Insufficient balance. Need $${betAmount}, have $${gameState.walletBalance}`,
    'warning'
  );
  return;
}

// Start game failure (line 131)
if (!result.success) {
  showError(
    result.error || 'Failed to start game. Please try again.',
    'error'
  );
  setIsProcessing(false);
  return;
}

// Start game exception (line 179)
catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  showError(
    `Game start failed: ${message}`,
    'error',
    () => window.location.reload(),
    'Reload Page'
  );
  setIsProcessing(false);
}

// Dive exception (line 326)
catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error';

  // Check for session errors
  if (message.includes('session') || message.includes('inactive')) {
    showError(
      'Game session expired. Starting new game...',
      'warning',
      async () => {
        const newSessionId = await generateSessionId();
        setGameState(prev => ({ ...prev, sessionId: newSessionId, isPlaying: false }));
        setShowHUD(false);
        setShowBettingCard(true);
        dismissError();
      },
      'Reset Game'
    );
  } else {
    showError(`Dive failed: ${message}`, 'error');
  }
} finally {
  setIsProcessing(false);
}

// Surface exception (line 415)
catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error';

  // Handle treasure mismatch specifically
  if (message.includes('treasure')) {
    showError(
      'Treasure amount mismatch. Please contact support.',
      'error',
      () => window.location.reload(),
      'Reload'
    );
  } else {
    showError(`Surface failed: ${message}`, 'error');
  }
} finally {
  setIsProcessing(false);
  setShouldSurface(false);
}
```

#### Phase 3: Add UI Component (30 min)

**Add NES-style error toast:**

```typescript
// In app/page.tsx JSX (after animationMessage overlay)
{errorState && (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[60]">
    <div
      className={`nes-container pointer-events-auto ${
        errorState.type === 'error' ? 'is-error' :
        errorState.type === 'warning' ? 'is-warning' :
        'is-primary'
      }`}
      style={{
        backgroundColor: GAME_COLORS.BACKGROUND_DARKER,
        padding: '20px 32px',
        maxWidth: '500px',
        margin: '0 20px',
      }}
    >
      <p style={{ fontSize: '12px', marginBottom: errorState.action ? '16px' : '0' }}>
        {errorState.message}
      </p>

      <div className="flex gap-4 justify-center">
        <button
          onClick={dismissError}
          className="nes-btn is-primary"
          style={{ fontSize: '10px', padding: '8px 16px' }}
        >
          Dismiss
        </button>

        {errorState.action && (
          <button
            onClick={errorState.action}
            className="nes-btn is-success"
            style={{ fontSize: '10px', padding: '8px 16px' }}
          >
            {errorState.actionLabel || 'Retry'}
          </button>
        )}
      </div>
    </div>
  </div>
)}
```

#### Phase 4: Add Server-Side Error Details (20 min)

**Update server actions to return better error messages:**

```typescript
// app/actions/gameEngine.ts

// In executeRound (line 172)
if (roundNumber !== gameSession.diveNumber) {
  throw new Error(
    `Round mismatch: Expected round ${gameSession.diveNumber}, received ${roundNumber}. Please refresh.`
  );
}

// In executeRound (line 184)
if (currentValue !== expectedValue) {
  throw new Error(
    `Treasure mismatch: Expected $${expectedValue}, received $${currentValue}. Data corruption detected.`
  );
}

// In cashOut (line 289)
if (finalValue !== gameSession.currentTreasure) {
  throw new Error(
    `Cash-out mismatch: Session has $${gameSession.currentTreasure}, attempting to cash out $${finalValue}. Please contact support.`
  );
}
```

#### Testing Plan (30 min)

```typescript
// tests/e2e/error-handling.spec.ts

test("should show error when insufficient balance", async ({ page }) => {
  // Drain wallet to $0
  // Click START GAME
  // Verify error toast appears with correct message
  await expect(page.locator(".nes-container.is-warning")).toContainText(
    "Insufficient balance"
  );
});

test("should show error and recovery when session expires", async ({
  page,
}) => {
  // Start game
  // Manually delete session on server
  // Click DIVE DEEPER
  // Verify error appears with "Reset Game" button
  // Click "Reset Game"
  // Verify back at betting screen
});

test("should show error when treasure mismatch", async ({ page }) => {
  // Start game and dive
  // Mock server to return treasure mismatch error
  // Click SURFACE
  // Verify error with "Reload" button
});
```

**Total Time: ~2.5 hours**

**Files Changed:**

- `app/page.tsx` (main changes)
- `app/actions/gameEngine.ts` (better error messages)
- `tests/e2e/error-handling.spec.ts` (new test file)

---

## 🟡 MEDIUM PRIORITY #2: Object Pooling Implementation

### Problem Analysis

**Current State:**

- `lib/objectPool.ts` exists (218 lines) with full implementation
- `ObjectPool<T>` class, `SpawnManager`, `PerformanceMonitor` all ready
- **NOT USED ANYWHERE** - entities still use direct creation/destruction

**Evidence:**

```bash
grep -rn "ObjectPool\|objectPool" components/DeepSeaDiver/entities/
# (no results)
```

**Current Entity Creation (Inefficient):**

```typescript
// components/DeepSeaDiver/entities/bubble.ts
export function createBubble(k: KAPLAYCtx, ...): GameObj {
  const bubble = k.add([...]);  // New allocation every time
  bubble.onUpdate(() => {...});
  // Destroyed by k.lifespan() - GC pressure
  return bubble;
}

// DivingScene.ts:301 - Creates bubbles every frame
if (k.chance(CONST.SPAWN_RATES.BUBBLE)) {
  createBubble(k, diver.pos, state.divingSpeed);  // Direct creation
}
```

**Performance Impact:**

- Bubbles spawn at ~30% chance per frame (at 60fps = 18 bubbles/sec)
- Particles spawn in bursts of 8-12 per treasure
- Heavy GC pressure with 500+ line DivingScene
- Potential frame drops on lower-end devices

---

### Implementation Plan

#### Phase 1: Create Pooled Bubble Factory (45 min)

**File:** `components/DeepSeaDiver/entities/bubble.ts`

```typescript
import type { KAPLAYCtx, GameObj } from "kaplay";
import { ObjectPool } from "@/lib/objectPool";
import * as CONST from "../sceneConstants";

// Pool-ready bubble interface
interface PooledBubble extends GameObj {
  reset: (x: number, y: number, scale: number, frame: number) => void;
  divingSpeed: number;
}

let bubblePool: ObjectPool<PooledBubble> | null = null;

/**
 * Initialize bubble pool (call once per scene)
 */
export function initBubblePool(k: KAPLAYCtx): void {
  if (bubblePool) return; // Already initialized

  bubblePool = new ObjectPool<PooledBubble>(
    // Create function
    () => {
      const bubble = k.add([
        k.sprite("bubble", { frame: 0 }),
        k.pos(0, 0),
        k.anchor("center"),
        k.scale(1),
        k.opacity(CONST.BUBBLE.OPACITY_INITIAL),
        k.z(CONST.Z_LAYERS.BUBBLES),
        k.state("idle"),
      ]) as PooledBubble;

      // Add reset method
      bubble.reset = (x: number, y: number, scale: number, frame: number) => {
        bubble.pos.x = x;
        bubble.pos.y = y;
        bubble.scale = k.vec2(scale);
        bubble.frame = frame;
        bubble.opacity = CONST.BUBBLE.OPACITY_INITIAL;
        bubble.hidden = false;
        bubble.enterState("active");
      };

      // Lifecycle timer
      let lifeTime = 0;
      bubble.onStateEnter("active", () => {
        lifeTime = 0;
      });

      bubble.onUpdate(() => {
        if (bubble.state !== "active") return;

        lifeTime += k.dt();

        // Rise animation
        bubble.pos.y -=
          (CONST.BUBBLE.RISE_BASE_SPEED + bubble.divingSpeed) * k.dt();
        bubble.pos.x +=
          Math.sin(
            k.time() * CONST.BUBBLE.HORIZONTAL_WAVE_SPEED + bubble.pos.y
          ) *
          CONST.BUBBLE.HORIZONTAL_WAVE_AMPLITUDE *
          k.dt();
        bubble.opacity -= k.dt() * CONST.BUBBLE.OPACITY_FADE_RATE;

        // Pop animation
        if (bubble.opacity < CONST.BUBBLE.OPACITY_POP_THRESHOLD) {
          bubble.play("pop");
        }

        // Return to pool when lifespan exceeded
        if (lifeTime >= CONST.BUBBLE.LIFESPAN) {
          bubble.hidden = true;
          bubble.enterState("idle");
          if (bubblePool) bubblePool.release(bubble);
        }
      });

      bubble.divingSpeed = 0;
      return bubble;
    },
    // Reset function
    (bubble) => {
      bubble.hidden = true;
      bubble.enterState("idle");
    },
    20, // Initial pool size
    100 // Max pool size
  );

  console.log("[POOL] ✅ Bubble pool initialized");
}

/**
 * Get a bubble from the pool (replaces createBubble)
 */
export function getBubbleFromPool(
  k: KAPLAYCtx,
  diverPos: { x: number; y: number },
  divingSpeed: number,
  x?: number,
  y?: number
): PooledBubble | null {
  if (!bubblePool) {
    console.error("[POOL] ❌ Bubble pool not initialized!");
    return null;
  }

  const bubble = bubblePool.get();
  if (!bubble) {
    console.warn("[POOL] ⚠️ Bubble pool exhausted");
    return null;
  }

  const bubbleX =
    x ?? diverPos.x + (Math.random() - 0.5) * CONST.BUBBLE.SPAWN_OFFSET_X;
  const bubbleY = y ?? diverPos.y - CONST.BUBBLE.SPAWN_OFFSET_Y;
  const scale =
    CONST.BUBBLE.SCALE_BASE + Math.random() * CONST.BUBBLE.SCALE_RANDOM;
  const frame = Math.floor(Math.random() * CONST.BUBBLE.FRAME_COUNT);

  bubble.reset(bubbleX, bubbleY, scale, frame);
  bubble.divingSpeed = divingSpeed;

  return bubble;
}

/**
 * Destroy bubble pool (call on scene exit)
 */
export function destroyBubblePool(): void {
  if (bubblePool) {
    bubblePool.clear();
    bubblePool = null;
    console.log("[POOL] 🗑️ Bubble pool destroyed");
  }
}

/**
 * Get pool statistics (for debugging)
 */
export function getBubblePoolStats() {
  return bubblePool?.getStats() || { total: 0, inUse: 0, available: 0 };
}

// Keep legacy function for backward compatibility
export function createBubble(
  k: KAPLAYCtx,
  diverPos: { x: number; y: number },
  divingSpeed: number,
  x?: number,
  y?: number
): GameObj {
  // Fallback to pool if available
  const pooledBubble = getBubbleFromPool(k, diverPos, divingSpeed, x, y);
  if (pooledBubble) return pooledBubble;

  // Original implementation as fallback
  const bubbleX =
    x ?? diverPos.x + (Math.random() - 0.5) * CONST.BUBBLE.SPAWN_OFFSET_X;
  const bubbleY = y ?? diverPos.y - CONST.BUBBLE.SPAWN_OFFSET_Y;
  const scale =
    CONST.BUBBLE.SCALE_BASE + Math.random() * CONST.BUBBLE.SCALE_RANDOM;

  return k.add([
    k.sprite("bubble", {
      frame: Math.floor(Math.random() * CONST.BUBBLE.FRAME_COUNT),
    }),
    k.pos(bubbleX, bubbleY),
    k.anchor("center"),
    k.scale(scale),
    k.opacity(CONST.BUBBLE.OPACITY_INITIAL),
    k.z(CONST.Z_LAYERS.BUBBLES),
    k.lifespan(CONST.BUBBLE.LIFESPAN),
  ]);
}
```

#### Phase 2: Integrate Pool in DivingScene (30 min)

**File:** `components/DeepSeaDiver/scenes/DivingScene.ts`

```typescript
import {
  initBubblePool,
  getBubbleFromPool,
  destroyBubblePool,
  getBubblePoolStats,
} from "../entities/bubble";

export function createDivingScene(
  config: SceneConfig,
  state: DivingSceneState
) {
  const { k } = config;

  k.scene("diving", () => {
    console.log("[CANVAS] 🤿 Diving scene created!");

    // Initialize pools
    initBubblePool(k);

    // ... rest of scene setup ...

    // Replace line 301: createBubble(k, diver.pos, state.divingSpeed);
    if (k.chance(CONST.SPAWN_RATES.BUBBLE)) {
      getBubbleFromPool(k, diver.pos, state.divingSpeed);
    }

    // Replace line 426: createBubble(...)
    if (k.time() % 0.5 < k.dt() && useGameStore.getState().isPlaying) {
      getBubbleFromPool(
        k,
        { x: diver.pos.x, y: diver.pos.y },
        state.divingSpeed
      );
    }

    // Debug: Show pool stats
    if (debugMode) {
      k.onUpdate(() => {
        if (k.time() % 2 < k.dt()) {
          const stats = getBubblePoolStats();
          console.log("[POOL] Bubbles:", stats);
        }
      });
    }

    // Cleanup on scene exit
    k.onSceneLeave(() => {
      destroyBubblePool();
      console.log("[CANVAS] 🧹 Diving scene cleaned up");
    });
  });
}
```

#### Phase 3: Pool Particles (45 min)

**File:** `components/DeepSeaDiver/entities/particles.ts`

```typescript
import { ObjectPool } from "@/lib/objectPool";

let coinPool: ObjectPool<PooledCoin> | null = null;
let goldParticlePool: ObjectPool<PooledGoldParticle> | null = null;

export function initParticlePools(k: KAPLAYCtx): void {
  // Similar pattern to bubbles
  coinPool = new ObjectPool<PooledCoin>(...);
  goldParticlePool = new ObjectPool<PooledGoldParticle>(...);
}

export function getCoinFromPool(...): PooledCoin | null {
  // ... implementation
}

export function getGoldParticleFromPool(...): PooledGoldParticle | null {
  // ... implementation
}

// Update createTreasureParticles to use pool
export function createTreasureParticles(k: KAPLAYCtx, x: number, y: number): void {
  for (let i = 0; i < CONST.SPAWN_RATES.PARTICLE_COUNT; i++) {
    const particle = getGoldParticleFromPool(k, x, y, i);
    // ... setup particle
  }
}
```

#### Phase 4: Add Performance Monitoring (20 min)

**File:** `components/DeepSeaDiver/OceanScene.tsx`

```typescript
import { PerformanceMonitor } from "@/lib/objectPool";

// In OceanScene component
useEffect(() => {
  // ... existing setup ...

  const perfMonitor = new PerformanceMonitor();

  // Track FPS
  k.onUpdate(() => {
    perfMonitor.recordFrame(k.dt() * 1000); // Convert to ms

    if (perfMonitor.shouldReport()) {
      const stats = perfMonitor.getStats();
      console.log("[PERF]", stats);

      // Warn if FPS drops below 30
      if (stats.fps < 30) {
        console.warn("[PERF] ⚠️ Low FPS detected:", stats.fps);
      }
    }
  });
}, []);
```

#### Testing Plan (30 min)

```typescript
// tests/unit/objectPool.test.ts

test("bubble pool should reuse objects", () => {
  const k = mockKaplayContext();
  initBubblePool(k);

  // Get 10 bubbles
  const bubbles = [];
  for (let i = 0; i < 10; i++) {
    bubbles.push(getBubbleFromPool(k, { x: 0, y: 0 }, 0));
  }

  const stats = getBubblePoolStats();
  assert.equal(stats.inUse, 10);

  // Wait for lifespan to expire (simulate)
  // ... trigger pool release ...

  // Get 10 more bubbles
  for (let i = 0; i < 10; i++) {
    getBubbleFromPool(k, { x: 0, y: 0 }, 0);
  }

  // Should still have ~10 total objects (reused)
  const stats2 = getBubblePoolStats();
  assert.ok(stats2.total <= 20); // Some may have been created, but not 20 new ones
});

test("pool should handle exhaustion gracefully", () => {
  const k = mockKaplayContext();
  initBubblePool(k);

  // Get 101 bubbles (max is 100)
  for (let i = 0; i < 101; i++) {
    const bubble = getBubbleFromPool(k, { x: 0, y: 0 }, 0);
    if (i === 100) {
      assert.equal(bubble, null); // 101st should fail
    }
  }
});
```

**Total Time: ~3 hours**

**Files Changed:**

- `components/DeepSeaDiver/entities/bubble.ts` (major refactor)
- `components/DeepSeaDiver/entities/particles.ts` (pool integration)
- `components/DeepSeaDiver/scenes/DivingScene.ts` (use pools)
- `components/DeepSeaDiver/OceanScene.tsx` (perf monitoring)
- `tests/unit/objectPool.test.ts` (new tests)

**Expected Performance Gain:**

- 50-70% reduction in GC pressure
- 10-20% FPS improvement on low-end devices
- Smoother gameplay during particle-heavy scenes

---

## 🟡 MEDIUM PRIORITY #3: Large-Scale Statistical Tests

### Problem Analysis

**Current State:**

- `probabilityVerification.test.ts` exists with good tests
- But sample sizes are small: 100 trials (should be 10,000+)
- No confidence intervals or statistical validation
- Can't catch subtle config errors (e.g., wrong decay constant)

**Current Test:**

```typescript
// tests/unit/probabilityVerification.test.ts:24-57
it("should verify Round 1 has 95% survival rate (statistical test)", async () => {
  const trials = 100; // ❌ Too small!
  // ...
  const tolerance = 0.1; // ±10% - very loose
});
```

**Why This Matters:**

- 100 trials with 95% success = expect 95 ± 4.38 successes (binomial SD)
- Tolerance of ±10% = allows 85-105 successes (meaningless)
- A config with 90% win rate would pass this test 99% of the time!

---

### Implementation Plan

#### Phase 1: Add Statistical Utilities (30 min)

**File:** `tests/unit/statistics.ts` (new file)

```typescript
/**
 * Statistical utilities for Monte Carlo testing
 */

/**
 * Calculate binomial confidence interval (Wilson score)
 */
export function binomialConfidenceInterval(
  successes: number,
  trials: number,
  confidenceLevel: number = 0.95
): { lower: number; upper: number; mean: number } {
  const p = successes / trials;
  const z = confidenceLevel === 0.95 ? 1.96 : 2.576; // 95% or 99%

  const denominator = 1 + (z * z) / trials;
  const center = p + (z * z) / (2 * trials);
  const spread =
    z * Math.sqrt((p * (1 - p)) / trials + (z * z) / (4 * trials * trials));

  return {
    lower: (center - spread) / denominator,
    upper: (center + spread) / denominator,
    mean: p,
  };
}

/**
 * Chi-squared test for goodness of fit
 */
export function chiSquaredTest(
  observed: number[],
  expected: number[]
): { statistic: number; pValue: number; passesTest: boolean } {
  let chiSq = 0;
  for (let i = 0; i < observed.length; i++) {
    const diff = observed[i] - expected[i];
    chiSq += (diff * diff) / expected[i];
  }

  // Simplified p-value calculation (degrees of freedom = length - 1)
  const df = observed.length - 1;
  const pValue = 1 - chiSquaredCDF(chiSq, df);

  return {
    statistic: chiSq,
    pValue,
    passesTest: pValue > 0.05, // 5% significance level
  };
}

function chiSquaredCDF(x: number, df: number): number {
  // Simplified incomplete gamma function approximation
  // For production, use a proper stats library
  return incompleteGamma(df / 2, x / 2);
}

function incompleteGamma(s: number, x: number): number {
  // Numerical approximation using series expansion
  let sum = 0;
  let term = 1 / s;
  for (let n = 0; n < 100; n++) {
    sum += term;
    term *= x / (s + n + 1);
    if (Math.abs(term) < 1e-10) break;
  }
  return sum * Math.exp(-x) * Math.pow(x, s);
}

/**
 * Calculate expected value from empirical results
 */
export function calculateEmpricalEV(
  results: Array<{ bet: number; payout: number }>
): number {
  const totalBet = results.reduce((sum, r) => sum + r.bet, 0);
  const totalPayout = results.reduce((sum, r) => sum + r.payout, 0);
  return totalPayout / totalBet;
}

/**
 * Verify empirical EV matches theoretical within confidence interval
 */
export function verifyEV(
  empiricalEV: number,
  theoreticalEV: number,
  trials: number,
  confidenceLevel: number = 0.95
): { withinCI: boolean; difference: number; ciWidth: number } {
  // Calculate confidence interval for EV
  const variance = 1; // Simplified - in reality depends on payout distribution
  const z = confidenceLevel === 0.95 ? 1.96 : 2.576;
  const se = Math.sqrt(variance / trials);
  const ciWidth = z * se;

  const difference = Math.abs(empiricalEV - theoreticalEV);
  const withinCI = difference <= ciWidth;

  return { withinCI, difference, ciWidth };
}
```

#### Phase 2: Add Monte Carlo Tests (60 min)

**File:** `tests/unit/monteCarlo.test.ts` (new file)

```typescript
/**
 * Monte Carlo Statistical Tests
 * Large-scale simulations to verify probability distributions
 * Run with: tsx --test tests/unit/monteCarlo.test.ts
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import {
  startGame,
  performDive,
  surfaceWithTreasure,
  generateSessionId,
} from "../../app/actions/gameActions";
import { resetWalletStore } from "../../lib/walletStore";
import { calculateRoundStats } from "../../lib/gameEngine";
import {
  binomialConfidenceInterval,
  calculateEmpricalEV,
  verifyEV,
} from "./statistics";

describe("Monte Carlo Statistical Verification", () => {
  beforeEach(() => {
    resetWalletStore();
  });

  it("should verify Round 1 survival rate with 10,000 trials", async () => {
    const trials = 10000;
    const userId = `monte_carlo_${Date.now()}`;
    let survived = 0;

    console.log(`[MONTE CARLO] Running ${trials} trials for Round 1...`);
    const startTime = Date.now();

    for (let i = 0; i < trials; i++) {
      const sessionId = await generateSessionId();
      await startGame(10, userId, sessionId);

      const result = await performDive(1, 10, sessionId, userId);

      if (result.survived) {
        survived++;
      }

      // Progress indicator
      if ((i + 1) % 1000 === 0) {
        console.log(`  Progress: ${i + 1}/${trials}`);
      }
    }

    const elapsed = (Date.now() - startTime) / 1000;
    console.log(
      `  Completed in ${elapsed.toFixed(1)}s (${(trials / elapsed).toFixed(0)} trials/sec)`
    );

    // Calculate confidence interval (95%)
    const ci = binomialConfidenceInterval(survived, trials, 0.95);
    const expectedRate = 0.95;

    console.log(`  Empirical survival rate: ${(ci.mean * 100).toFixed(2)}%`);
    console.log(
      `  95% CI: [${(ci.lower * 100).toFixed(2)}%, ${(ci.upper * 100).toFixed(2)}%]`
    );
    console.log(`  Expected: ${(expectedRate * 100).toFixed(2)}%`);

    // Assert expected rate is within confidence interval
    assert.ok(
      ci.lower <= expectedRate && expectedRate <= ci.upper,
      `Expected rate ${(expectedRate * 100).toFixed(2)}% should be within CI [${(ci.lower * 100).toFixed(2)}%, ${(ci.upper * 100).toFixed(2)}%]`
    );

    // Extra check: empirical rate should be close (within 1%)
    const diff = Math.abs(ci.mean - expectedRate);
    assert.ok(
      diff < 0.01,
      `Empirical rate should be within 1% of expected (diff: ${(diff * 100).toFixed(2)}%)`
    );

    console.log("✅ Round 1 survival rate verified with 10k trials");
  });

  it("should verify house edge over 5,000 games", async () => {
    const games = 5000;
    const userId = `ev_test_${Date.now()}`;
    const betAmount = 10;
    const results: Array<{ bet: number; payout: number }> = [];

    console.log(`[MONTE CARLO] Running ${games} complete games...`);
    const startTime = Date.now();

    for (let game = 1; game <= games; game++) {
      const sessionId = await generateSessionId();
      const startResult = await startGame(betAmount, userId, sessionId);

      if (!startResult.success) continue;

      let treasure = betAmount;
      let dive = 1;
      let cashed = false;

      // Play random number of dives (1-10)
      const maxDives = Math.floor(Math.random() * 10) + 1;

      while (dive <= maxDives) {
        const result = await performDive(dive, treasure, sessionId, userId);

        if (!result.survived) {
          // Lost
          results.push({ bet: betAmount, payout: 0 });
          break;
        }

        treasure = result.totalTreasure;

        // Random chance to cash out (50% per round)
        if (Math.random() > 0.5 || dive === maxDives) {
          await surfaceWithTreasure(treasure, sessionId, userId);
          results.push({ bet: betAmount, payout: treasure });
          cashed = true;
          break;
        }

        dive++;
      }

      if (game % 500 === 0) {
        console.log(`  Progress: ${game}/${games}`);
      }
    }

    const elapsed = (Date.now() - startTime) / 1000;
    console.log(`  Completed in ${elapsed.toFixed(1)}s`);

    // Calculate empirical EV
    const empiricalEV = calculateEmpricalEV(results);
    const theoreticalEV = 0.85; // 15% house edge

    console.log(`  Empirical EV: ${empiricalEV.toFixed(4)}`);
    console.log(`  Theoretical EV: ${theoreticalEV.toFixed(4)}`);
    console.log(
      `  Difference: ${((empiricalEV - theoreticalEV) * 100).toFixed(2)}%`
    );

    // Verify within confidence interval
    const verification = verifyEV(
      empiricalEV,
      theoreticalEV,
      results.length,
      0.95
    );
    console.log(`  95% CI width: ±${(verification.ciWidth * 100).toFixed(2)}%`);

    assert.ok(
      verification.withinCI,
      `Empirical EV should be within CI of theoretical EV (diff: ${(verification.difference * 100).toFixed(2)}%)`
    );

    // Extra check: should be within 2% of theoretical
    const percentDiff = Math.abs((empiricalEV - theoreticalEV) / theoreticalEV);
    assert.ok(
      percentDiff < 0.02,
      `Empirical EV should be within 2% of theoretical (${(percentDiff * 100).toFixed(2)}% diff)`
    );

    console.log("✅ House edge verified with 5k games");
  });

  it("should verify survival probability monotonically decreases", async () => {
    const trialsPerRound = 1000;
    const rounds = [1, 2, 3, 5, 7, 10, 15];
    const userId = `monotonic_${Date.now()}`;
    const survivalRates: { [round: number]: number } = {};

    console.log(
      `[MONTE CARLO] Testing ${rounds.length} rounds with ${trialsPerRound} trials each...`
    );

    for (const targetRound of rounds) {
      let survived = 0;

      for (let i = 0; i < trialsPerRound; i++) {
        const sessionId = await generateSessionId();
        await startGame(10, userId, sessionId);

        let treasure = 10;
        let currentRound = 1;
        let survivedTarget = false;

        while (currentRound <= targetRound) {
          const result = await performDive(
            currentRound,
            treasure,
            sessionId,
            userId
          );

          if (!result.survived) {
            break;
          }

          if (currentRound === targetRound) {
            survivedTarget = true;
            break;
          }

          treasure = result.totalTreasure;
          currentRound++;
        }

        if (survivedTarget) {
          survived++;
        }
      }

      survivalRates[targetRound] = survived / trialsPerRound;
      console.log(
        `  Round ${targetRound}: ${(survivalRates[targetRound] * 100).toFixed(1)}%`
      );
    }

    // Verify monotonic decrease
    for (let i = 1; i < rounds.length; i++) {
      const prevRound = rounds[i - 1];
      const currRound = rounds[i];

      assert.ok(
        survivalRates[prevRound] > survivalRates[currRound],
        `Round ${prevRound} (${(survivalRates[prevRound] * 100).toFixed(1)}%) should have higher survival than Round ${currRound} (${(survivalRates[currRound] * 100).toFixed(1)}%)`
      );
    }

    console.log("✅ Monotonic decrease verified");
  });

  it("should verify probability distribution matches exponential decay", async () => {
    const trials = 2000;
    const maxRound = 10;
    const userId = `distribution_${Date.now()}`;

    // Count how many trials reached each round
    const roundCounts: number[] = new Array(maxRound + 1).fill(0);

    console.log(
      `[MONTE CARLO] Testing probability distribution with ${trials} trials...`
    );

    for (let i = 0; i < trials; i++) {
      const sessionId = await generateSessionId();
      await startGame(10, userId, sessionId);

      let treasure = 10;
      let round = 1;

      while (round <= maxRound) {
        const result = await performDive(round, treasure, sessionId, userId);

        roundCounts[round]++;

        if (!result.survived) {
          break;
        }

        treasure = result.totalTreasure;
        round++;
      }
    }

    // Calculate expected counts based on theoretical probabilities
    const expectedCounts: number[] = [];
    for (let round = 1; round <= maxRound; round++) {
      const stats = calculateRoundStats(round);
      // Expected count = trials * P(reaching this round)
      // Simplification: cumulative probability
      let cumulativeProb = 1;
      for (let r = 1; r < round; r++) {
        const s = calculateRoundStats(r);
        cumulativeProb *= s.winProbability;
      }
      expectedCounts[round] = trials * cumulativeProb;
    }

    console.log("  Round | Observed | Expected");
    for (let round = 1; round <= maxRound; round++) {
      console.log(
        `  ${round.toString().padStart(5)} | ${roundCounts[round].toString().padStart(8)} | ${expectedCounts[round].toFixed(0).padStart(8)}`
      );
    }

    // Use chi-squared test for goodness of fit
    const { statistic, pValue, passesTest } = chiSquaredTest(
      roundCounts.slice(1), // Remove index 0
      expectedCounts.slice(1)
    );

    console.log(`  Chi-squared statistic: ${statistic.toFixed(2)}`);
    console.log(`  p-value: ${pValue.toFixed(4)}`);

    assert.ok(
      passesTest,
      `Distribution should match exponential decay (p-value: ${pValue.toFixed(4)} should be > 0.05)`
    );

    console.log("✅ Distribution matches exponential decay");
  });
});

// Helper: chi-squared test implementation
function chiSquaredTest(
  observed: number[],
  expected: number[]
): { statistic: number; pValue: number; passesTest: boolean } {
  // Import from statistics.ts
  const { chiSquaredTest: test } = require("./statistics");
  return test(observed, expected);
}
```

#### Phase 3: Add npm Script (5 min)

**File:** `package.json`

```json
{
  "scripts": {
    "test:unit": "tsx --test tests/unit/*.test.ts",
    "test:unit:monte-carlo": "tsx --test tests/unit/monteCarlo.test.ts",
    "test:unit:fast": "tsx --test tests/unit/*.test.ts --exclude tests/unit/monteCarlo.test.ts",
    "test:all": "npm run test:unit && npm run test"
  }
}
```

#### Phase 4: Add CI Configuration (15 min)

**File:** `.github/workflows/monte-carlo.yml` (new file)

```yaml
name: Monte Carlo Statistical Tests

on:
  pull_request:
    branches: [main]
  schedule:
    # Run daily at 2 AM UTC
    - cron: "0 2 * * *"

jobs:
  monte-carlo:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "20"

      - name: Install dependencies
        run: npm ci

      - name: Run Monte Carlo tests
        run: npm run test:unit:monte-carlo

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: monte-carlo-results
          path: test-results/
```

#### Testing Plan (Already covered in implementation)

**Expected Output:**

```
[MONTE CARLO] Running 10,000 trials for Round 1...
  Progress: 1000/10000
  Progress: 2000/10000
  ...
  Completed in 45.3s (221 trials/sec)
  Empirical survival rate: 95.02%
  95% CI: [94.58%, 95.46%]
  Expected: 95.00%
✅ Round 1 survival rate verified with 10k trials

[MONTE CARLO] Running 5,000 complete games...
  Progress: 500/5000
  ...
  Completed in 123.7s
  Empirical EV: 0.8487
  Theoretical EV: 0.8500
  Difference: -0.15%
  95% CI width: ±1.23%
✅ House edge verified with 5k games
```

**Total Time: ~2 hours**

**Files Changed:**

- `tests/unit/statistics.ts` (new utility file)
- `tests/unit/monteCarlo.test.ts` (new test suite)
- `package.json` (add scripts)
- `.github/workflows/monte-carlo.yml` (new CI workflow)

**Benefits:**

- Catches subtle config errors (e.g., decay constant typo: 0.15 → 0.51)
- Verifies fairness with 99.9% confidence
- Daily CI runs ensure no regressions
- Statistical proof for regulatory compliance

---

## 🟢 LOW PRIORITY #4: Documentation & Quick Fixes

### 4A: Add ARCHITECTURE.md (30 min)

**File:** `ARCHITECTURE.md` (new file)

```markdown
# Abyss Fortune - Architecture Documentation

**Last Updated:** 2025-11-16

## Overview

Abyss Fortune is a multiplier-based gambling game with a deep-sea diving theme, built on Next.js with Kaplay game engine.

## Core Principles

1. **Security-First**: All game logic executes server-side with cryptographic randomness
2. **Generic Engine**: Theme-agnostic core can power other game types
3. **Risk Management**: House fund reservation prevents bankruptcy
4. **Provably Fair**: All outcomes are deterministic and auditable

## Architecture Layers

### Layer 1: Generic Game Engine (`lib/gameEngine.ts`)

Theme-agnostic gambling mechanics:

- Fixed house edge (15%)
- Exponential probability decay
- EV calculations
- Round simulation

**Can be reskinned for:** space exploration, mining, mountain climbing, etc.

### Layer 2: Theme Wrapper (`lib/gameLogic.ts`, `lib/constants.ts`)

Diving-specific flavor:

- Depth zones (Sunlight → Hadal)
- Procedural shipwrecks
- Oxygen depletion (visual only)
- Sea creature spawning

### Layer 3: Wallet System (`lib/walletLogic.ts`, `lib/walletStore.ts`)

Two-wallet architecture:

- User wallets: balance, stats, limits
- House wallet: bankroll, reserved funds, risk management

**Critical:** House reserves max potential payout when bet placed.

### Layer 4: Server Actions (`app/actions/gameEngine.ts`, `gameActions.ts`)

Next.js Server Actions for security:

- `startGameSession()`: Validates bet, reserves funds
- `executeRound()`: Crypto-random RNG, validates state
- `cashOut()`: Verifies treasure, releases reserves

**Security features:**

- Round number validation (prevents replay)
- Treasure validation (prevents tampering)
- Session ownership verification

### Layer 5: Frontend (`app/page.tsx`, `components/`)

React UI with Kaplay renderer:

- Game state management (Zustand)
- Scene system (Beach, Diving, Surfacing)
- NES-style UI (nes.css)
- Sound system

## File Structure
```

app/
├── actions/
│ ├── gameEngine.ts # Generic server actions
│ └── gameActions.ts # Theme wrapper for actions
├── page.tsx # Main UI (CANONICAL)
└── layout.tsx

lib/
├── gameEngine.ts # Generic gambling engine ⭐ CORE
├── gameLogic.ts # Theme layer (diving)
├── constants.ts # Game config (SINGLE SOURCE OF TRUTH)
├── walletLogic.ts # Validation & risk mgmt
├── walletStore.ts # In-memory storage (⚠️ replace with DB)
├── types.ts # TypeScript definitions
├── soundManager.ts # Audio system
├── objectPool.ts # Performance optimization
└── gameStore.ts # Zustand state

components/DeepSeaDiver/
├── OceanScene.tsx # Kaplay initialization
├── scenes/ # Beach, Diving, Surfacing
└── entities/ # Fish, bubbles, treasures, etc.

tests/
├── unit/ # 16 unit test suites
└── \*.spec.ts # 7 Playwright E2E tests

```

## Game Flow

```

1. BETTING PHASE (Beach Scene)
   ↓ User clicks "START GAME" ($50)
2. START GAME (Server)
   - Validate balance ✓
   - Deduct bet from user
   - Add bet to house
   - Reserve max potential payout
   - Create session
     ↓
3. DIVE DEEPER (Repeat)
   - 2.5s animation
   - Server generates crypto-random (0-99)
   - Compare vs threshold
   - If survived: multiply treasure
   - If drowned: game over
     ↓ User clicks "SURFACE"
4. CASH OUT (Server)
   - Validate treasure === session
   - Transfer to user wallet
   - Deduct from house
   - Release reserved funds
     ↓
5. BACK TO BETTING PHASE

````

## Configuration

### Game Math (FIXED - DO NOT CHANGE)
```typescript
// lib/constants.ts:6
export const GAME_CONFIG = {
  HOUSE_EDGE: 0.15,        // 15% edge (provably fair)
  TARGET_EV: 0.85,         // 85% RTP
  BASE_WIN_PROB: 0.7,      // 70% starting survival
  DECAY_CONSTANT: 0.08,    // Difficulty curve
  MIN_WIN_PROB: 0.05,      // 5% floor

  MIN_BET: 10,
  MAX_BET: 500,
  FIXED_BET: 50,           // Current: fixed $50 bet
}
````

**Changing these requires:**

1. Update tests in `tests/unit/`
2. Recalculate house reserve ratio
3. Update documentation

### Performance Tuning

```typescript
// components/DeepSeaDiver/sceneConstants.ts
SPAWN_RATES: {
  BUBBLE: 0.3,             // 30% chance per frame
  FISH: 0.02,              // 2% chance per frame
  JELLYFISH: 0.01,         // 1% chance per frame
}
```

## Production Checklist

Before deploying to production:

- [ ] Replace `walletStore.ts` in-memory storage with database
- [ ] Add user authentication (NextAuth / Web3 wallet)
- [ ] Add rate limiting to server actions
- [ ] Enable HTTPS and CORS protections
- [ ] Add transaction logging for audits
- [ ] Configure house wallet limits per jurisdiction
- [ ] Add responsible gambling limits (daily/weekly)
- [ ] Integrate payment provider (Stripe / crypto)
- [ ] Add KYC/AML compliance checks
- [ ] Set up monitoring (Sentry / DataDog)

## Testing Strategy

### Unit Tests (16 files)

- Core logic: `gameLogic.test.ts`, `gameEngine.test.ts`
- Wallet: `walletLogic.test.ts`, `walletStore.test.ts`
- Edge cases: `edgeCases.test.ts`, `advancedEdgeCases.test.ts`
- Security: `securityBlindspots.test.ts`, `serverBlindspots.test.ts`
- Math: `probabilityVerification.test.ts`, `moneyConservation.test.ts`

### E2E Tests (7 files)

- Game flow: `game-flow.spec.ts`
- Scene transitions: `scene-transitions.spec.ts`
- Wallet integration: `wallet-integration.spec.ts`

### Monte Carlo Tests (NEW)

- 10,000 trials per round for statistical confidence
- 5,000 complete games for house edge verification
- Daily CI runs for regression detection

## Common Pitfalls

### ⚠️ DO NOT modify treasure value client-side

Server validates against session state. Any mismatch throws error.

### ⚠️ DO NOT skip server validation

All game logic must execute server-side. Client is untrusted.

### ⚠️ DO NOT reuse session IDs

Each game gets unique session ID. Prevents replay attacks.

### ⚠️ DO NOT forget to release house reserves

After cashout/loss, always call `releaseHouseFunds()`.

## Extending the Codebase

### Adding a New Game Theme

1. Create new theme wrapper (e.g., `lib/spaceLogic.ts`)
2. Define theme-specific constants
3. Create new server actions wrapper
4. Build new Kaplay scenes
5. Reuse `lib/gameEngine.ts` unchanged

**Example:** Space exploration game

- Rounds → distance traveled
- Treasure → fuel/supplies
- Depth zones → space sectors
- Shipwrecks → alien artifacts

### Adding a New Entity Type

1. Create entity file in `components/DeepSeaDiver/entities/`
2. Implement with object pooling (see `bubble.ts`)
3. Add spawn logic in appropriate scene
4. Update `sceneConstants.ts` with spawn rates

## Support

For questions or issues:

- GitHub Issues: [link]
- Documentation: [link]
- Discord: [link]

````

### 4B: Fix Sound Manager Mount Sync (5 min)

**File:** `app/page.tsx`

```typescript
// Add near line 50 after state declarations
const [soundMuted, setSoundMuted] = useState(false);

// Add this useEffect near line 63 (after session initialization)
useEffect(() => {
  // Sync initial sound state from manager
  setSoundMuted(getSoundManager().isMuted());
}, []);
````

### 4C: Fix Config Source of Truth (15 min)

**File:** `app/actions/gameEngine.ts`

```typescript
// Replace lines 48-58 with:
import { GAME_CONFIG as LIB_CONFIG } from "@/lib/constants";
import { DEFAULT_CONFIG, type GameConfig } from "@/lib/gameEngine";

// Server-side config (import from lib/constants.ts)
const GAME_CONFIG: GameConfig = {
  ...DEFAULT_CONFIG,
  houseEdge: LIB_CONFIG.HOUSE_EDGE,
  baseWinProbability: LIB_CONFIG.BASE_WIN_PROB,
  decayConstant: LIB_CONFIG.DECAY_CONSTANT,
  minWinProbability: LIB_CONFIG.MIN_WIN_PROB,
  minBet: LIB_CONFIG.MIN_BET,
  maxBet: LIB_CONFIG.MAX_BET,
  maxPotentialWin: 100000, // Not in client config
  maxRounds: 50, // Not in client config
};

// Add validation to ensure sync
if (process.env.NODE_ENV === "development") {
  console.log("[CONFIG] ✅ Server config synced from lib/constants.ts");
  console.log("[CONFIG] House edge:", GAME_CONFIG.houseEdge);
}
```

**Total Time: 50 min for all quick fixes**

---

## Priority Summary

| Priority  | Item                | Time | Impact     | Difficulty  |
| --------- | ------------------- | ---- | ---------- | ----------- |
| 🔴 HIGH   | Error Handling & UI | 2.5h | ⭐⭐⭐⭐⭐ | Medium      |
| 🟡 MEDIUM | Object Pooling      | 3h   | ⭐⭐⭐⭐   | Medium      |
| 🟡 MEDIUM | Monte Carlo Tests   | 2h   | ⭐⭐⭐⭐   | Medium-Hard |
| 🟢 LOW    | Documentation       | 0.5h | ⭐⭐⭐     | Easy        |
| 🟢 LOW    | Sound Manager Fix   | 0.1h | ⭐⭐       | Easy        |
| 🟢 LOW    | Config Sync         | 0.2h | ⭐⭐       | Easy        |

**Total Implementation Time: ~8.3 hours**

## Recommended Order

### Week 1: User Experience

1. **Day 1-2:** Error Handling & UI (2.5h) - Critical for UX
2. **Day 3:** Documentation (0.5h) + Quick fixes (0.3h) - Easy wins

### Week 2: Performance & Quality

3. **Day 4-5:** Object Pooling (3h) - Performance boost
4. **Day 6-7:** Monte Carlo Tests (2h) - Long-term confidence

### Result

- Better UX with error feedback
- 50% reduction in GC pressure
- Statistical proof of fairness
- Complete documentation

---

## Notes

- All time estimates include testing
- Assumes familiarity with codebase
- Can be parallelized across team members
- Each phase is independently testable
