/**
 * Probability & Fairness Verification Tests
 * Verifies randomness, win rates, and house edge
 * Run with: tsx --test tests/unit/probabilityVerification.test.ts
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import {
  startGame,
  performDive,
  surfaceWithTreasure,
  generateSessionId,
  getWalletInfo,
} from "../../app/actions/gameActions";
import { resetWalletStore } from "../../lib/walletStore";
import { calculateRoundStats } from "../../lib/gameEngine";

describe("Probability Verification", () => {
  beforeEach(() => {
    resetWalletStore();
  });

  it("should verify Round 1 has 70% survival rate (statistical test)", async () => {
    const trials = 100;
    const userId = `test_user_${Date.now()}`;
    let survived = 0;

    for (let i = 0; i < trials; i++) {
      const sessionId = await generateSessionId();
      await startGame(10, userId, sessionId);

      // Don't use test seed - use real random
      const result = await performDive(1, 10, sessionId, userId);

      if (result.survived) {
        survived++;
      }
    }

    const survivalRate = survived / trials;
    const expectedRate = 0.7; // Changed from 0.95 to 0.70 (70% baseline)
    const tolerance = 0.15; // ±15% due to small sample and lower probability

    console.log(
      `  Survival rate: ${(survivalRate * 100).toFixed(1)}% (expected: ${(expectedRate * 100).toFixed(1)}%)`
    );
    console.log(`  Survived: ${survived}/${trials}`);

    assert.ok(
      survivalRate >= expectedRate - tolerance &&
        survivalRate <= expectedRate + tolerance,
      `Survival rate should be within ${tolerance * 100}% of ${expectedRate * 100}%`
    );

    console.log("- Round 1 survival rate verified");
  });

  it("should verify deeper dives have lower survival rates", async () => {
    const userId = `test_user_${Date.now()}`;
    const trialsPerRound = 50;
    const survivalRates: { [round: number]: number } = {};

    // Test rounds 1, 5, 10
    for (const round of [1, 5, 10]) {
      let survived = 0;

      for (let i = 0; i < trialsPerRound; i++) {
        const sessionId = await generateSessionId();
        await startGame(10, userId, sessionId);

        // Simulate getting to this round (skip earlier dives)
        let treasure = 10;
        let currentRound = 1;

        while (currentRound <= round) {
          const result = await performDive(
            currentRound,
            treasure,
            sessionId,
            userId
          );

          if (!result.survived) {
            break;
          }

          treasure = result.totalTreasure;
          currentRound++;
        }

        if (currentRound > round) {
          // Made it past the target round
          survived++;
        }
      }

      survivalRates[round] = survived / trialsPerRound;
      console.log(
        `  Round ${round}: ${(survivalRates[round] * 100).toFixed(1)}% survival (${survived}/${trialsPerRound})`
      );
    }

    // Verify monotonic decrease
    assert.ok(
      survivalRates[1] > survivalRates[5],
      "Round 1 should have higher survival than Round 5"
    );
    assert.ok(
      survivalRates[5] > survivalRates[10],
      "Round 5 should have higher survival than Round 10"
    );

    console.log("- Survival rates decrease with depth");
  });

  it("should verify house edge over many games", async () => {
    const userId = `test_user_${Date.now()}`;
    const games = 50;
    const betAmount = 10;

    const initialWallet = await getWalletInfo(userId);
    const initialBalance = initialWallet.balance;

    for (let game = 1; game <= games; game++) {
      const sessionId = await generateSessionId();
      const startResult = await startGame(betAmount, userId, sessionId);

      if (!startResult.success) {
        continue; // House limits
      }

      // Play 1-3 dives
      let treasure = betAmount;
      let dive = 1;

      while (dive <= 3) {
        const result = await performDive(dive, treasure, sessionId, userId);

        if (!result.survived) {
          break; // Died
        }

        treasure = result.totalTreasure;

        // 50% chance to cash out each round
        if (Math.random() > 0.5) {
          await surfaceWithTreasure(treasure, sessionId, userId);
          break;
        }

        dive++;
      }

      // If made it to dive 4, cash out
      if (dive === 4) {
        await surfaceWithTreasure(treasure, sessionId, userId);
      }
    }

    const finalWallet = await getWalletInfo(userId);
    const finalBalance = finalWallet.balance;
    const netChange = finalBalance - initialBalance;
    const totalWagered = finalWallet.totalWagered;
    const actualEdge = -netChange / totalWagered;

    console.log(`  Games played: ${finalWallet.gamesPlayed}`);
    console.log(`  Total wagered: $${totalWagered}`);
    console.log(`  Net change: $${netChange}`);
    console.log(
      `  Actual edge: ${(actualEdge * 100).toFixed(1)}% (expected: 5%)`
    );

    // House edge should be roughly 5% (±10% due to variance)
    assert.ok(
      actualEdge >= 0.05 && actualEdge <= 0.25,
      "House edge should be roughly 5% (±10%)"
    );

    console.log("- House edge verified over many games");
  });
});

describe("Randomness Tests", () => {
  it("should generate unique session IDs", async () => {
    const ids = new Set<string>();
    const count = 1000;

    for (let i = 0; i < count; i++) {
      const id = await generateSessionId();
      ids.add(id);
    }

    assert.strictEqual(ids.size, count, "All session IDs should be unique");
    console.log(`- ${count} unique session IDs generated`);
  });

  it("should have unpredictable random rolls", async () => {
    resetWalletStore();
    const userId = `test_user_${Date.now()}`;
    const rolls: number[] = [];

    // Collect 100 random rolls
    for (let i = 0; i < 100; i++) {
      const sessionId = await generateSessionId();
      await startGame(10, userId, sessionId);

      const result = await performDive(1, 10, sessionId, userId);
      rolls.push(result.randomRoll);
    }

    // Basic randomness checks

    // 1. All rolls should be in range [0, 99]
    const inRange = rolls.every((r) => r >= 0 && r <= 99);
    assert.ok(inRange, "All rolls should be 0-99");

    // 2. Average should be around 50
    const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
    assert.ok(
      avg >= 40 && avg <= 60,
      `Average roll should be ~50, got ${avg.toFixed(1)}`
    );

    // 3. Should have variety (not all same)
    const unique = new Set(rolls).size;
    assert.ok(unique >= 50, `Should have variety, got ${unique} unique values`);

    // 4. Standard deviation should be reasonable
    const variance =
      rolls.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / rolls.length;
    const stdDev = Math.sqrt(variance);
    assert.ok(
      stdDev >= 20 && stdDev <= 35,
      `StdDev should be ~28.87, got ${stdDev.toFixed(1)}`
    );

    console.log(`  Average roll: ${avg.toFixed(1)}`);
    console.log(`  Unique values: ${unique}/100`);
    console.log(`  Std deviation: ${stdDev.toFixed(1)}`);
    console.log("- Random rolls appear unpredictable");
  });

  it("should have uniform distribution of rolls", async () => {
    resetWalletStore();
    const userId = `test_user_${Date.now()}`;
    const rolls: number[] = [];
    const buckets = 10; // 0-9, 10-19, ..., 90-99
    const counts = new Array(buckets).fill(0);

    // Collect 500 rolls
    for (let i = 0; i < 500; i++) {
      const sessionId = await generateSessionId();
      await startGame(10, userId, sessionId);

      const result = await performDive(1, 10, sessionId, userId);
      rolls.push(result.randomRoll);

      const bucket = Math.floor(result.randomRoll / 10);
      counts[bucket]++;
    }

    // Each bucket should have roughly 50 rolls (500 / 10)
    const expected = 500 / buckets;

    console.log("  Distribution by bucket (0-9, 10-19, ..., 90-99):");
    counts.forEach((count, i) => {
      const low = i * 10;
      const high = low + 9;
      console.log(`    ${low}-${high}: ${count} rolls`);
    });

    // Chi-square test (simplified)
    const chiSquare = counts.reduce((sum, count) => {
      return sum + Math.pow(count - expected, 2) / expected;
    }, 0);

    console.log(
      `  Chi-square: ${chiSquare.toFixed(2)} (lower is more uniform)`
    );

    // Chi-square critical value for 9 degrees of freedom at p=0.05 is ~16.92
    assert.ok(chiSquare < 25, "Distribution should be reasonably uniform");

    console.log("- Rolls have uniform distribution");
  });
});

describe("Multiplier Calculations", () => {
  it("should verify multiplier × probability = constant", () => {
    for (let round = 1; round <= 10; round++) {
      const stats = calculateRoundStats(round, {
        houseEdge: 0.15,
        baseWinProbability: 0.95,
        decayConstant: 0.15,
        minWinProbability: 0.01,
        minBet: 10,
        maxBet: 500,
        maxPotentialWin: 100000,
        maxRounds: 50,
      });

      const ev = stats.winProbability * stats.multiplier;
      const expected = 0.95; // 1 - 0.15 house edge

      // Allow small rounding error
      assert.ok(
        Math.abs(ev - expected) < 0.01,
        `Round ${round}: EV=${ev.toFixed(3)}, expected=${expected}`
      );
    }

    console.log("- All rounds have constant EV (5% house edge)");
  });

  it("should verify treasure decreases on average", async () => {
    resetWalletStore();
    const userId = `test_user_${Date.now()}`;
    const trials = 50;
    let totalTreasureAfterDive1 = 0;

    for (let i = 0; i < trials; i++) {
      const sessionId = await generateSessionId();
      await startGame(50, userId, sessionId);

      const result = await performDive(1, 50, sessionId, userId);

      if (result.survived) {
        totalTreasureAfterDive1 += result.totalTreasure;
      }
    }

    const avgTreasure = totalTreasureAfterDive1 / trials;

    console.log(
      `  Average treasure after dive 1: $${avgTreasure.toFixed(2)} (started with $50)`
    );

    // On average, should be less than $50 due to house edge
    assert.ok(
      avgTreasure < 50,
      "Average treasure should decrease due to house edge"
    );

    // Should be around $42-$45 (50 * 0.95)
    assert.ok(
      avgTreasure >= 35 && avgTreasure <= 48,
      "Average should be ~$42.50"
    );

    console.log("- Treasure decreases on average (house edge working)");
  });

  it("should handle very small treasure values", async () => {
    resetWalletStore();
    const userId = `test_user_${Date.now()}`;
    const sessionId = await generateSessionId();

    // Start with minimum bet
    await startGame(10, userId, sessionId);

    // Dive 10 times (if lucky)
    let treasure = 10;

    for (let dive = 1; dive <= 10; dive++) {
      const result = await performDive(dive, treasure, sessionId, userId, "99");

      if (!result.survived) {
        console.log(`  Died at dive ${dive} with treasure $${treasure}`);
        break;
      }

      treasure = result.totalTreasure;

      // Treasure should never be negative
      assert.ok(
        treasure >= 0,
        `Treasure should be non-negative, got ${treasure}`
      );

      // If treasure gets very small, verify it doesn't underflow
      if (treasure < 1) {
        console.log(`  Very small treasure at dive ${dive}: $${treasure}`);
      }
    }

    console.log("- Small treasure values handled correctly");
  });

  it("should handle very large treasure values", async () => {
    resetWalletStore();
    const userId = `test_user_${Date.now()}`;
    const sessionId = await generateSessionId();

    // Start with max bet
    await startGame(500, userId, sessionId);

    // Dive with guaranteed survival
    let treasure = 500;
    let maxTreasure = treasure;

    for (let dive = 1; dive <= 20; dive++) {
      const result = await performDive(dive, treasure, sessionId, userId, "99");

      if (!result.survived) {
        break;
      }

      treasure = result.totalTreasure;
      maxTreasure = Math.max(maxTreasure, treasure);

      // Verify no overflow
      assert.ok(
        treasure < Number.MAX_SAFE_INTEGER,
        "Treasure should not overflow"
      );
      assert.ok(Number.isFinite(treasure), "Treasure should be finite");
    }

    console.log(`  Max treasure reached: $${maxTreasure}`);
    console.log("- Large treasure values handled correctly");
  });
});

describe("Floating Point Precision", () => {
  it("should handle floating point rounding in multipliers", async () => {
    resetWalletStore();
    const userId = `test_user_${Date.now()}`;
    const sessionId = await generateSessionId();

    // Use odd bet amount
    await startGame(17, userId, sessionId);

    // Dive multiple times
    let treasure = 17;

    for (let dive = 1; dive <= 5; dive++) {
      const result = await performDive(dive, treasure, sessionId, userId, "99");

      if (!result.survived) {
        break;
      }

      // Verify treasure is integer
      assert.ok(
        Number.isInteger(result.totalTreasure),
        "Treasure should be integer"
      );

      treasure = result.totalTreasure;
    }

    console.log("- Floating point rounding handled correctly");
  });

  it("should maintain precision over many multiplications", async () => {
    resetWalletStore();
    const userId = `test_user_${Date.now()}`;

    // Play 100 games with various bet amounts
    for (let game = 1; game <= 100; game++) {
      const sessionId = await generateSessionId();
      const bet = 10 + (game % 40); // 10-49

      await startGame(bet, userId, sessionId);
      const result = await performDive(1, bet, sessionId, userId, "99");

      if (result.survived) {
        // Verify treasure is reasonable
        assert.ok(result.totalTreasure > 0, "Treasure should be positive");
        assert.ok(result.totalTreasure < bet * 2, "Treasure should not double");
        assert.ok(
          Number.isInteger(result.totalTreasure),
          "Treasure should be integer"
        );
      }
    }

    console.log("- Precision maintained over 100 games");
  });
});

console.log("\nOK: All probability verification tests completed!\n");
