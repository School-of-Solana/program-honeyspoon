/**
 * Round Number + Treasure Validation Tests
 *
 * Tests the critical anti-cheat checks in executeRound:
 * 1. Round number must match server state (checked FIRST)
 * 2. CurrentValue must match expected (checked SECOND)
 *
 * These tests ensure:
 * - All invalid combinations are rejected
 * - Error messages are clear and specific
 * - Validation order is stable (round first, then treasure)
 *
 * Run with: tsx --test tests/unit/roundTreasureValidation.test.ts
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { executeRound, startGameSession } from "../../app/actions/gameEngine";
import { resetWalletStore, getGameSession } from "../../lib/walletStore";

describe("Round + Treasure Validation: Round 1 Scenarios", () => {
  let userId: string;
  let sessionId: string;

  beforeEach(async () => {
    resetWalletStore();
    userId = `test_user_${Date.now()}_${Math.random()}`;
    sessionId = `session_${Date.now()}_${Math.random()}`;
  });

  it("should reject Round 1 with wrong currentValue (too high)", async () => {
    // Arrange: Start session with initialBet = 100
    const initialBet = 100;
    const startResult = await startGameSession(initialBet, userId, sessionId);
    assert.strictEqual(startResult.success, true, "Game should start");

    const session = getGameSession(sessionId);
    assert.ok(session, "Session should exist");
    assert.strictEqual(session!.initialBet, initialBet);
    assert.strictEqual(session!.diveNumber, 1);

    // Act: Call executeRound(1, 200, ...) - wrong currentValue
    const wrongValue = 200;

    // Assert: Error message contains "Treasure mismatch" and specific values
    await assert.rejects(
      async () => executeRound(1, wrongValue, sessionId, userId, "50"),
      (error: Error) => {
        const msg = error.message;

        // Check for "Treasure mismatch" (not "Round mismatch")
        assert.ok(
          msg.includes("Treasure mismatch") ||
            msg.toLowerCase().includes("treasure"),
          `Expected treasure-related error, got: ${msg}`
        );

        // Check for expected value
        assert.ok(
          msg.includes(`${initialBet}`) || msg.includes("$100"),
          `Expected error to mention expected value $${initialBet}, got: ${msg}`
        );

        // Check for received value
        assert.ok(
          msg.includes(`${wrongValue}`) || msg.includes("$200"),
          `Expected error to mention received value $${wrongValue}, got: ${msg}`
        );

        console.log(`✓ Round 1 wrong value rejected: ${msg}`);
        return true;
      },
      "Should throw treasure mismatch error"
    );
  });

  it("should reject Round 1 with wrong currentValue (too low)", async () => {
    // Arrange: Start session with initialBet = 100
    const initialBet = 100;
    await startGameSession(initialBet, userId, sessionId);

    // Act: Call executeRound(1, 50, ...) - wrong currentValue (deflated)
    const wrongValue = 50;

    // Assert: Should reject with treasure mismatch
    await assert.rejects(
      async () => executeRound(1, wrongValue, sessionId, userId, "50"),
      (error: Error) => {
        const msg = error.message;

        assert.ok(
          msg.toLowerCase().includes("treasure") || msg.includes("mismatch"),
          `Expected treasure error, got: ${msg}`
        );

        assert.ok(
          msg.includes(`${initialBet}`) && msg.includes(`${wrongValue}`),
          `Expected error to show both values ($${initialBet} vs $${wrongValue}), got: ${msg}`
        );

        console.log(`✓ Round 1 deflated value rejected: ${msg}`);
        return true;
      }
    );
  });

  it("should accept Round 1 with correct currentValue", async () => {
    // Arrange: Start session with initialBet = 100
    const initialBet = 100;
    await startGameSession(initialBet, userId, sessionId);

    // Act: Call executeRound(1, 100, ...) - correct currentValue
    const result = await executeRound(1, initialBet, sessionId, userId, "50");

    // Assert: Should succeed
    assert.ok(result.success, "Round should execute successfully");
    assert.strictEqual(result.roundNumber, 1, "Should be round 1");

    console.log(
      `✓ Round 1 with correct value accepted: survived=${result.survived}`
    );
  });
});

describe("Round + Treasure Validation: Later Round Scenarios", () => {
  let userId: string;
  let sessionId: string;

  beforeEach(async () => {
    resetWalletStore();
    userId = `test_user_${Date.now()}_${Math.random()}`;
    sessionId = `session_${Date.now()}_${Math.random()}`;
  });

  it("should reject Round 2+ with wrong currentTreasure (inflated)", async () => {
    // Arrange: Play successful round 1 to reach round 2
    const initialBet = 100;
    await startGameSession(initialBet, userId, sessionId);

    // Win round 1 (use seed that guarantees survival)
    const round1 = await executeRound(1, initialBet, sessionId, userId, "99");
    assert.strictEqual(round1.survived, true, "Should survive round 1");

    const correctTreasure = round1.totalValue;
    console.log(`  Round 1 completed: treasure=$${correctTreasure}`);

    const session = getGameSession(sessionId);
    assert.strictEqual(session!.diveNumber, 2, "Should be at round 2");
    assert.strictEqual(session!.currentTreasure, correctTreasure);

    // Act: Call executeRound(2, WRONG_VALUE, ...)
    const inflatedTreasure = correctTreasure * 2; // Try to double the treasure

    // Assert: Should reject with treasure mismatch
    await assert.rejects(
      async () => executeRound(2, inflatedTreasure, sessionId, userId, "50"),
      (error: Error) => {
        const msg = error.message;

        // Check for treasure-related error (not round error)
        assert.ok(
          msg.toLowerCase().includes("treasure") || msg.includes("mismatch"),
          `Expected treasure error, got: ${msg}`
        );

        // Check for both values mentioned
        assert.ok(
          msg.includes(`${correctTreasure}`) || msg.includes("Expected"),
          `Expected error to mention correct treasure $${correctTreasure}, got: ${msg}`
        );

        assert.ok(
          msg.includes(`${inflatedTreasure}`) || msg.includes("received"),
          `Expected error to mention inflated value $${inflatedTreasure}, got: ${msg}`
        );

        console.log(`✓ Round 2 inflated treasure rejected: ${msg}`);
        return true;
      }
    );
  });

  it("should reject Round 2+ with wrong currentTreasure (deflated)", async () => {
    // Arrange: Play successful round 1
    const initialBet = 100;
    await startGameSession(initialBet, userId, sessionId);

    const round1 = await executeRound(1, initialBet, sessionId, userId, "99");
    assert.strictEqual(round1.survived, true);

    const correctTreasure = round1.totalValue;

    // Act: Try to use half the treasure
    const deflatedTreasure = Math.floor(correctTreasure / 2);

    // Assert: Should reject
    await assert.rejects(
      async () => executeRound(2, deflatedTreasure, sessionId, userId, "50"),
      (error: Error) => {
        const msg = error.message;
        assert.ok(
          msg.toLowerCase().includes("treasure"),
          `Expected treasure error, got: ${msg}`
        );
        console.log(`✓ Round 2 deflated treasure rejected: ${msg}`);
        return true;
      }
    );
  });

  it("should accept Round 2+ with correct currentTreasure", async () => {
    // Arrange: Play successful round 1
    const initialBet = 100;
    await startGameSession(initialBet, userId, sessionId);

    const round1 = await executeRound(1, initialBet, sessionId, userId, "99");
    assert.strictEqual(round1.survived, true);

    const correctTreasure = round1.totalValue;

    // Act: Execute round 2 with correct treasure
    const round2 = await executeRound(
      2,
      correctTreasure,
      sessionId,
      userId,
      "95"
    );

    // Assert: Should succeed
    assert.ok(round2.success, "Round 2 should execute");
    assert.strictEqual(round2.roundNumber, 2, "Should be round 2");

    console.log(
      `✓ Round 2 with correct treasure accepted: survived=${round2.survived}`
    );
  });
});

describe("Round + Treasure Validation: Round Number Priority", () => {
  let userId: string;
  let sessionId: string;

  beforeEach(async () => {
    resetWalletStore();
    userId = `test_user_${Date.now()}_${Math.random()}`;
    sessionId = `session_${Date.now()}_${Math.random()}`;
  });

  it("should check round number BEFORE treasure validation", async () => {
    // Arrange: Session at diveNumber = 3, currentTreasure = 400
    const initialBet = 100;
    await startGameSession(initialBet, userId, sessionId);

    // Win rounds 1 and 2
    const round1 = await executeRound(1, initialBet, sessionId, userId, "99");
    assert.strictEqual(round1.survived, true);

    const round2 = await executeRound(
      2,
      round1.totalValue,
      sessionId,
      userId,
      "99"
    );
    assert.strictEqual(round2.survived, true);

    const session = getGameSession(sessionId);
    assert.strictEqual(session!.diveNumber, 3, "Should be at round 3");
    const currentTreasure = session!.currentTreasure;

    console.log(`  Session at round 3, treasure=$${currentTreasure}`);

    // Act: Call executeRound(2, CORRECT_TREASURE, ...)
    // This has WRONG round number but CORRECT treasure for round 3
    const wrongRound = 2;

    // Assert: Error should be about ROUND MISMATCH (not treasure)
    await assert.rejects(
      async () =>
        executeRound(wrongRound, currentTreasure, sessionId, userId, "50"),
      (error: Error) => {
        const msg = error.message;

        // CRITICAL: Error must be about round, NOT treasure
        assert.ok(
          msg.toLowerCase().includes("round") && msg.includes("mismatch"),
          `Expected "Round mismatch" error, got: ${msg}`
        );

        // Should NOT mention treasure
        assert.ok(
          !msg.toLowerCase().includes("treasure"),
          `Error should NOT mention treasure when round is wrong, got: ${msg}`
        );

        // Should mention expected (3) and received (2)
        assert.ok(
          msg.includes("3") && msg.includes("2"),
          `Expected error to show round numbers (expected 3, received 2), got: ${msg}`
        );

        console.log(`✓ Round mismatch checked FIRST: ${msg}`);
        return true;
      }
    );
  });

  it("should check round number BEFORE treasure on Round 1 mismatch", async () => {
    // Arrange: Session at round 1 (just started)
    const initialBet = 100;
    await startGameSession(initialBet, userId, sessionId);

    // Act: Try to execute round 2 (skip ahead) with correct initial bet
    // This has wrong round AND wrong treasure concept (round 2 expects previousWinnings, not initialBet)
    const wrongRound = 2;

    // Assert: Should get ROUND error, not treasure error
    await assert.rejects(
      async () => executeRound(wrongRound, initialBet, sessionId, userId, "50"),
      (error: Error) => {
        const msg = error.message;

        assert.ok(
          msg.toLowerCase().includes("round"),
          `Expected round mismatch error, got: ${msg}`
        );

        assert.ok(
          msg.includes("1") && msg.includes("2"),
          `Expected round numbers in error, got: ${msg}`
        );

        console.log(`✓ Skipping ahead caught by round check: ${msg}`);
        return true;
      }
    );
  });

  it("should check round number BEFORE treasure when replaying old round", async () => {
    // Arrange: Play round 1, move to round 2
    const initialBet = 100;
    await startGameSession(initialBet, userId, sessionId);

    const round1 = await executeRound(1, initialBet, sessionId, userId, "99");
    assert.strictEqual(round1.survived, true);

    const session = getGameSession(sessionId);
    assert.strictEqual(session!.diveNumber, 2, "Should be at round 2");

    // Act: Try to replay round 1 with the WINNING treasure
    // This is a replay attack - trying to execute round 1 again with winnings
    const replayRound = 1;
    const winnings = round1.totalValue;

    // Assert: Should catch as ROUND mismatch (not treasure mismatch)
    await assert.rejects(
      async () => executeRound(replayRound, winnings, sessionId, userId, "50"),
      (error: Error) => {
        const msg = error.message;

        assert.ok(
          msg.toLowerCase().includes("round") && msg.includes("mismatch"),
          `Expected round mismatch for replay attack, got: ${msg}`
        );

        console.log(`✓ Replay attack caught by round validation: ${msg}`);
        return true;
      }
    );
  });
});

describe("Round + Treasure Validation: Both Wrong Scenarios", () => {
  let userId: string;
  let sessionId: string;

  beforeEach(async () => {
    resetWalletStore();
    userId = `test_user_${Date.now()}_${Math.random()}`;
    sessionId = `session_${Date.now()}_${Math.random()}`;
  });

  it("should reject with round error when BOTH round and treasure are wrong", async () => {
    // Arrange: Session at round 2
    const initialBet = 100;
    await startGameSession(initialBet, userId, sessionId);

    const round1 = await executeRound(1, initialBet, sessionId, userId, "99");
    assert.strictEqual(round1.survived, true);

    const session = getGameSession(sessionId);
    assert.strictEqual(session!.diveNumber, 2);
    const _correctTreasure = session!.currentTreasure;

    // Act: Send BOTH wrong round (5) AND wrong treasure (999)
    const wrongRound = 5;
    const wrongTreasure = 999;

    // Assert: Should get ROUND error (checked first), not treasure error
    await assert.rejects(
      async () =>
        executeRound(wrongRound, wrongTreasure, sessionId, userId, "50"),
      (error: Error) => {
        const msg = error.message;

        // Should fail on ROUND check (first check)
        assert.ok(
          msg.toLowerCase().includes("round") && msg.includes("mismatch"),
          `Expected round mismatch (checked first), got: ${msg}`
        );

        // Should NOT mention treasure (never gets to that check)
        assert.ok(
          !msg.toLowerCase().includes("treasure"),
          `Should fail on round check before treasure check, got: ${msg}`
        );

        console.log(`✓ Both wrong: failed on FIRST check (round): ${msg}`);
        return true;
      }
    );
  });

  it("should test validation order consistency across multiple attempts", async () => {
    // This test verifies that the validation order is ALWAYS stable
    const initialBet = 100;
    await startGameSession(initialBet, userId, sessionId);

    const round1 = await executeRound(1, initialBet, sessionId, userId, "99");
    assert.strictEqual(round1.survived, true);

    // Try 3 different invalid combinations - all should fail on round check
    const attempts = [
      { round: 5, treasure: 999, desc: "Both very wrong" },
      { round: 1, treasure: 999, desc: "Old round, wrong treasure" },
      {
        round: 10,
        treasure: round1.totalValue,
        desc: "Future round, correct treasure",
      },
    ];

    for (const attempt of attempts) {
      await assert.rejects(
        async () =>
          executeRound(
            attempt.round,
            attempt.treasure,
            sessionId,
            userId,
            "50"
          ),
        (error: Error) => {
          const msg = error.message;

          // All should fail on ROUND validation (first check)
          assert.ok(
            msg.toLowerCase().includes("round"),
            `${attempt.desc}: Expected round error, got: ${msg}`
          );

          console.log(`  ✓ ${attempt.desc}: ${msg}`);
          return true;
        }
      );
    }

    console.log("✓ Validation order is consistent across all scenarios");
  });
});

describe("Round + Treasure Validation: Error Message Quality", () => {
  let userId: string;
  let sessionId: string;

  beforeEach(async () => {
    resetWalletStore();
    userId = `test_user_${Date.now()}_${Math.random()}`;
    sessionId = `session_${Date.now()}_${Math.random()}`;
  });

  it("should provide clear error messages for round mismatch", async () => {
    const initialBet = 100;
    await startGameSession(initialBet, userId, sessionId);

    await assert.rejects(
      async () => executeRound(5, initialBet, sessionId, userId, "50"),
      (error: Error) => {
        const msg = error.message;

        // Should clearly state:
        // 1. What went wrong (round mismatch)
        // 2. Expected value (1)
        // 3. Received value (5)
        // 4. Action user should take (refresh)

        assert.ok(
          msg.toLowerCase().includes("round"),
          "Should mention 'round'"
        );
        assert.ok(msg.includes("1"), "Should mention expected round (1)");
        assert.ok(msg.includes("5"), "Should mention received round (5)");

        // Optional but helpful: suggestion to refresh
        const hasSuggestion =
          msg.toLowerCase().includes("refresh") ||
          msg.toLowerCase().includes("reload") ||
          msg.toLowerCase().includes("restart");

        console.log(`✓ Round error message: ${msg}`);
        console.log(`  - Has suggestion: ${hasSuggestion}`);

        return true;
      }
    );
  });

  it("should provide clear error messages for treasure mismatch", async () => {
    const initialBet = 100;
    await startGameSession(initialBet, userId, sessionId);

    const wrongValue = 500;

    await assert.rejects(
      async () => executeRound(1, wrongValue, sessionId, userId, "50"),
      (error: Error) => {
        const msg = error.message;

        // Should clearly state:
        // 1. What went wrong (treasure/value mismatch)
        // 2. Expected value ($100)
        // 3. Received value ($500)
        // 4. Severity indication (data corruption)

        assert.ok(
          msg.toLowerCase().includes("treasure") || msg.includes("value"),
          "Should mention 'treasure' or 'value'"
        );

        assert.ok(msg.includes("100"), "Should mention expected value");
        assert.ok(msg.includes("500"), "Should mention received value");

        const hasExpectedKeyword = msg.toLowerCase().includes("expected");
        const hasReceivedKeyword = msg.toLowerCase().includes("received");

        assert.ok(
          hasExpectedKeyword && hasReceivedKeyword,
          "Should have clear expected/received labels"
        );

        console.log(`✓ Treasure error message: ${msg}`);
        console.log(
          `  - Clear labels: ${hasExpectedKeyword && hasReceivedKeyword}`
        );

        return true;
      }
    );
  });
});

console.log("\n✅ All round + treasure validation tests completed!\n");
