Nice, let’s mine this repo a bit more 👇

---

### 1. Duplicate-but-diverging `Home` implementations

You effectively have **two generations** of `app/page.tsx`:

* Old version: simpler UI, no NES theme, no sound manager, no `GameErrorBoundary`.
* New version: NES styling, sound effects, `GameErrorBoundary`, `animationMessage`, `isInOcean`, etc.

Risk:

* Future changes might be done in one “view” of the repo and not the other (e.g. if someone copies from an old branch / file pack).
* Comments / doc may reference outdated UX.

**Actionable:**
Add a short `ARCHITECTURE.md` note making it explicit which version is canonical, and consider deleting / archiving old variants (e.g. `page.legacy.tsx`) so Repomix dumps don’t look like active duplicates.

---

### 2. Single source of truth for game config

You have:

* Client-side: `GAME_CONFIG` imported from `@/lib/constants` in `app/page.tsx`.
* Server-side: `GAME_CONFIG` defined again inside `app/actions/gameEngine.ts` by spreading `DEFAULT_CONFIG` and overriding values.

If someone tweaks house edge, max bet, or max rounds in one place and not the other, the UI probabilities and server reality can drift.

**Actionable:**

* Move the *final* `GAME_CONFIG` into one place (e.g. `lib/constants.ts`) and:

  * `export const GAME_CONFIG` from there.
  * Have server actions import that instead of redefining.
* Keep `DEFAULT_CONFIG` purely as a base/template, not something that defines the live game.

---

### 3. House funds reservation: the magic “10 rounds”

In `startGameSession`, you reserve house funds for **10 rounds** regardless of `maxRounds`:

````ts
const maxPayout = calculateMaxPotentialPayout(betAmount, 10, GAME_CONFIG); // Reserve for 10 rounds
``` :contentReference[oaicite:4]{index=4}  

But `GAME_CONFIG.maxRounds` is `50`. :contentReference[oaicite:5]{index=5}  

Premises:

- Client can keep diving up to 50 rounds.
- House only reserves for 10 rounds of potential payout.

Conclusion / risk:

- In extreme lucky streaks > 10 rounds, you might pay more than the “reserved” risk budget.
- Even if mathematically rare, this is a code smell: risk assumptions are encoded as magic numbers.

**Actionable options:**

- Either reserve for `GAME_CONFIG.maxRounds`, or
- Make “rounds to reserve for” a config field (e.g. `config.riskReserveRounds`) and document that it’s intentionally lower than `maxRounds`.
- Add a test that simulates many rounds and asserts **house balance never goes negative**, even under extreme luck.

---

### 4. Session lifecycle & client/server mismatch risks

On the server:

- Losing a round: you mark session inactive, release funds, record a loss, **then delete the session**. :contentReference[oaicite:6]{index=6}  
- Cash out: you validate `finalValue === gameSession.currentTreasure`, process win, then mark session inactive and delete it. :contentReference[oaicite:7]{index=7}  

On the client:

- After **loss**, you:
  - Fetch wallet,
  - Generate a **new session ID** via `generateSessionId`,
  - Reset state & show betting card. :contentReference[oaicite:8]{index=8}  
- After **win/surface**, you do the same pattern. :contentReference[oaicite:9]{index=9}  

Findings:

- Flow is logically sound, but **all errors are only logged to `console.error`**; UI doesn’t show a message if e.g.:
  - `cashOut` throws due to `finalValue` mismatch, or
  - `executeRound` throws because session is already inactive (race / double-click).

**Actionable:**

- Introduce a small `uiError` string in state and render a NES-style error toast if server throws.
- Normalise “no active session” failures into a recoverable client path:
  - If `cashOut` fails with “invalid or inactive game session”, auto-reset to betting screen + error message.

---

### 5. Transaction types & magic strings

Server actions write transactions with literal strings:

- `type: 'bet'` in `startGameSession`. :contentReference[oaicite:10]{index=10}  
- `type: 'loss'` in `executeRound`. :contentReference[oaicite:11]{index=11}  
- `type: 'cashout'` in `cashOut`. :contentReference[oaicite:12]{index=12}  

And `getTransactionHistory` just passes through those `type` values. :contentReference[oaicite:13]{index=13}  

Risk:

- Any typo in future code (`"cashOut"`, `"cash-out"`, etc.) silently fragments analytics / UI filtering.

**Actionable:**

- Define a TypeScript union or enum in `walletTypes.ts` (you already have that file) like:

```ts
export type TransactionType = "bet" | "loss" | "cashout" | "deposit" | "withdraw";
````

* Use that in all transaction creation + in `getTransactionHistory` return type.

---

### 6. Better alignment between `validateBetAmount` variations

You currently have two layers:

* Engine-level `validateBetAmount(betAmount, GAME_CONFIG)` in `lib/gameEngine`.
* Actions-level `validateBetAmount(betAmount, userId)` in `gameActions.ts` that:

  * Fetches wallet,
  * Enforces `bet >= 10`,
  * `bet <= wallet.maxBet`,
  * `bet <= wallet.balance`.

And `startGameSession` also calls `validateBet` from `walletLogic` after getting wallets.

So validation stack is:

1. `validateBetAmount` (config only)
2. `validateBet` (wallet + house)
3. Optional frontend `validateBetAmount` wrapper

Findings:

* The **fixed-bet game** currently never calls the actions-level `validateBetAmount` from the UI; it only checks `betAmount > walletBalance` before calling `startGame`.
* Min bet / max bet messages (“Minimum bet is $10”) aren’t surfaced in UI.

**Actionable:**

* For future **variable-bet UI**, make the client always call `validateBetAmount` before `startGame`.
* Bubble up errors as user-facing messages next to the bet input.
* Add tests ensuring:

  * Config min/max bet,
  * User balance,
  * House risk constraints
    all result in consistent messages across layers.

---

### 7. Object pooling & Kaplay entities

You have an `objectPool.ts` in `lib` (likely for performance / GC control).

And a ton of small, frequently-created entities in Kaplay:

* `bubble`, `fish`, `jellyfish`, `predator`, `particles`, etc.

Given Kaplay games often spawn/destroy many small objects per second:

**Actionable:**

* Audit these entity creators to use `objectPool` for high-churn things like bubbles, particles, maybe small fish.
* Add a quick perf-test scene (or dev-only toggle) that stress-spawns entities to look for frame drops.

---

### 8. Sound manager & mute state consistency

In the new `page.tsx`:

* You keep a React `soundMuted` state and mirror it from `getSoundManager().isMuted()` after toggling.
* But initial `soundMuted` is hard-coded `false`, not read from the manager.

So if the sound manager ever persists mute across sessions (or you add that later), UI and internal state might diverge.

**Actionable:**

* On mount, sync from manager:

```ts
useEffect(() => {
  setSoundMuted(getSoundManager().isMuted());
}, []);
```

* Consider making the button the **single source of truth** by having it call a `toggleMute` that returns the new boolean.

---

### 9. Test suite: property-based / statistical checks

You already have very solid coverage:

* `probabilityVerification.test.ts`, `engineBlindspots.test.ts`, `advancedEdgeCases.test.ts`, etc.

Given this is a probabilistic, high-stakes system (house edge, survival probabilities):

**Actionable next step:**

* Add a **Monte Carlo / property-based test** that:

  * Runs e.g. 1e5 simulated rounds with `simulateRound`.
  * Asserts empirical house edge is within some tolerance of configured `houseEdge`.
  * Checks that survival probability monotonically decreases with dive number.

This catches subtle config mistakes (e.g. wrong decay constant) that single-case tests won’t.
