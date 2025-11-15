# Treasure Initialization & Accumulation Fix

## Summary

Fixed critical bugs related to treasure initialization and accumulation in the deep-sea diving game.

## Bugs Fixed

### 1. **Treasure Starting Value** ✅
**Problem:** Treasure displayed as $50 (betAmount) at game start instead of $0  
**Root Cause:** `currentTreasure` was initialized to `betAmount` in both frontend and backend  
**Solution:** Initialize to 0 in both layers

**Files Changed:**
- `app/page.tsx` line 150: Changed `currentTreasure: betAmount` → `currentTreasure: 0`
- `app/actions/gameEngine.ts` line 106: Changed `currentTreasure: betAmount` → `currentTreasure: 0`

### 2. **First Dive Treasure Calculation** ✅
**Problem:** First dive would calculate `0 * multiplier = 0` (no treasure earned)  
**Root Cause:** Frontend passed `currentTreasure = 0` to server, which multiplied it by the survival multiplier  
**Solution:** Pass `betAmount` when `currentTreasure === 0` (first dive only)

**Files Changed:**
- `app/page.tsx` lines 201-204: Added logic to use `betAmount` when treasure is 0

```typescript
// For first dive, use initialBet as the value to multiply; subsequent dives use accumulated treasure
const valueToMultiply = gameState.currentTreasure === 0 ? gameState.initialBet : gameState.currentTreasure;
const result = await performDive(
  gameState.diveNumber,
  valueToMultiply,
  gameState.sessionId,
  gameState.userId
);
```

### 3. **Wallet Balance Updates** ✅
**Problem:** None found - wallet was updating correctly  
**Verification:** Confirmed wallet updates happen at:
- Game start: Balance decreases by bet amount
- Game loss: No additional change (bet already deducted)
- Game win (surface): Balance increases by treasure amount

## Expected Behavior

### Game Flow Example (Bet: $50)

| Step | Balance | Treasure | Description |
|------|---------|----------|-------------|
| **Start** | $1000 | $0 | Initial state |
| **Bet Placed** | $950 | $0 | Bet deducted, treasure still 0 |
| **Dive 1 (survives)** | $950 | $44 | `$50 * 0.89 = $44` |
| **Dive 2 (survives)** | $950 | $45 | `$44 * 1.04 = $45` |
| **Dive 3 (survives)** | $950 | $54 | `$45 * 1.21 = $54` |
| **Surface** | $1004 | $0 | `$950 + $54 = $1004` |
| **Net Profit** | +$4 | | Lucky! Beat house edge |

### Key Points

1. **Treasure starts at $0** - Player hasn't earned anything yet
2. **First dive uses betAmount** - The "at-risk" value is the original bet
3. **Subsequent dives multiply** - Each dive multiplies current treasure by survival multiplier
4. **House edge is 15%** - On average, treasure decreases each dive, but variance exists
5. **Wallet updates correctly** - Bet deducted at start, winnings added at surface

## Testing

### New Tests Created
Created `tests/unit/treasureInitialization.test.ts` with 8 comprehensive tests:

✅ Should start with treasure = 0 (not betAmount)  
✅ Should calculate first dive treasure correctly (betAmount * multiplier)  
✅ Should accumulate treasure correctly across multiple dives  
✅ Should update wallet balance correctly after surfacing  
✅ Should handle the exact scenario from bug report  
✅ Should verify treasure never starts at betAmount (regression test)  
✅ Should handle currentTreasure = 0 by using betAmount on first dive  
✅ Should fail if we accidentally pass 0 on first dive (demonstrates bug)

### Test Results
```
ℹ tests 8
ℹ pass 8
ℹ fail 0
✅ All treasure initialization tests completed!
```

### Existing Tests
- Server actions tests: 22/25 passing (3 pre-existing failures)
- No regressions introduced

## Architecture Notes

### Multiplier Game, Not Additive
This is a **multiplier-based** game where each dive multiplies your current treasure:

```
Round 1: $50 * 0.89 = $44
Round 2: $44 * 1.04 = $45
Round 3: $45 * 1.21 = $54
```

**NOT** additive:
```
❌ Round 1: $0 + $44 = $44
❌ Round 2: $44 + $45 = $89
```

### Probability Curve
Survival probability decreases exponentially:

| Round | Survival % | Threshold | Multiplier |
|-------|-----------|-----------|------------|
| 1 | 95.0% | >= 5 | 0.89x |
| 2 | 81.8% | >= 18 | 1.04x |
| 3 | 70.4% | >= 30 | 1.21x |
| 5 | 52.1% | >= 48 | 1.63x |
| 10 | 24.6% | >= 75 | 3.45x |

Formula: `P(round) = max(0.01, 0.95 * e^(-0.15 * (round-1)))`

### Fixed Expected Value
The game maintains a **constant 15% house edge** regardless of round:

```
EV = P(win) * multiplier = 0.85 (constant)
```

This is achieved by deriving multiplier from probability:

```typescript
multiplier = (1 - houseEdge) / P(win)
```

## Files Modified

1. **app/page.tsx**
   - Line 150: `currentTreasure: 0` (was `betAmount`)
   - Lines 201-204: Added logic to use `betAmount` on first dive

2. **app/actions/gameEngine.ts**
   - Line 106: `currentTreasure: 0` (was `betAmount`)

3. **tests/unit/treasureInitialization.test.ts** (NEW)
   - 8 comprehensive tests covering all scenarios
   - Regression tests to prevent future bugs

## Before vs After

### Before (Buggy)
```
1. Game starts: Display shows "$50" ❌ (confusing!)
2. First dive: $50 * 0.89 = $44
3. Display updates: "$50" → "$44" ❌ (looks like you lost money!)
```

### After (Fixed)
```
1. Game starts: Display shows "$0" ✅ (clear!)
2. First dive: $50 * 0.89 = $44
3. Display updates: "$0" → "$44" ✅ (you earned treasure!)
```

## Verification

To verify the fix works:

1. **Run tests:**
   ```bash
   npx tsx --test tests/unit/treasureInitialization.test.ts
   ```

2. **Manual testing:**
   - Start game with $50 bet
   - Check treasure displays $0 (not $50)
   - Dive once
   - Check treasure displays ~$44 (50 * 0.89)
   - Check balance is $950 throughout gameplay
   - Surface
   - Check balance is $994 (950 + 44)

## Related Documentation

- `ARCHITECTURE.md` - Game engine architecture
- `SESSION-3-SUMMARY.md` - Previous session summary (had incorrect treasure flow)
- `tests/unit/serverActions.test.ts` - Existing server action tests

## Notes

- The session summary from the previous session incorrectly stated treasure should "accumulate" (add). This is wrong - it's a multiplier game.
- Wallet balance updates were already correct and did not need fixing.
- The fix ensures the display accurately reflects the game state at all times.
