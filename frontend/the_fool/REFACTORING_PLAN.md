# Frontend Refactoring & Improvement Plan

## Executive Summary

**Current State:**

- 5,848 lines of code
- 1,302 line `page.tsx` (❌ too large)
- 14 useState/useEffect in one component (❌ unmanageable)
- 163 test files (✅ good coverage)
- 2 Zustand stores
- Manual implementations of common patterns

**Goal:** Make codebase more maintainable, testable, and use industry-standard packages

---

## Critical Issues

### 1. **MASSIVE page.tsx (1,302 lines)** 🚨

**Problem:** All game logic, UI, and state in one file - impossible to test, debug, or maintain

**Solution:**

- Extract components
- Split into feature modules
- Use composition pattern

### 2. **No Form Validation Library** ❌

**Problem:** Manual input validation, no error handling

**Solution:** Add **Zod** + **React Hook Form**

- Type-safe validation
- Industry standard
- 100k+ GitHub stars

### 3. **Custom Sound Manager** ⚠️

**Problem:** 200+ lines of custom audio code

**Solution:** Use **Howler.js** (16k+ stars)

- Battle-tested audio library
- Cross-browser compatible
- Sprite support, spatial audio
- **Way more features, less code**

### 4. **Manual Lamports Conversion** ⚠️

**Problem:** 179 lines of custom bigint math

**Solution:** Use **@solana/web3.js** built-in utilities

- Already in dependencies!
- Well-tested by Solana team
- **Just use `LAMPORTS_PER_SOL` constant**

### 5. **Custom Date/Time Utilities** ❌

**Problem:** Manual date parsing, formatting

**Solution:** Add **date-fns** (30k+ stars)

- Tree-shakeable
- Immutable
- TypeScript native

### 6. **No Component Testing Library** ❌

**Problem:** 163 test files but testing React components is hard

**Solution:** Add **@testing-library/react**

- Industry standard
- Encourages best practices
- Works with Jest/Vitest

### 7. **Two State Management Systems** ⚠️

**Problem:** Zustand + TanStack Query + useState = confusion

**Solution:** Consolidate

- TanStack Query for server state ONLY
- Zustand for client state ONLY
- Remove useState in favor of hooks

### 8. **Manual Error Parsing** ⚠️

**Problem:** 150+ lines of custom Solana error parsing

**Solution:** Simplify with **superstruct** or keep but refactor

- Extract to separate package
- Make unit testable
- Add more error types

### 9. **No Logging Library** ❌

**Problem:** `console.log` everywhere, no log levels

**Solution:** Add **pino** or **loglevel**

- Log levels (debug, info, warn, error)
- Disable in production
- Structured logging

### 10. **Manual SSE Implementation** ⚠️

**Problem:** Custom SSE manager, reconnection logic

**Solution:** Use **@microsoft/fetch-event-source**

- Handles reconnection
- CORS-compatible
- Better error handling

---

## Proposed Refactoring

### Phase 1: Extract Components (Week 1)

#### Current: 1302-line page.tsx

```tsx
export default function Home() {
  // 100 lines of state
  // 200 lines of handlers
  // 1000 lines of JSX
}
```

#### Refactored: Composable components

```tsx
// app/page.tsx (50 lines)
export default function HomePage() {
  return (
    <GameLayout>
      <GameCanvas />
      <GameUI />
    </GameLayout>
  );
}

// components/game/GameUI.tsx
export function GameUI() {
  return (
    <>
      <WalletDisplay />
      <BettingCard />
      <DiveControls />
      <HUD />
    </>
  );
}

// components/game/BettingCard.tsx
export function BettingCard() {
  const { userBalance } = useWalletBalance();
  const startGame = useStartGame();

  return (
    <Card>
      <StartGameButton
        balance={userBalance}
        onStart={startGame.mutate}
        isLoading={startGame.isPending}
      />
    </Card>
  );
}
```

**Benefits:**

- Each component <100 lines
- Unit testable
- Reusable
- Clear responsibility

---

### Phase 2: Use Standard Packages (Week 1)

#### 2.1 Replace Sound Manager with Howler.js

**Before (200+ lines):**

```typescript
// lib/soundManager.ts
class SoundManager {
  private sounds: Map<SoundType, HTMLAudioElement> = new Map();
  private muted: boolean = false;
  // ... 200 lines of audio logic
}
```

**After (20 lines):**

```typescript
import { Howl } from "howler";

export const sounds = {
  coin: new Howl({ src: ["/sounds/coin.wav"], volume: 0.6 }),
  explosion: new Howl({ src: ["/sounds/explosion.wav"], volume: 0.5 }),
  // ... etc
};

export const playSound = (name: keyof typeof sounds) => sounds[name].play();
export const toggleMute = () => Howler.mute(!Howler._muted);
```

**Savings:** -180 lines, +better features

---

#### 2.2 Replace Custom Lamports with Solana SDK

