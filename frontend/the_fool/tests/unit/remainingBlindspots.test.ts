/**
 * Remaining Blindspot Tests (#5-#8)
 *
 * Tests for data integrity, fairness, and configuration safety
 *
 * Run with: npm test
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  startGameSession,
  executeRound,
  cashOut,
} from "../../app/actions/gameEngine";
import {
  startGame,
  performDive,
  surfaceWithTreasure,
  getTransactionHistory,
  getWalletInfo,
} from "../../app/actions/gameActions";
import {
  calculateRoundStats,
  simulateRound,
  DEFAULT_CONFIG,
  type GameConfig,
} from "../../lib/gameEngine";

describe("Blindspot #5: Session ID Reuse Safety", () => {
  it("should handle reusing same sessionId after game end without state leakage", async () => {
    const userId = "user-session-reuse";
    const sessionId = "reused-session-id";

    console.log("\n🔄 Session Reuse Test:");
    console.log("=".repeat(60));

    // Game 1: Start, one round, cash out
    console.log("  Game 1:");
    const start1 = await startGameSession(100, userId, sessionId);
    assert.equal(start1.success, true);

    const round1 = await executeRound(1, 100, sessionId, userId, "50");
    assert.equal(round1.survived, true);
    console.log(`    Round 1: $${round1.totalValue}`);

    const cashOut1 = await cashOut(round1.totalValue, sessionId, userId);
    assert.equal(cashOut1.success, true);
    console.log(`    Cashed out: $${cashOut1.finalAmount}`);

    // Game 2: Reuse same sessionId
    console.log("  Game 2 (reusing sessionId):");
    const start2 = await startGameSession(100, userId, sessionId);
    assert.equal(start2.success, true);

    const round2 = await executeRound(1, 100, sessionId, userId, "50");
    assert.equal(round2.survived, true);
    console.log(`    Round 1: $${round2.totalValue}`);

    const cashOut2 = await cashOut(round2.totalValue, sessionId, userId);
    assert.equal(cashOut2.success, true);
    console.log(`    Cashed out: $${cashOut2.finalAmount}`);

    console.log("");
    console.log("✅ Session reuse handled cleanly");
    console.log("   → No state leakage between games");
    console.log("   → Each game started fresh");
    console.log("=".repeat(60));

    // Both games should work independently
    assert.ok(cashOut1.finalAmount > 0);
    assert.ok(cashOut2.finalAmount > 0);
  });

  it("should not leak treasure value between sessions", async () => {
    const userId = "user-no-treasure-leak";
    const sessionId = "session-no-treasure-leak";

    // Game 1: Win big
    const start1 = await startGameSession(100, userId, sessionId);
    assert.equal(start1.success, true);

    let currentValue = 100;
    for (let round = 1; round <= 5; round++) {
      const result = await executeRound(
        round,
        currentValue,
        sessionId,
        userId,
        "50"
      );
      if (!result.survived) break;
      currentValue = result.totalValue;
    }

    await cashOut(currentValue, sessionId, userId);

    // Game 2: Start fresh with same sessionId
    const start2 = await startGameSession(100, userId, sessionId);
    assert.equal(start2.success, true);

    // Should start at 100, NOT at the previous game's treasure
    const round1 = await executeRound(1, 100, sessionId, userId, "50");
    assert.equal(round1.survived, true);

    // Trying to use old treasure value should fail
    await assert.rejects(
      () => executeRound(2, currentValue, sessionId, userId, "50"),
      /current value mismatch/i
    );

    console.log("✅ No treasure leakage between sessions");
  });
});

describe("Blindspot #6: Randomness Boundary Behavior", () => {
  it("should have consistent behavior at exact survival threshold", () => {
    const round = 5;
    const config = {
      ...DEFAULT_CONFIG,
      houseEdge: 0.15,
      baseWinProbability: 0.95,
    };

    const stats = calculateRoundStats(round, config);
    const threshold = stats.threshold;

    console.log("\n🎲 Boundary Behavior Test:");
    console.log("=".repeat(60));
    console.log(`  Round: ${round}`);
    console.log(
      `  Win probability: ${(stats.winProbability * 100).toFixed(1)}%`
    );
    console.log(`  Threshold: ${threshold}`);
    console.log("");

    // Test rolls around the boundary
    const justBelow = simulateRound(round, 100, threshold - 1, config);
    const exactBoundary = simulateRound(round, 100, threshold, config);
    const justAbove = simulateRound(round, 100, threshold + 1, config);

    console.log(
      `  Roll ${threshold - 1} (below): ${justBelow.survived ? "SURVIVED" : "LOST"}`
    );
    console.log(
      `  Roll ${threshold} (exact): ${exactBoundary.survived ? "SURVIVED" : "LOST"}`
    );
    console.log(
      `  Roll ${threshold + 1} (above): ${justAbove.survived ? "SURVIVED" : "LOST"}`
    );
    console.log("");

    // Document the boundary behavior
    // The rule is: roll >= threshold to survive
    assert.equal(justBelow.survived, false, "Roll below threshold should lose");
    assert.equal(
      exactBoundary.survived,
      true,
      "Roll at exact threshold should survive (>=)"
    );
    assert.equal(
      justAbove.survived,
      true,
      "Roll above threshold should survive"
    );

    console.log("✅ Boundary behavior is consistent");
    console.log("   Rule: survive if roll >= threshold");
    console.log("=".repeat(60));
  });

  it("should maintain fairness across all rounds", () => {
    const config = {
      ...DEFAULT_CONFIG,
      houseEdge: 0.15,
      baseWinProbability: 0.95,
    };

    console.log("\n📊 Fairness Verification:");
    console.log("=".repeat(60));

    for (let round = 1; round <= 10; round++) {
      const stats = calculateRoundStats(round, config);
      const threshold = stats.threshold;

      // Count how many rolls (0-99) would survive
      let survivalCount = 0;
      for (let roll = 0; roll < 100; roll++) {
        const result = simulateRound(round, 100, roll, config);
        if (result.survived) survivalCount++;
      }

      const actualWinRate = survivalCount / 100;
      const expectedWinRate = stats.winProbability;
      const difference = Math.abs(actualWinRate - expectedWinRate);

      // Should be very close (within 1% due to rounding)
      assert.ok(
        difference < 0.01,
        `Round ${round}: actual ${actualWinRate} vs expected ${expectedWinRate}`
      );

      if (round % 3 === 0) {
        console.log(
          `  Round ${round}: ${(actualWinRate * 100).toFixed(1)}% win rate (threshold: ${threshold})`
        );
      }
    }

    console.log("✅ All rounds maintain fair probabilities");
    console.log("=".repeat(60));
  });
});

describe("Blindspot #7: Config Invariant Validation", () => {
  it("should reject invalid config (minWinProbability > baseWinProbability)", () => {
    const badConfig: GameConfig = {
      ...DEFAULT_CONFIG,
      minWinProbability: 0.9,
      baseWinProbability: 0.5, // Invalid: min > base
    };

    console.log("\n⚙️  Config Validation Test:");
    console.log("=".repeat(60));
    console.log("  Testing: minWinProbability > baseWinProbability");

    assert.throws(
      () => calculateRoundStats(1, badConfig),
      /invalid.*config/i,
      "Should reject min > base"
    );

    console.log("✅ Rejected invalid config");
  });

  it("should reject invalid config (maxRounds <= 0)", () => {
    const badConfig: GameConfig = {
      ...DEFAULT_CONFIG,
      maxRounds: 0,
    };

    console.log("  Testing: maxRounds <= 0");

    assert.throws(
      () => calculateRoundStats(1, badConfig),
      /invalid.*config/i,
      "Should reject maxRounds <= 0"
    );

    console.log("✅ Rejected invalid config");
  });

  it("should reject invalid config (decayConstant < 0)", () => {
    const badConfig: GameConfig = {
      ...DEFAULT_CONFIG,
      decayConstant: -0.5,
    };

    console.log("  Testing: decayConstant < 0");

    assert.throws(
      () => calculateRoundStats(1, badConfig),
      /invalid.*config/i,
      "Should reject negative decay"
    );

    console.log("✅ Rejected invalid config");
    console.log("=".repeat(60));
  });

  it("should accept valid config", () => {
    const validConfig: GameConfig = {
      ...DEFAULT_CONFIG,
      houseEdge: 0.15,
      baseWinProbability: 0.95,
      minWinProbability: 0.01,
      decayConstant: 0.15,
      maxRounds: 50,
    };

    // Should not throw
    const stats = calculateRoundStats(1, validConfig);
    assert.ok(stats.winProbability > 0);
    assert.ok(stats.winProbability <= 1);

    console.log("✅ Accepted valid config");
  });
});

describe("Blindspot #8: Transaction Metadata Consistency", () => {
  it("should record correct diveNumber in transaction metadata", async () => {
    const userId = "user-tx-metadata";
    const sessionId = "session-tx-metadata";

    console.log("\n📝 Transaction Metadata Test:");
    console.log("=".repeat(60));

    // Start game
    const start = await startGame(100, userId, sessionId);
    assert.equal(start.success, true);

    // 3 successful dives
    let currentValue = 100;
    console.log("  Performing 3 dives...");
    for (let round = 1; round <= 3; round++) {
      const result = await performDive(
        round,
        currentValue,
        sessionId,
        userId,
        "50"
      );
      assert.equal(result.survived, true);
      currentValue = result.totalTreasure;
      console.log(`    Round ${round}: $${currentValue}`);
    }

    // Cash out
    const cashOutResult = await surfaceWithTreasure(
      currentValue,
      sessionId,
      userId
    );
    assert.equal(cashOutResult.success, true);
    console.log(`  Cashed out: $${cashOutResult.finalAmount}`);

    // Check transaction history
    const txs = await getTransactionHistory(userId, 10);
    const cashoutTx = txs.find((t) => t.type === "cashout");

    assert.ok(cashoutTx, "Should have cashout transaction");
    assert.equal(
      cashoutTx!.metadata?.diveNumber,
      3,
      "Cashout metadata should show diveNumber=3"
    );

    console.log("");
    console.log("✅ Transaction metadata is correct");
    console.log(
      `   Cashout recorded as dive #${cashoutTx!.metadata?.diveNumber}`
    );
    console.log("=".repeat(60));
  });

  it("should record metadata for loss transactions", async () => {
    const userId = "user-loss-metadata";
    const sessionId = "session-loss-metadata";

    const start = await startGame(100, userId, sessionId);
    assert.equal(start.success, true);

    // Win first round
    const round1 = await performDive(1, 100, sessionId, userId, "50");
    assert.equal(round1.survived, true);

    // Lose second round (high seed = loss)
    const round2 = await performDive(
      2,
      round1.totalTreasure,
      sessionId,
      userId,
      "99"
    );
    assert.equal(round2.survived, false);

    // Check loss transaction
    const txs = await getTransactionHistory(userId, 10);
    const lossTx = txs.find((t) => t.type === "loss");

    assert.ok(lossTx, "Should have loss transaction");
    assert.equal(
      lossTx!.metadata?.roundNumber,
      2,
      "Loss should be recorded at round 2"
    );
    assert.equal(
      lossTx!.metadata?.survived,
      false,
      "Loss metadata should show survived=false"
    );

    console.log("✅ Loss transaction metadata is correct");
  });

  it("should maintain consistent diveNumber across multiple games", async () => {
    const userId = "user-multi-game-metadata";

    // Game 1
    const session1 = "session-multi-1";
    await startGame(100, userId, session1);
    const round1 = await performDive(1, 100, session1, userId, "50");
    await surfaceWithTreasure(round1.totalTreasure, session1, userId);

    // Game 2
    const session2 = "session-multi-2";
    await startGame(100, userId, session2);
    const round2a = await performDive(1, 100, session2, userId, "50");
    const round2b = await performDive(
      2,
      round2a.totalTreasure,
      session2,
      userId,
      "50"
    );
    await surfaceWithTreasure(round2b.totalTreasure, session2, userId);

    // Check transactions
    const txs = await getTransactionHistory(userId, 10);
    const cashouts = txs.filter((t) => t.type === "cashout");

    assert.equal(cashouts.length, 2, "Should have 2 cashout transactions");

    // Each game's cashout should reflect its own dive count
    const game1Cashout = cashouts.find((t) => t.gameSessionId === session1);
    const game2Cashout = cashouts.find((t) => t.gameSessionId === session2);

    assert.equal(game1Cashout!.metadata?.diveNumber, 1, "Game 1 had 1 dive");
    assert.equal(game2Cashout!.metadata?.diveNumber, 2, "Game 2 had 2 dives");

    console.log("✅ Each game tracks dives independently");
  });
});
