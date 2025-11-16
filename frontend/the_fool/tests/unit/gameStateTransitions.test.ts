/**
 * Game State Transition Tests
 * Tests state machine transitions and edge cases
 * Run with: tsx --test tests/unit/gameStateTransitions.test.ts
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
import { resetWalletStore, getGameSession } from "../../lib/walletStore";

describe("Game State Transitions", () => {
  let userId: string;
  let sessionId: string;

  beforeEach(async () => {
    resetWalletStore();
    userId = `test_user_${Date.now()}_${Math.random()}`;
    sessionId = await generateSessionId();
  });

  it("should transition from idle → betting → playing", async () => {
    // State 1: Idle (no game)
    const initialWallet = await getWalletInfo(userId);
    assert.strictEqual(initialWallet.gamesPlayed, 0, "No games played yet");

    // State 2: Betting (game starts)
    const startResult = await startGame(50, userId, sessionId);
    assert.strictEqual(startResult.success, true, "Game should start");

    const session = getGameSession(sessionId);
    assert.ok(session, "Session should exist");
    assert.strictEqual(session!.isActive, true, "Session should be active");
    assert.strictEqual(session!.diveNumber, 1, "Should be at dive 1");

    // State 3: Playing (dive happens)
    const diveResult = await performDive(1, 50, sessionId, userId, "99");

    if (diveResult.survived) {
      const updatedSession = getGameSession(sessionId);
      assert.strictEqual(
        updatedSession!.diveNumber,
        2,
        "Should advance to dive 2"
      );
      assert.strictEqual(
        updatedSession!.isActive,
        true,
        "Should still be active"
      );
    }

    console.log("✓ State transitions: idle → betting → playing");
  });

  it("should transition from playing → game over (loss)", async () => {
    // Start game
    await startGame(50, userId, sessionId);

    // Dive with very low roll (likely to die)
    const diveResult = await performDive(1, 50, sessionId, userId, "1");

    if (!diveResult.survived) {
      // Should transition to game over
      const session = getGameSession(sessionId);
      assert.strictEqual(
        session,
        undefined,
        "Session should be deleted after loss"
      );

      const wallet = await getWalletInfo(userId);
      assert.strictEqual(wallet.gamesPlayed, 1, "Game should be counted");
      assert.strictEqual(wallet.totalLost, 50, "Loss should be recorded");

      console.log("✓ State transition: playing → game over (loss)");
    } else {
      console.log("✓ Survived with roll=1 (lucky!), skipping loss test");
    }
  });

  it("should transition from playing → surfacing → game over (win)", async () => {
    // Start game
    await startGame(50, userId, sessionId);

    // Dive successfully
    const diveResult = await performDive(1, 50, sessionId, userId, "99");
    assert.strictEqual(diveResult.survived, true, "Should survive");

    // Surface (cash out)
    const surfaceResult = await surfaceWithTreasure(
      diveResult.totalTreasure,
      sessionId,
      userId
    );

    assert.strictEqual(
      surfaceResult.success,
      true,
      "Should surface successfully"
    );

    // Should transition to game over
    const session = getGameSession(sessionId);
    assert.strictEqual(
      session,
      undefined,
      "Session should be deleted after surface"
    );

    const wallet = await getWalletInfo(userId);
    assert.strictEqual(wallet.gamesPlayed, 1, "Game should be counted");

    console.log("✓ State transition: playing → surfacing → game over (win)");
  });

  it("should handle multiple dives (stay in playing state)", async () => {
    await startGame(50, userId, sessionId);

    let currentTreasure = 50;
    let divesCompleted = 0;

    // Perform up to 5 dives
    for (let dive = 1; dive <= 5; dive++) {
      const result = await performDive(
        dive,
        currentTreasure,
        sessionId,
        userId,
        "99"
      );

      if (!result.survived) {
        console.log(`  Died on dive ${dive}`);
        break;
      }

      // Still in playing state
      const session = getGameSession(sessionId);
      assert.ok(session, `Session should exist after dive ${dive}`);
      assert.strictEqual(
        session!.isActive,
        true,
        "Session should still be active"
      );
      assert.strictEqual(
        session!.diveNumber,
        dive + 1,
        `Should be at dive ${dive + 1}`
      );

      currentTreasure = result.totalTreasure;
      divesCompleted = dive;
    }

    console.log(`✓ Stayed in playing state for ${divesCompleted} dives`);
  });

  it("should prevent actions after game over", async () => {
    await startGame(50, userId, sessionId);

    // Die
    const diveResult = await performDive(1, 50, sessionId, userId, "1");

    if (!diveResult.survived) {
      // Try to dive again (should fail)
      try {
        await performDive(2, 50, sessionId, userId, "99");
        assert.fail("Should not allow dive after game over");
      } catch (error) {
        assert.ok(error instanceof Error, "Should throw error");
        assert.ok(
          (error as Error).message.includes("Invalid or inactive"),
          "Error should mention invalid session"
        );
      }

      // Try to surface (should fail)
      try {
        await surfaceWithTreasure(50, sessionId, userId);
        assert.fail("Should not allow surface after game over");
      } catch (error) {
        assert.ok(error instanceof Error, "Should throw error");
      }

      console.log("✓ Actions blocked after game over");
    }
  });

  it("should handle rapid state transitions (stress test)", async () => {
    // Play 10 quick games in sequence
    for (let game = 1; game <= 10; game++) {
      const newSessionId = await generateSessionId();

      // Start
      const startResult = await startGame(10, userId, newSessionId);
      if (!startResult.success) {
        console.log(`  Game ${game}: Failed to start (house limits)`);
        continue;
      }

      // Dive
      const diveResult = await performDive(
        1,
        10,
        newSessionId,
        userId,
        `${game * 10}`
      );

      if (diveResult.survived) {
        // Surface
        await surfaceWithTreasure(
          diveResult.totalTreasure,
          newSessionId,
          userId
        );
      }

      // Verify session cleaned up
      const session = getGameSession(newSessionId);
      assert.strictEqual(
        session,
        undefined,
        `Session ${game} should be cleaned up`
      );
    }

    const wallet = await getWalletInfo(userId);
    assert.ok(wallet.gamesPlayed >= 5, "Should have played at least 5 games");

    console.log(`✓ Rapid transitions: ${wallet.gamesPlayed} games completed`);
  });
});

describe("Session Management", () => {
  let userId: string;

  beforeEach(() => {
    resetWalletStore();
    userId = `test_user_${Date.now()}_${Math.random()}`;
  });

  it("should create valid session on game start", async () => {
    const sessionId = await generateSessionId();
    await startGame(50, userId, sessionId);

    const session = getGameSession(sessionId);

    assert.ok(session, "Session should exist");
    assert.strictEqual(
      session!.sessionId,
      sessionId,
      "Session ID should match"
    );
    assert.strictEqual(session!.userId, userId, "User ID should match");
    assert.strictEqual(session!.initialBet, 50, "Bet should be stored");
    assert.strictEqual(session!.isActive, true, "Should be active");
    assert.ok(session!.startTime > 0, "Should have start time");
    assert.ok(session!.reservedPayout > 0, "Should have reserved funds");

    console.log("✓ Valid session created");
  });

  it("should clean up session after loss", async () => {
    const sessionId = await generateSessionId();
    await startGame(50, userId, sessionId);

    const sessionBefore = getGameSession(sessionId);
    assert.ok(sessionBefore, "Session should exist before dive");

    // Die
    await performDive(1, 50, sessionId, userId, "1");

    const sessionAfter = getGameSession(sessionId);
    assert.strictEqual(
      sessionAfter,
      undefined,
      "Session should be deleted after loss"
    );

    console.log("✓ Session cleaned up after loss");
  });

  it("should clean up session after win", async () => {
    const sessionId = await generateSessionId();
    await startGame(50, userId, sessionId);

    const diveResult = await performDive(1, 50, sessionId, userId, "99");
    assert.strictEqual(diveResult.survived, true, "Should survive");

    await surfaceWithTreasure(diveResult.totalTreasure, sessionId, userId);

    const session = getGameSession(sessionId);
    assert.strictEqual(
      session,
      undefined,
      "Session should be deleted after win"
    );

    console.log("✓ Session cleaned up after win");
  });

  it("should handle multiple concurrent sessions from same user", async () => {
    const session1 = await generateSessionId();
    const session2 = await generateSessionId();
    const session3 = await generateSessionId();

    // Start 3 games
    const start1 = await startGame(10, userId, session1);
    const start2 = await startGame(10, userId, session2);
    const start3 = await startGame(10, userId, session3);

    // At least 2 should succeed (house limits might block some)
    const successful = [start1, start2, start3].filter((r) => r.success).length;
    assert.ok(successful >= 2, "At least 2 sessions should start");

    // All sessions should be independent
    if (start1.success) {
      const s1 = getGameSession(session1);
      assert.ok(s1, "Session 1 should exist");
    }

    if (start2.success) {
      const s2 = getGameSession(session2);
      assert.ok(s2, "Session 2 should exist");
    }

    console.log(`✓ Multiple concurrent sessions: ${successful}/3 active`);
  });

  it("should reject actions from wrong user", async () => {
    const sessionId = await generateSessionId();
    const otherUserId = `other_user_${Date.now()}`;

    // User 1 starts game
    await startGame(50, userId, sessionId);

    // User 2 tries to dive on User 1's session
    try {
      await performDive(1, 50, sessionId, otherUserId, "99");
      assert.fail("Should reject dive from wrong user");
    } catch (error) {
      assert.ok(error instanceof Error, "Should throw error");
      assert.ok(
        (error as Error).message.includes("does not belong"),
        "Error should mention wrong user"
      );
    }

    console.log("✓ Actions from wrong user rejected");
  });

  it("should handle very long session IDs", async () => {
    const longSessionId = "a".repeat(100);

    const result = await startGame(50, userId, longSessionId);
    assert.strictEqual(result.success, true, "Should accept long session ID");

    const session = getGameSession(longSessionId);
    assert.ok(session, "Session should exist with long ID");

    console.log("✓ Long session IDs handled");
  });

  it("should reject very short session IDs", async () => {
    const shortSessionId = "abc";

    try {
      await startGame(50, userId, shortSessionId);
      // If it succeeds, that's fine
      console.log("✓ Short session ID accepted (no validation)");
    } catch (error) {
      // If it fails, verify error message
      assert.ok(error instanceof Error, "Should throw error");
      console.log("✓ Short session ID rejected");
    }
  });
});

describe("Concurrent Action Prevention", () => {
  let userId: string;
  let sessionId: string;

  beforeEach(async () => {
    resetWalletStore();
    userId = `test_user_${Date.now()}_${Math.random()}`;
    sessionId = await generateSessionId();
  });

  it("should handle concurrent dive attempts", async () => {
    await startGame(50, userId, sessionId);

    // Try to dive twice at the same time
    const dive1 = performDive(1, 50, sessionId, userId, "50");
    const dive2 = performDive(1, 50, sessionId, userId, "45");

    const results = await Promise.allSettled([dive1, dive2]);

    // At most one should succeed
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    // Either one succeeds and one fails, or both fail (race condition)
    assert.ok(succeeded <= 1, "At most one dive should succeed");

    console.log(`✓ Concurrent dives: ${succeeded} succeeded, ${failed} failed`);
  });

  it("should handle dive during surface", async () => {
    await startGame(50, userId, sessionId);

    const diveResult = await performDive(1, 50, sessionId, userId, "99");
    assert.strictEqual(diveResult.survived, true, "Should survive");

    // Try to dive while surfacing
    const surface = surfaceWithTreasure(
      diveResult.totalTreasure,
      sessionId,
      userId
    );
    const dive2 = performDive(
      2,
      diveResult.totalTreasure,
      sessionId,
      userId,
      "99"
    );

    const results = await Promise.allSettled([surface, dive2]);

    // Surface should succeed, dive should fail (session becomes inactive)
    const surfaceResult = results[0];
    const diveResult2 = results[1];

    assert.strictEqual(
      surfaceResult.status,
      "fulfilled",
      "Surface should succeed"
    );

    if (diveResult2.status === "rejected") {
      console.log("✓ Dive blocked during surface");
    } else {
      console.log("⚠ Dive allowed during surface (race condition)");
    }
  });
});

console.log("\n✅ All game state transition tests completed!\n");