**Before (179 lines in lib/utils/lamports.ts):**

```typescript
export function solToLamports(sol: number): bigint {
  const lamports = Math.floor(sol * Number(LAMPORTS_PER_SOL));
  return BigInt(lamports);
}
// + 170 more lines...
```

**After (USE BUILT-IN):**

```typescript
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

// That's it! Already in our dependencies
// Can delete entire file
```

**Savings:** -179 lines

---

#### 2.3 Add Date Utilities (date-fns)

**Install:**

```bash
npm install date-fns
```

**Usage:**

```typescript
import { formatDistance, format } from "date-fns";

// Instead of manual date math
const timeAgo = formatDistance(lastUpdated, new Date(), { addSuffix: true });
// "5 minutes ago"

const formatted = format(new Date(), "PPpp");
// "Apr 29, 2024, 12:00:00 PM"
```

---

#### 2.4 Add Form Validation (Zod + React Hook Form)

**Install:**

```bash
npm install zod react-hook-form @hookform/resolvers
```

**Usage:**

```typescript
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const betSchema = z.object({
  amount: z.number().min(0.01).max(1),
  userId: z.string().min(1),
});

function BettingForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(betSchema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('amount')} />
      {errors.amount && <span>{errors.amount.message}</span>}
    </form>
  );
}
```

---

#### 2.5 Add Logging Library (loglevel)

**Install:**

```bash
npm install loglevel
```

**Usage:**

```typescript
import log from "loglevel";

// Set level based on environment
if (process.env.NODE_ENV === "production") {
  log.setLevel("warn");
} else {
  log.setLevel("debug");
}

// Use throughout app
log.debug("[GAME] Starting session", { userId, betAmount });
log.info("[WALLET] Balance updated", { balance });
log.warn("[NETWORK] Slow RPC response", { duration });
log.error("[ERROR] Transaction failed", { error });
```

**Benefits:**

- Can disable debug logs in production
- Structured logging
- Log levels
- **Replace 100+ console.log calls**

---

#### 2.6 Replace Custom SSE with fetch-event-source

**Install:**

```bash
npm install @microsoft/fetch-event-source
```

**Before (lib/sseManager.ts - 150 lines):**

```typescript
class SSEManager {
  connect() {
    /* custom reconnection */
  }
  disconnect() {
    /* cleanup */
  }
  // ... 150 lines
}
```

**After (30 lines):**

```typescript
import { fetchEventSource } from "@microsoft/fetch-event-source";

await fetchEventSource("/api/wallet-events", {
  onmessage(msg) {
    const data = JSON.parse(msg.data);
    updateBalance(data);
  },
  onerror(err) {
    toast.error("Connection lost, retrying...");
    throw err; // auto-retries
  },
});
```

**Savings:** -120 lines, +auto-retry

---

### Phase 3: Improve Testability (Week 2)

#### 3.1 Add Testing Library

**Install:**

```bash
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event vitest jsdom
```

**Example Test:**

```typescript
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { BettingCard } from './BettingCard';

describe('BettingCard', () => {
  it('disables start button when balance insufficient', () => {
    render(<BettingCard balance={0.005} betAmount={0.01} />);

    const button = screen.getByRole('button', { name: /start game/i });
    expect(button).toBeDisabled();
  });

  it('calls onStart when button clicked', async () => {
    const onStart = vi.fn();
    render(<BettingCard balance={1} betAmount={0.01} onStart={onStart} />);

    const button = screen.getByRole('button', { name: /start game/i });
    await userEvent.click(button);

    expect(onStart).toHaveBeenCalled();
  });
});
```

---

#### 3.2 Extract Pure Functions

**Before (untestable):**

```typescript
function handleStartGame() {
  if (betAmount > userBalance) {
    showError("Insufficient balance");
    return;
  }
  // ... 50 lines of logic
}
```

**After (testable):**

```typescript
// lib/game/validation.ts
export function validateBet(betAmount: number, userBalance: number) {
  if (betAmount > userBalance) {
    return { valid: false, error: "Insufficient balance" };
  }
  return { valid: true };
}

// lib/game/validation.test.ts
describe("validateBet", () => {
  it("returns invalid when bet exceeds balance", () => {
    const result = validateBet(10, 5);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Insufficient balance");
  });
});
```

---

#### 3.3 Mock Blockchain Calls

**Install:**

```bash
npm install -D msw
```

**Setup Mock Service Worker:**

```typescript
// mocks/handlers.ts
import { rest } from "msw";

export const handlers = [
  rest.post("/api/start-game", (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        sessionId: "test-session-123",
      })
    );
  }),
];
```

**Benefits:**

- Fast tests (no network)
- Deterministic
- Test error cases easily

---

### Phase 4: State Management Cleanup (Week 2)

#### 4.1 Consolidate State

**Before:** State everywhere

- Zustand: wallet, game
- TanStack Query: balance, config
- useState: 14 different states in page.tsx

