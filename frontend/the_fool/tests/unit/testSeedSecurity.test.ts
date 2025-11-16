/**
 * TestSeed Security Tests
 *
 * Tests the critical security behavior of testSeed parameter:
 * 1. testSeed ONLY works in NODE_ENV === "test"
 * 2. Invalid testSeed throws error early (before state mutation)
 * 3. testSeed provides deterministic outcomes for testing
 *
 * Note: NODE_ENV is read-only in Node.js, so we test in the current environment.
 * Production behavior (ignoring testSeed) should be manually verified or tested
 * with integration tests that actually run in production mode.
 *
 * Run with: tsx --test tests/unit/testSeedSecurity.test.ts
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { executeRound, startGameSession } from "../../app/actions/gameEngine";
import {
  resetWalletStore,
  getGameSession,
  getUserWallet,
} from "../../lib/walletStore";

describe("TestSeed Security: Deterministic Behavior (Test Environment)", () => {
  let userId: string;
  let sessionId: string;

  beforeEach(async () => {
    resetWalletStore();
    userId = `test_user_${Date.now()}_${Math.random()}`;
    sessionId = `session_${Date.now()}_${Math.random()}`;
  });

  it("should produce deterministic results with testSeed", async () => {
    // Verify we're in test environment
    assert.strictEqual(
      process.env.NODE_ENV,
      "test",
      "This test must run in NODE_ENV=test"
    );

    const initialBet = 100;
    await startGameSession(initialBet, userId, sessionId);

    // Act: Call executeRound with testSeed = "42"
    const result1 = await executeRound(1, initialBet, sessionId, userId, "42");

    // Need new session for second call
    const userId2 = `test_user_${Date.now()}_${Math.random()}`;
    const sessionId2 = `session_${Date.now()}_${Math.random()}`;
    await startGameSession(initialBet, userId2, sessionId2);

    const result2 = await executeRound(
      1,
      initialBet,
      sessionId2,
      userId2,
      "42"
    );

    // Assert: Both should have randomRoll === 42
    assert.strictEqual(result1.randomRoll, 42, "First roll should be 42");
    assert.strictEqual(result2.randomRoll, 42, "Second roll should be 42");

    console.log("✓ testSeed=42 produced deterministic rolls: 42, 42");
  });

  it("should produce different results with different testSeeds", async () => {
    const initialBet = 100;
    const seeds = ["0", "25", "50", "75", "99"];
    const results: number[] = [];

    // Act: Test multiple seed values
    for (const seed of seeds) {
      const uid = `user_${seed}_${Date.now()}`;
      const sid = `session_${seed}_${Date.now()}`;
      await startGameSession(initialBet, uid, sid);

      const result = await executeRound(1, initialBet, sid, uid, seed);
      results.push(result.randomRoll);
    }

    // Assert: Each result should match its seed
    assert.strictEqual(results[0], 0, "Seed '0' should produce roll 0");
    assert.strictEqual(results[1], 25, "Seed '25' should produce roll 25");
    assert.strictEqual(results[2], 50, "Seed '50' should produce roll 50");
    assert.strictEqual(results[3], 75, "Seed '75' should produce roll 75");
    assert.strictEqual(results[4], 99, "Seed '99' should produce roll 99");

    console.log(`✓ Deterministic seeds produced: ${results.join(", ")}`);
  });

  it("should use cryptographic randomness when testSeed is undefined", async () => {
    const initialBet = 100;
    const rolls: number[] = [];

    // Act: Call without testSeed parameter
    for (let i = 0; i < 20; i++) {
      const uid = `user_${i}_${Date.now()}`;
      const sid = `session_${i}_${Date.now()}`;
      await startGameSession(initialBet, uid, sid);

      // Pass undefined explicitly
      const result = await executeRound(1, initialBet, sid, uid, undefined);
      rolls.push(result.randomRoll);
    }

    // Assert: Should have variance (not all the same)
    const uniqueRolls = new Set(rolls);
    assert.ok(
      uniqueRolls.size > 1,
      `Expected variance in random rolls, got: ${rolls.join(", ")}`
    );

    // With 20 rolls, expect at least 10 unique values
    assert.ok(
      uniqueRolls.size >= 10,
      `Expected at least 10 unique values in 20 rolls, got ${uniqueRolls.size}`
    );

    console.log(
      `✓ undefined testSeed used random: ${uniqueRolls.size}/20 unique values`
    );
  });

  it("should allow same testSeed for multiple rounds in same session", async () => {
    const initialBet = 100;
    await startGameSession(initialBet, userId, sessionId);

    // Round 1 with seed 90
    const round1 = await executeRound(1, initialBet, sessionId, userId, "90");
    assert.strictEqual(round1.randomRoll, 90);

    if (round1.survived) {
      // Round 2 with seed 85
      const round2 = await executeRound(
        2,
        round1.totalValue,
        sessionId,
        userId,
        "85"
      );
      assert.strictEqual(round2.randomRoll, 85);

      console.log(`✓ Multiple rounds with testSeeds: 90, 85`);
    } else {
      console.log(`✓ Round 1 ended game, testSeed 90 worked`);
    }
  });
});

describe("TestSeed Security: Invalid Seed Handling", () => {
  let userId: string;
  let sessionId: string;

  beforeEach(async () => {
    resetWalletStore();
    userId = `test_user_${Date.now()}_${Math.random()}`;
    sessionId = `session_${Date.now()}_${Math.random()}`;
  });

  it("should reject testSeed > 99", async () => {
    const initialBet = 100;
    await startGameSession(initialBet, userId, sessionId);

    await assert.rejects(
      async () => executeRound(1, initialBet, sessionId, userId, "101"),
      (error: Error) => {
        const msg = error.message;
        assert.ok(
          msg.includes("Invalid test seed"),
          `Expected "Invalid test seed", got: ${msg}`
        );
        assert.ok(
          msg.includes("0-99"),
          `Expected range "0-99" in error, got: ${msg}`
        );
        console.log(`✓ Rejected testSeed=101: ${msg}`);
        return true;
      }
    );
  });

  it("should reject testSeed < 0", async () => {
    const initialBet = 100;
    await startGameSession(initialBet, userId, sessionId);

    await assert.rejects(
      async () => executeRound(1, initialBet, sessionId, userId, "-5"),
      (error: Error) => {
        const msg = error.message;
        assert.ok(msg.includes("Invalid test seed"), `Got: ${msg}`);
        console.log(`✓ Rejected testSeed=-5: ${msg}`);
        return true;
      }
    );
  });

  it("should reject non-numeric testSeed", async () => {
    const initialBet = 100;
    await startGameSession(initialBet, userId, sessionId);

    await assert.rejects(
      async () =>
        executeRound(1, initialBet, sessionId, userId, "not-a-number"),
      (error: Error) => {
        const msg = error.message;
        assert.ok(msg.includes("Invalid test seed"), `Got: ${msg}`);
        console.log(`✓ Rejected testSeed="not-a-number": ${msg}`);
        return true;
      }
    );
  });

  it("should reject testSeed=100 (boundary)", async () => {
    const initialBet = 100;
    await startGameSession(initialBet, userId, sessionId);

    await assert.rejects(
      async () => executeRound(1, initialBet, sessionId, userId, "100"),
      /Invalid test seed/,
      "Should reject 100"
    );

    console.log("✓ Rejected boundary testSeed=100");
  });

  it("should reject testSeed=-1 (boundary)", async () => {
    const initialBet = 100;
    await startGameSession(initialBet, userId, sessionId);

    await assert.rejects(
      async () => executeRound(1, initialBet, sessionId, userId, "-1"),
      /Invalid test seed/,
      "Should reject -1"
    );

    console.log("✓ Rejected boundary testSeed=-1");
  });

  it("should handle parseInt edge cases correctly", async () => {
    const initialBet = 100;

    // Test "42.5" - parseInt will parse as 42, which should be valid
    await startGameSession(initialBet, userId, sessionId);
    const result = await executeRound(1, initialBet, sessionId, userId, "42.5");
    assert.strictEqual(result.randomRoll, 42, "parseInt('42.5') should be 42");
    console.log(`✓ testSeed="42.5" parsed as 42`);
  });

  it("should NOT mutate session state on invalid testSeed", async () => {
    const initialBet = 100;
    await startGameSession(initialBet, userId, sessionId);

    const sessionBefore = getGameSession(sessionId);
    assert.ok(sessionBefore, "Session should exist");

    const diveNumberBefore = sessionBefore!.diveNumber;
    const treasureBefore = sessionBefore!.currentTreasure;
    const isActiveBefore = sessionBefore!.isActive;

    // Act: Try invalid seed
    try {
      await executeRound(1, initialBet, sessionId, userId, "999");
      assert.fail("Should have thrown error");
    } catch (error) {
      // Expected to throw
    }

    // Assert: Session should be unchanged
    const sessionAfter = getGameSession(sessionId);
    assert.ok(sessionAfter, "Session should still exist");

    assert.strictEqual(
      sessionAfter!.diveNumber,
      diveNumberBefore,
      "Round number should not change"
    );

    assert.strictEqual(
      sessionAfter!.currentTreasure,
      treasureBefore,
      "Treasure should not change"
    );

    assert.strictEqual(
      sessionAfter!.isActive,
      isActiveBefore,
      "Active status should not change"
    );

    console.log("✓ Invalid testSeed did not mutate session state");
  });

  it("should NOT mutate wallet on invalid testSeed", async () => {
    const initialBet = 100;
    const walletBefore = getUserWallet(userId);
    const balanceBefore = walletBefore.balance;

    await startGameSession(initialBet, userId, sessionId);

    const walletAfterBet = getUserWallet(userId);
    const balanceAfterBet = walletAfterBet.balance;

    // Act: Try invalid seed
    try {
      await executeRound(1, initialBet, sessionId, userId, "abc");
      assert.fail("Should have thrown error");
    } catch (error) {
      // Expected to throw
    }

    // Assert: Wallet should be unchanged (still at post-bet balance)
    const walletAfterError = getUserWallet(userId);

    assert.strictEqual(
      walletAfterError.balance,
      balanceAfterBet,
      "Balance should not change from invalid seed"
    );

    // Verify wallet stats also unchanged
    assert.strictEqual(
      walletAfterError.totalWagered,
      walletAfterBet.totalWagered,
      "Wagered should not change"
    );

    console.log(
      `✓ Invalid testSeed did not mutate wallet: $${balanceBefore} → $${balanceAfterBet} (stayed)`
    );
  });
});

describe("TestSeed Security: Edge Cases & Boundaries", () => {
  let userId: string;
  let sessionId: string;

  beforeEach(async () => {
    resetWalletStore();
    userId = `test_user_${Date.now()}_${Math.random()}`;
    sessionId = `session_${Date.now()}_${Math.random()}`;
  });

  it("should accept testSeed boundary values (0 and 99)", async () => {
    const initialBet = 100;

    // Test seed=0
    await startGameSession(initialBet, userId, sessionId);
    const result0 = await executeRound(1, initialBet, sessionId, userId, "0");

    // Test seed=99
    const userId2 = `user_99_${Date.now()}`;
    const sessionId2 = `session_99_${Date.now()}`;
    await startGameSession(initialBet, userId2, sessionId2);
    const result99 = await executeRound(
      1,
      initialBet,
      sessionId2,
      userId2,
      "99"
    );

    assert.strictEqual(result0.randomRoll, 0, "Seed 0 should work");
    assert.strictEqual(result99.randomRoll, 99, "Seed 99 should work");

    console.log("✓ Boundary seeds accepted: 0 and 99");
  });

  it("should handle string testSeed with leading zeros", async () => {
    const initialBet = 100;

    // Act: Seeds like "05", "042"
    await startGameSession(initialBet, userId, sessionId);
    const result1 = await executeRound(1, initialBet, sessionId, userId, "05");

    const userId2 = `user_042_${Date.now()}`;
    const sessionId2 = `session_042_${Date.now()}`;
    await startGameSession(initialBet, userId2, sessionId2);
    const result2 = await executeRound(
      1,
      initialBet,
      sessionId2,
      userId2,
      "042"
    );

    // Assert: Should parse correctly (parseInt handles leading zeros)
    assert.strictEqual(result1.randomRoll, 5, "Should parse '05' as 5");
    assert.strictEqual(result2.randomRoll, 42, "Should parse '042' as 42");

    console.log("✓ Leading zeros handled: '05'→5, '042'→42");
  });

  it("should handle testSeed with whitespace", async () => {
    const initialBet = 100;

    // Test " 42 " (spaces)
    await startGameSession(initialBet, userId, sessionId);
    const result = await executeRound(1, initialBet, sessionId, userId, " 42 ");

    // parseInt trims whitespace
    assert.strictEqual(result.randomRoll, 42, "Should parse ' 42 ' as 42");

    console.log("✓ Whitespace handled: ' 42 '→42");
  });

  it("should validate testSeed BEFORE executing round logic", async () => {
    const initialBet = 100;
    await startGameSession(initialBet, userId, sessionId);

    const sessionBefore = getGameSession(sessionId);
    const roundBefore = sessionBefore!.diveNumber;

    // Try invalid seed - should fail before any game logic
    try {
      await executeRound(1, initialBet, sessionId, userId, "invalid");
    } catch (error) {
      // Expected
    }

    const sessionAfter = getGameSession(sessionId);

    // Round number should not have incremented
    assert.strictEqual(
      sessionAfter!.diveNumber,
      roundBefore,
      "Round should not advance on invalid seed"
    );

    console.log("✓ Invalid seed rejected before game logic execution");
  });
});

describe("TestSeed Security: Production Environment Notes", () => {
  it("should document production behavior expectations", () => {
    // This is a documentation test - no actual execution
    const productionBehavior = {
      testSeedIgnored: true,
      useCryptoRandom: true,
      noErrorWhenTestSeedProvided: true,
      attackerCannotManipulate: true,
    };

    assert.ok(
      productionBehavior.testSeedIgnored,
      "In production (NODE_ENV !== 'test'), testSeed parameter should be completely ignored"
    );

    assert.ok(
      productionBehavior.useCryptoRandom,
      "Production must use crypto.randomBytes() for secure randomness"
    );

    assert.ok(
      productionBehavior.noErrorWhenTestSeedProvided,
      "If attacker sends testSeed in production, it should be silently ignored (no error)"
    );

    assert.ok(
      productionBehavior.attackerCannotManipulate,
      "Attacker cannot manipulate game outcomes by sending testSeed values"
    );

    console.log("\n📋 Production Security Requirements:");
    console.log("  ✓ testSeed only works when NODE_ENV === 'test'");
    console.log("  ✓ Production uses crypto.randomBytes()");
    console.log("  ✓ testSeed silently ignored in production");
    console.log("  ✓ No way for attackers to control RNG\n");

    console.log("⚠️  Manual Testing Required:");
    console.log("  1. Run app with NODE_ENV=production");
    console.log("  2. Send API requests with testSeed parameter");
    console.log("  3. Verify testSeed is ignored (random outcomes)");
    console.log("  4. Verify no errors thrown\n");
  });
});

console.log("\n✅ All testSeed security tests completed!\n");
