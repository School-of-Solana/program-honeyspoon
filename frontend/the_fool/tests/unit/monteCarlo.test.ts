/**
 * Monte Carlo Statistical Tests
 *
 * Large-scale simulations to verify probability distributions match theory.
 * These tests provide statistical confidence that the game is fair and
 * the probabilities are correct.
 *
 * Run with: npm run test:unit:monte-carlo
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  startGameSession,
  executeRound,
  cashOut,
} from "../../app/actions/gameEngine";
import { resetWalletStore } from "../../lib/walletStore";
import { calculateRoundStats } from "../../lib/gameEngine";
import {
  binomialConfidenceInterval,
  calculateEmpiricalEV,
  verifyEV,
  chiSquaredTest,
} from "./statistics";

/**
 * Helper to generate unique user ID
 */
function generateTestUserId(): string {
  return `monte_carlo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Helper to generate session ID
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

describe("Monte Carlo Statistical Verification", () => {
  it("should verify Round 1 survival rate with 1,000 trials", async () => {
    const trials = 1000;
    let survived = 0;

    console.log(`\n[MONTE CARLO] Running ${trials} trials for Round 1...`);
    const startTime = Date.now();

    for (let i = 0; i < trials; i++) {
      // Reset wallet for each trial to avoid house fund exhaustion
      resetWalletStore();
      const userId = generateTestUserId();
      const sessionId = generateSessionId();
      const startResult = await startGameSession(10, userId, sessionId);

      if (!startResult.success) {
        console.error(`Failed to start session: ${startResult.error}`);
        continue;
      }

      const result = await executeRound(1, 10, sessionId, userId);

      if (result.survived) {
        survived++;
      }

      // Progress indicator every 100 trials
      if ((i + 1) % 100 === 0) {
        console.log(`  Progress: ${i + 1}/${trials} (${survived} survived)`);
      }
    }

    const elapsed = (Date.now() - startTime) / 1000;
    console.log(
      `  Completed in ${elapsed.toFixed(1)}s (${(trials / elapsed).toFixed(0)} trials/sec)`
    );

    // Calculate 95% confidence interval
    const ci = binomialConfidenceInterval(survived, trials, 0.95);
    const expectedRate = 0.7; // 70% survival on round 1 (from BASE_WIN_PROB)

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

    // Extra check: empirical rate should be reasonably close (within 3% for 1000 trials)
    const diff = Math.abs(ci.mean - expectedRate);
    assert.ok(
      diff < 0.03,
      `Empirical rate should be within 3% of expected (diff: ${(diff * 100).toFixed(2)}%)`
    );

    console.log("OK: Round 1 survival rate verified with 1k trials\n");
  });

  it("should verify Round 5 survival rate with 1,000 trials", async () => {
    const trials = 1000;
    let survived = 0;

    console.log(`\n[MONTE CARLO] Running ${trials} trials for Round 5...`);
    const startTime = Date.now();

    for (let i = 0; i < trials; i++) {
      // Reset wallet for each trial
      resetWalletStore();
      const userId = generateTestUserId();
      const sessionId = generateSessionId();
      const startResult = await startGameSession(10, userId, sessionId);

      if (!startResult.success) {
        continue;
      }

      let treasure = 10;

      // Play through rounds 1-5
      for (let round = 1; round <= 5; round++) {
        const result = await executeRound(round, treasure, sessionId, userId);

        if (!result.survived) {
          break;
        }

        treasure = result.totalValue;

        if (round === 5) {
          survived++;
        }
      }

      if ((i + 1) % 100 === 0) {
        console.log(
          `  Progress: ${i + 1}/${trials} (${survived} survived to round 5)`
        );
      }
    }

    const elapsed = (Date.now() - startTime) / 1000;
    console.log(`  Completed in ${elapsed.toFixed(1)}s`);

    const ci = binomialConfidenceInterval(survived, trials, 0.95);

    // Calculate expected cumulative survival probability
    // Based on BASE_WIN_PROB = 0.7, DECAY_CONSTANT = 0.08
    // Cumulative to round 5: ~7.55%
    let expectedRate = 1;
    for (let r = 1; r <= 5; r++) {
      const stats = calculateRoundStats(r);
      expectedRate *= stats.winProbability;
    }

    console.log(`  Empirical survival rate: ${(ci.mean * 100).toFixed(2)}%`);
    console.log(
      `  95% CI: [${(ci.lower * 100).toFixed(2)}%, ${(ci.upper * 100).toFixed(2)}%]`
    );
    console.log(`  Expected: ${(expectedRate * 100).toFixed(2)}%`);

    // With small probability events (7.55%), use relative error tolerance
    // At such low probabilities, variance is very high with 1000 trials
    const relativeError = Math.abs(ci.mean - expectedRate) / expectedRate;
    assert.ok(
      relativeError < 0.6,
      `Relative error should be < 60% for low-probability events (got ${(relativeError * 100).toFixed(1)}%) - this is expected with 1000 trials at 7.55% probability`
    );

    console.log(
      "OK: Round 5 cumulative survival verified (within tolerance for low-probability event)\n"
    );
  });

  it("should verify house edge over 500 games", async () => {
    const games = 500;
    const betAmount = 10;
    const results: Array<{ bet: number; payout: number }> = [];

    console.log(`\n[MONTE CARLO] Running ${games} complete games...`);
    const startTime = Date.now();

    for (let game = 1; game <= games; game++) {
      // Reset wallet for each game
      resetWalletStore();
      const userId = generateTestUserId();
      const sessionId = generateSessionId();
      const startResult = await startGameSession(betAmount, userId, sessionId);

      if (!startResult.success) continue;

      let treasure = betAmount;
      let round = 1;

      // Play random number of rounds (1-10)
      const maxRounds = Math.floor(Math.random() * 10) + 1;

      while (round <= maxRounds) {
        const result = await executeRound(round, treasure, sessionId, userId);

        if (!result.survived) {
          // Lost - record 0 payout
          results.push({ bet: betAmount, payout: 0 });
          break;
        }

        treasure = result.totalValue;

        // Random 50% chance to cash out, or cash out at max rounds
        if (Math.random() > 0.5 || round === maxRounds) {
          await cashOut(treasure, sessionId, userId);
          results.push({ bet: betAmount, payout: treasure });
          break;
        }

        round++;
      }

      if (game % 50 === 0) {
        console.log(`  Progress: ${game}/${games}`);
      }
    }

    const elapsed = (Date.now() - startTime) / 1000;
    console.log(`  Completed in ${elapsed.toFixed(1)}s`);

    // Calculate empirical EV
    const empiricalEV = calculateEmpiricalEV(results);
    const theoreticalEV = 0.95; // 5% house edge

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
    console.log(`  Z-score: ${verification.zScore.toFixed(2)}`);
    console.log(`  95% CI width: ±${(verification.ciWidth * 100).toFixed(2)}%`);

    // Should be within 20% of theoretical (loose bound for 500 games with high variance)
    // Note: With only 500 games and random cash-out strategy, variance is very high
    // Increasing trial count to 5000+ would give more accurate results
    const percentDiff = Math.abs((empiricalEV - theoreticalEV) / theoreticalEV);
    assert.ok(
      percentDiff < 0.2,
      `Empirical EV should be within 20% of theoretical (${(percentDiff * 100).toFixed(2)}% diff) - increase trial count for more precision`
    );

    console.log(
      "OK: House edge verified with 500 games (within 20% tolerance)\n"
    );
  });

  it("should verify survival probability decreases monotonically", async () => {
    const trialsPerRound = 200;
    const rounds = [1, 2, 3, 5, 7, 10];
    const survivalRates: { [round: number]: number } = {};

    console.log(
      `\n[MONTE CARLO] Testing monotonic decrease with ${trialsPerRound} trials per round...`
    );

    for (const targetRound of rounds) {
      let survived = 0;

      for (let i = 0; i < trialsPerRound; i++) {
        // Reset wallet for each trial
        resetWalletStore();
        const userId = generateTestUserId();
        const sessionId = generateSessionId();
        const startResult = await startGameSession(10, userId, sessionId);

        if (!startResult.success) {
          continue;
        }

        let treasure = 10;
        let survivedTarget = false;

        for (let round = 1; round <= targetRound; round++) {
          const result = await executeRound(round, treasure, sessionId, userId);

          if (!result.survived) {
            break;
          }

          if (round === targetRound) {
            survivedTarget = true;
            break;
          }

          treasure = result.totalValue;
        }

        if (survivedTarget) {
          survived++;
        }
      }

      survivalRates[targetRound] = survived / trialsPerRound;
      console.log(
        `  Round ${targetRound.toString().padStart(2)}: ${(survivalRates[targetRound] * 100).toFixed(1)}%`
      );
    }

    // Verify monotonic decrease
    for (let i = 1; i < rounds.length; i++) {
      const prevRound = rounds[i - 1];
      const currRound = rounds[i];

      assert.ok(
        survivalRates[prevRound] >= survivalRates[currRound],
        `Round ${prevRound} (${(survivalRates[prevRound] * 100).toFixed(1)}%) should have >= survival than Round ${currRound} (${(survivalRates[currRound] * 100).toFixed(1)}%)`
      );
    }

    console.log("OK: Monotonic decrease verified\n");
  });

  it("should verify probability distribution with chi-squared test", async () => {
    const trials = 500;
    const maxRound = 10;

    // Count how many trials reached each round
    const roundCounts: number[] = new Array(maxRound + 1).fill(0);

    console.log(
      `\n[MONTE CARLO] Testing distribution with ${trials} trials (chi-squared)...`
    );

    for (let i = 0; i < trials; i++) {
      // Reset wallet for each trial
      resetWalletStore();
      const userId = generateTestUserId();
      const sessionId = generateSessionId();
      const startResult = await startGameSession(10, userId, sessionId);

      if (!startResult.success) {
        continue;
      }

      let treasure = 10;
      let round = 1;

      while (round <= maxRound) {
        roundCounts[round]++;

        const result = await executeRound(round, treasure, sessionId, userId);

        if (!result.survived) {
          break;
        }

        treasure = result.totalValue;
        round++;
      }

      if ((i + 1) % 50 === 0) {
        console.log(`  Progress: ${i + 1}/${trials}`);
      }
    }

    // Calculate expected counts
    const expectedCounts: number[] = [];
    for (let round = 1; round <= maxRound; round++) {
      let cumulativeProb = 1;
      for (let r = 1; r < round; r++) {
        const stats = calculateRoundStats(r);
        cumulativeProb *= stats.winProbability;
      }
      expectedCounts[round] = trials * cumulativeProb;
    }

    console.log("\n  Round | Observed | Expected");
    console.log("  ------|----------|----------");
    for (let round = 1; round <= maxRound; round++) {
      console.log(
        `  ${round.toString().padStart(5)} | ${roundCounts[round].toString().padStart(8)} | ${expectedCounts[round].toFixed(0).padStart(8)}`
      );
    }

    // Chi-squared test
    const test = chiSquaredTest(roundCounts.slice(1), expectedCounts.slice(1));

    console.log(`\n  Chi-squared statistic: ${test.statistic.toFixed(2)}`);
    console.log(`  Degrees of freedom: ${test.degreesOfFreedom}`);
    console.log(`  p-value: ${test.pValue.toFixed(4)}`);
    console.log(`  Passes test (p > 0.05): ${test.passesTest ? "-" : "✗"}`);

    // Note: With only 500 trials, we use a loose threshold
    assert.ok(
      test.pValue > 0.01,
      `Distribution should roughly match (p-value: ${test.pValue.toFixed(4)} should be > 0.01)`
    );

    console.log("OK: Distribution roughly matches expected (chi-squared)\n");
  });
});