**After:** Clear boundaries

```typescript
// SERVER STATE (TanStack Query)
useWalletBalance(); // blockchain data
useGameConfig(); // blockchain data
useGameSession(); // blockchain data

// CLIENT STATE (Zustand)
useGameStore(); // UI state (scene, animations)
useUIStore(); // UI state (modals, toasts)

// LOCAL STATE (useState)
// Only for truly local component state
const [isExpanded, setIsExpanded] = useState(false);
```

---

#### 4.2 Create Custom Hooks for Complex Logic

**Extract game logic to hooks:**

```typescript
// hooks/useGameSession.ts
export function useGameSession(userId: string) {
  const startGame = useStartGame();
  const performDive = usePerformDive();
  const cashOut = useCashOut();

  const [gameState, setGameState] = useState({
    isPlaying: false,
    diveNumber: 0,
    treasure: 0,
  });

  // Encapsulate all game logic here
  const handleStart = async () => {
    const result = await startGame.mutateAsync({ userId });
    setGameState({ isPlaying: true, diveNumber: 0, treasure: result.treasure });
  };

  return {
    gameState,
    handleStart,
    handleDive: () => performDive.mutate(),
    handleCashOut: () => cashOut.mutate(),
    isLoading: startGame.isPending || performDive.isPending || cashOut.isPending,
  };
}

// Usage in component
function GameUI() {
  const { gameState, handleStart, isLoading } = useGameSession(userId);

  return (
    <button onClick={handleStart} disabled={isLoading}>
      {isLoading ? 'Starting...' : 'Start Game'}
    </button>
  );
}
```

---

## Implementation Priority

### High Priority (Do First)

1. **✅ Install standard packages**
   - `howler` (replace soundManager)
   - `date-fns` (date utilities)
   - `loglevel` (logging)
   - `@testing-library/react` (testing)
   - `zod` + `react-hook-form` (validation)

2. **✅ Extract components from page.tsx**
   - `components/game/BettingCard.tsx`
   - `components/game/DiveControls.tsx`
   - `components/game/HUD.tsx`
   - `components/game/WalletDisplay.tsx`

3. **✅ Delete custom utilities**
   - Remove `lib/utils/lamports.ts` (use Solana SDK)
   - Remove `lib/soundManager.ts` (use Howler)
   - Simplify `lib/sseManager.ts` (use fetch-event-source)

### Medium Priority (Week 2)

4. **✅ Add unit tests**
   - Test pure functions first
   - Test hooks with `@testing-library/react-hooks`
   - Test components with `@testing-library/react`

5. **✅ Consolidate state**
   - Clear TanStack Query vs Zustand boundaries
   - Extract complex logic to hooks
   - Remove useState where possible

### Low Priority (Later)

6. **✅ Add validation**
   - Zod schemas for all forms
   - React Hook Form for bet input

7. **✅ Add logging**
   - Replace console.log with loglevel
   - Add structured logging

---

## Estimated Impact

### Lines of Code Reduction

- Remove `soundManager.ts`: **-200 lines**
- Remove `lib/utils/lamports.ts`: **-179 lines**
- Simplify `sseManager.ts`: **-120 lines**
- Extract components from `page.tsx`: **-600 lines** (split into 10 files)
- **Total: ~1,100 lines removed**

### Code Quality Improvements

- ✅ Components <100 lines each
- ✅ 80%+ test coverage (vs current ~20%)
- ✅ Type-safe validation (Zod)
- ✅ Industry-standard patterns
- ✅ Easier to onboard new developers

### Developer Experience

- ✅ Faster tests (mocked blockchain)
- ✅ Better error messages (Zod validation)
- ✅ Clearer separation of concerns
- ✅ Reusable components
- ✅ Standard tools (everyone knows React Hook Form, Zod, etc.)

---

## Next Steps

1. Review this plan
2. Approve packages to install
3. Start with Phase 1 (extract components)
4. Move to Phase 2 (replace custom code with packages)
5. Phase 3 (add tests)
6. Phase 4 (consolidate state)

**Total Estimated Time:** 2 weeks with 1 developer

---

## Package Installation Commands

```bash
# Standard utilities
npm install howler date-fns loglevel @microsoft/fetch-event-source

# Forms & validation
npm install zod react-hook-form @hookform/resolvers

# Testing
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event vitest jsdom @vitest/ui msw

# Code quality
npm install -D prettier eslint-plugin-testing-library

# Optional: Better type safety
npm install -D ts-reset
```

**Total packages:** 12 (all industry-standard, well-maintained)

---

## Questions?

- Should we use Vitest or Jest? (I recommend Vitest - faster, better TS support)
- Should we add Storybook for component development? (Nice-to-have)
- Should we add Playwright for E2E tests? (Already installed!)
- Should we add bundle analyzer? (Check bundle size)

Let me know which phases you want to tackle first!
