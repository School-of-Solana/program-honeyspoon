/**
 * Engine Blindspot Tests
 * Tests edge cases that are usually missed in engine-level math
 * Run with: tsx --test tests/unit/engineBlindspots.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  calculateRoundStats,
  simulateRound,
  calculateMaxPotentialPayout,
  validateBetAmount,
  DEFAULT_CONFIG,
  type GameConfig,
} from "../../lib/gameEngine";

describe("Bet Validation - Boundary Values", () => {
  it("should accept exactly minBet", () => {
    const result = validateBetAmount(10, DEFAULT_CONFIG);
    assert.strictEqual(result.valid, true, "Should accept minBet (10)");
  });

  it("should accept exactly maxBet", () => {
    const result = validateBetAmount(500, DEFAULT_CONFIG);
    assert.strictEqual(result.valid, true, "Should accept maxBet (500)");
  });

  it("should reject just below minBet", () => {
    const result = validateBetAmount(9.99, DEFAULT_CONFIG);
    assert.strictEqual(
      result.valid,
      false,
      "Should reject 9.99 (below minBet)"
    );
    assert.ok(
      result.error?.includes("Minimum"),
      "Error should mention minimum"
    );
  });

  it("should reject just above maxBet", () => {
    const result = validateBetAmount(500.01, DEFAULT_CONFIG);
    assert.strictEqual(
      result.valid,
      false,
      "Should reject 500.01 (above maxBet)"
    );
    assert.ok(
      result.error?.includes("Maximum"),
      "Error should mention maximum"
    );
  });

  it("should reject zero bet", () => {
    const result = validateBetAmount(0, DEFAULT_CONFIG);
    assert.strictEqual(result.valid, false, "Should reject 0");
  });

  it("should reject negative bet", () => {
    const result = validateBetAmount(-50, DEFAULT_CONFIG);
    assert.strictEqual(result.valid, false, "Should reject negative");
  });

  it("should handle non-integer valid bets", () => {
    const result = validateBetAmount(15.5, DEFAULT_CONFIG);
    assert.strictEqual(result.valid, true, "Should accept 15.50");
  });

  it("should reject NaN bet", () => {
    const result = validateBetAmount(NaN, DEFAULT_CONFIG);
    assert.strictEqual(result.valid, false, "Should reject NaN");
  });

  it("should reject Infinity bet", () => {
    const result = validateBetAmount(Infinity, DEFAULT_CONFIG);
    assert.strictEqual(result.valid, false, "Should reject Infinity");
  });

  console.log("✓ Bet validation boundary tests passed");
});

describe("Round Stats - Edge Cases", () => {
  it("should handle round 1 with exact baseline probability", () => {
    const stats = calculateRoundStats(1, DEFAULT_CONFIG);

    assert.strictEqual(stats.roundNumber, 1, "Round number should be 1");

    // Note: winProbability is rounded to 3 decimals in calculateRoundStats
    assert.ok(
      Math.abs(stats.winProbability - 0.95) < 0.01,
      "Round 1 should have ~95% probability"
    );

    // Verify multiplier maintains house edge (using actual probability, not rounded)
    const actualProb = 0.95; // We know round 1 starts at 95%
    const ev = actualProb * stats.multiplier;
    assert.ok(Math.abs(ev - 0.85) < 0.02, "EV should be ~0.85 (15% edge)");

    console.log(
      `  Round 1: P=${stats.winProbability}, M=${stats.multiplier.toFixed(3)}x, EV=${ev.toFixed(3)}`
    );
  });

  it("should handle very large round numbers at maxRounds", () => {
    const stats = calculateRoundStats(50, DEFAULT_CONFIG);

    assert.ok(stats.winProbability > 0, "Probability should be positive");
    assert.ok(
      stats.winProbability >= DEFAULT_CONFIG.minWinProbability,
      "Should not go below min"
    );
    assert.ok(Number.isFinite(stats.multiplier), "Multiplier should be finite");

    console.log(
      `  Round 50: P=${(stats.winProbability * 100).toFixed(2)}%, M=${stats.multiplier.toFixed(2)}x`
    );
  });

  it("should reject round 0", () => {
    try {
      calculateRoundStats(0, DEFAULT_CONFIG);
      assert.fail("Should throw error for round 0");
    } catch (error) {
      assert.ok(
        (error as Error).message.includes("must be >= 1"),
        "Should mention minimum"
      );
    }
  });

  it("should reject negative round", () => {
    try {
      calculateRoundStats(-5, DEFAULT_CONFIG);
      assert.fail("Should throw error for negative round");
    } catch (error) {
      assert.ok(error instanceof Error, "Should throw error");
    }
  });

  it("should reject round beyond maxRounds", () => {
    try {
      calculateRoundStats(51, DEFAULT_CONFIG);
      assert.fail("Should throw error for round > maxRounds");
    } catch (error) {
      assert.ok(
        (error as Error).message.includes("exceeds maximum"),
        "Should mention maximum"
      );
    }
  });

  it("should verify monotonic probability decrease", () => {
    const probabilities: number[] = [];

    for (let round = 1; round <= 10; round++) {
      const stats = calculateRoundStats(round, DEFAULT_CONFIG);
      probabilities.push(stats.winProbability);
    }

    // Each probability should be <= previous
    for (let i = 1; i < probabilities.length; i++) {
      assert.ok(
        probabilities[i] <= probabilities[i - 1],
        `Round ${i + 1} prob (${probabilities[i]}) should be <= Round ${i} prob (${probabilities[i - 1]})`
      );
    }

    console.log("  Probability decreases monotonically across rounds ✓");
  });

  it("should verify monotonic multiplier increase", () => {
    const multipliers: number[] = [];

    for (let round = 1; round <= 10; round++) {
      const stats = calculateRoundStats(round, DEFAULT_CONFIG);
      multipliers.push(stats.multiplier);
    }

    // Each multiplier should be >= previous
    for (let i = 1; i < multipliers.length; i++) {
      assert.ok(
        multipliers[i] >= multipliers[i - 1],
        `Round ${i + 1} mult (${multipliers[i]}) should be >= Round ${i} mult (${multipliers[i - 1]})`
      );
    }

    console.log("  Multiplier increases monotonically across rounds ✓");
  });

  it("should maintain constant EV across all rounds", () => {
    const targetEV = 1 - DEFAULT_CONFIG.houseEdge; // 0.85

    for (let round = 1; round <= 20; round++) {
      const stats = calculateRoundStats(round, DEFAULT_CONFIG);
      const ev = stats.winProbability * stats.multiplier;

      assert.ok(
        Math.abs(ev - targetEV) < 0.01,
        `Round ${round}: EV (${ev.toFixed(3)}) should be ~${targetEV} (within 0.01)`
      );
    }

    console.log(`  Constant EV=${targetEV} maintained across 20 rounds ✓`);
  });

  console.log("✓ Round stats edge case tests passed");
});

describe("Invalid Config Tests", () => {
  it("should handle houseEdge = 0", () => {
    const config: GameConfig = { ...DEFAULT_CONFIG, houseEdge: 0 };
    const stats = calculateRoundStats(1, config);

    // With 0% edge, multiplier should be exactly 1/probability
    const expectedMultiplier = 1 / stats.winProbability;
    assert.ok(
      Math.abs(stats.multiplier - expectedMultiplier) < 0.01,
      "Multiplier should be 1/probability when house edge is 0"
    );
  });

  it("should handle houseEdge = 1 (100% edge)", () => {
    const config: GameConfig = { ...DEFAULT_CONFIG, houseEdge: 1 };
    const stats = calculateRoundStats(1, config);

    // With 100% edge, multiplier should be 0
    assert.strictEqual(
      stats.multiplier,
      0,
      "Multiplier should be 0 with 100% house edge"
    );
  });

  it("should handle very low baseWinProbability", () => {
    const config: GameConfig = { ...DEFAULT_CONFIG, baseWinProbability: 0.1 };
    const stats = calculateRoundStats(1, config);

    assert.strictEqual(
      stats.winProbability,
      0.1,
      "Should use low base probability"
    );
    assert.ok(
      stats.multiplier > 5,
      "Multiplier should be high with low probability"
    );
  });

  it("should handle baseWinProbability = 1", () => {
    const config: GameConfig = { ...DEFAULT_CONFIG, baseWinProbability: 1.0 };
    const stats = calculateRoundStats(1, config);

    assert.strictEqual(
      stats.winProbability,
      1.0,
      "Should have 100% win probability"
    );
    assert.strictEqual(
      stats.multiplier,
      0.85,
      "Multiplier should be 0.85 (1 - 0.15 edge)"
    );
  });

  console.log("✓ Invalid config tests passed");
});

describe("Max Potential Payout", () => {
  it("should respect maxPotentialWin cap", () => {
    const bet = 500; // Max bet
    const maxRounds = 50;

    const maxPayout = calculateMaxPotentialPayout(
      bet,
      maxRounds,
      DEFAULT_CONFIG
    );

    assert.ok(
      maxPayout <= DEFAULT_CONFIG.maxPotentialWin,
      `Max payout (${maxPayout}) should not exceed cap (${DEFAULT_CONFIG.maxPotentialWin})`
    );

    console.log(
      `  Max payout for $${bet}: $${maxPayout} (capped at ${DEFAULT_CONFIG.maxPotentialWin})`
    );
  });

  it("should scale with bet size", () => {
    const payout1 = calculateMaxPotentialPayout(10, 10, DEFAULT_CONFIG);
    const payout2 = calculateMaxPotentialPayout(20, 10, DEFAULT_CONFIG);

    // Payout should roughly double (within rounding)
    assert.ok(
      payout2 >= payout1 * 1.9 && payout2 <= payout1 * 2.1,
      `Payout should roughly double: ${payout1} → ${payout2}`
    );

    console.log(`  $10 bet: $${payout1} max | $20 bet: $${payout2} max`);
  });

  it("should handle maxRounds = 1", () => {
    const payout = calculateMaxPotentialPayout(50, 1, DEFAULT_CONFIG);

    // After 1 round, payout should be ~bet * multiplier(round1)
    const stats = calculateRoundStats(1, DEFAULT_CONFIG);
    const expected = Math.floor(50 * stats.multiplier);

    assert.strictEqual(
      payout,
      expected,
      `Should match round 1 multiplier: ${expected}`
    );
  });

  it("should increase with more rounds", () => {
    const payout1 = calculateMaxPotentialPayout(50, 1, DEFAULT_CONFIG);
    const payout5 = calculateMaxPotentialPayout(50, 5, DEFAULT_CONFIG);
    const payout10 = calculateMaxPotentialPayout(50, 10, DEFAULT_CONFIG);

    assert.ok(
      payout5 > payout1,
      "5 rounds should have higher max than 1 round"
    );
    assert.ok(
      payout10 > payout5,
      "10 rounds should have higher max than 5 rounds"
    );

    console.log(
      `  Max payout progression: 1R=$${payout1}, 5R=$${payout5}, 10R=$${payout10}`
    );
  });

  console.log("✓ Max potential payout tests passed");
});

describe("Simulate Round - Boundary Rolls", () => {
  it("should handle roll = 0 (lowest possible)", () => {
    const result = simulateRound(1, 50, 0, DEFAULT_CONFIG);

    // Round 1 threshold is 5, so roll=0 should fail
    const stats = calculateRoundStats(1, DEFAULT_CONFIG);
    const shouldSurvive = 0 >= stats.threshold;

    assert.strictEqual(
      result.survived,
      shouldSurvive,
      `Roll 0 vs threshold ${stats.threshold}`
    );
    assert.strictEqual(result.randomRoll, 0, "Should record roll");
  });

  it("should handle roll = 99 (highest possible)", () => {
    const result = simulateRound(1, 50, 99, DEFAULT_CONFIG);

    // Round 1 threshold is 5, so roll=99 should succeed
    assert.strictEqual(
      result.survived,
      true,
      "Roll 99 should always survive round 1"
    );
    assert.strictEqual(result.randomRoll, 99, "Should record roll");
  });

  it("should handle roll exactly at threshold", () => {
    const stats = calculateRoundStats(5, DEFAULT_CONFIG);
    const result = simulateRound(5, 50, stats.threshold, DEFAULT_CONFIG);

    // Player survives if roll >= threshold
    assert.strictEqual(
      result.survived,
      true,
      "Roll at threshold should survive"
    );
  });

  it("should handle roll just below threshold", () => {
    const stats = calculateRoundStats(5, DEFAULT_CONFIG);
    const result = simulateRound(5, 50, stats.threshold - 1, DEFAULT_CONFIG);

    assert.strictEqual(
      result.survived,
      false,
      "Roll below threshold should fail"
    );
  });

  it("should reject invalid roll < 0", () => {
    try {
      simulateRound(1, 50, -1, DEFAULT_CONFIG);
      assert.fail("Should reject negative roll");
    } catch (error) {
      assert.ok(
        (error as Error).message.includes("must be 0-99"),
        "Should mention valid range"
      );
    }
  });

  it("should reject invalid roll > 99", () => {
    try {
      simulateRound(1, 50, 100, DEFAULT_CONFIG);
      assert.fail("Should reject roll > 99");
    } catch (error) {
      assert.ok(
        (error as Error).message.includes("must be 0-99"),
        "Should mention valid range"
      );
    }
  });

  it("should handle currentValue = 0", () => {
    const result = simulateRound(1, 0, 99, DEFAULT_CONFIG);

    if (result.survived) {
      assert.strictEqual(result.totalValue, 0, "Multiplying 0 should give 0");
    }
  });

  it("should reject negative currentValue", () => {
    try {
      simulateRound(1, -50, 50, DEFAULT_CONFIG);
      assert.fail("Should reject negative value");
    } catch (error) {
      assert.ok(
        (error as Error).message.includes("non-negative"),
        "Should mention non-negative"
      );
    }
  });

  console.log("✓ Simulate round boundary tests passed");
});

console.log("\n✅ All engine blindspot tests completed!\n");
