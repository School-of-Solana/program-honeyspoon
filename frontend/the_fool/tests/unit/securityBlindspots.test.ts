/**
 * Security Blindspot Tests
 *
 * Tests for critical security vulnerabilities that could allow
 * clients to manipulate game state or extract money from the house.
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
import { getGameSession, setGameSession } from "../../lib/walletStore";

describe("Security Blindspot #1: Round Number Validation", () => {
  it("should reject when client replays an old round number", async () => {
    const userId = "user-replay-attack";
    const sessionId = "session-replay-attack";

    // Start game
    const start = await startGameSession(100, userId, sessionId);
    assert.equal(start.success, true);

    // Execute round 1 successfully
    const round1 = await executeRound(1, 100, sessionId, userId, "50");
    assert.equal(round1.survived, true);

    // Now server expects round 2, but client tries to replay round 1
    await assert.rejects(
      () => executeRound(1, round1.totalValue, sessionId, userId, "50"),
      /round number mismatch.*client sent 1.*server expects 2/i
    );
  });

  it("should reject when client skips ahead in round numbers", async () => {
    const userId = "user-skip-ahead";
    const sessionId = "session-skip-ahead";

    const start = await startGameSession(100, userId, sessionId);
    assert.equal(start.success, true);

    // Server expects round 1, but client tries to jump to round 5
    await assert.rejects(
      () => executeRound(5, 100, sessionId, userId, "50"),
      /round number mismatch.*client sent 5.*server expects 1/i
    );
  });

  it("should reject when round number doesn't match after manual session manipulation", async () => {
    const userId = "user-manual-mismatch";
    const sessionId = "session-manual-mismatch";

    const start = await startGameSession(100, userId, sessionId);
    assert.equal(start.success, true);

    // Simulate a bug or attack that corrupts the session
    const session = getGameSession(sessionId)!;
    session.diveNumber = 7; // Force server to expect round 7
    setGameSession(session);

    // Client sends round 1 (what it thinks is correct)
    await assert.rejects(
      () => executeRound(1, 100, sessionId, userId, "50"),
      /round number mismatch.*client sent 1.*server expects 7/i
    );
  });

  it("should allow correct sequential round progression", async () => {
    const userId = "user-correct-sequence";
    const sessionId = "session-correct-sequence";

    const start = await startGameSession(100, userId, sessionId);
    assert.equal(start.success, true);

    // Round 1
    const round1 = await executeRound(1, 100, sessionId, userId, "50");
    assert.equal(round1.survived, true);

    // Round 2
    const round2 = await executeRound(
      2,
      round1.totalValue,
      sessionId,
      userId,
      "50"
    );
    assert.equal(round2.survived, true);

    // Round 3
    const round3 = await executeRound(
      3,
      round2.totalValue,
      sessionId,
      userId,
      "50"
    );
    assert.equal(round3.survived, true);

    // All should succeed because they match server expectations
  });
});

describe("Security Blindspot #2: Current Value Validation", () => {
  it("should reject when client inflates currentValue on first round", async () => {
    const userId = "user-inflate-first";
    const sessionId = "session-inflate-first";

    const start = await startGameSession(100, userId, sessionId);
    assert.equal(start.success, true);

    const session = getGameSession(sessionId)!;
    assert.equal(session.initialBet, 100);

    // Client tries to claim they have $500 instead of $100
    await assert.rejects(
      () => executeRound(1, 500, sessionId, userId, "50"),
      /current value mismatch.*client sent 500.*server has 100/i
    );
  });

  it("should reject when client inflates currentValue on later rounds", async () => {
    const userId = "user-inflate-later";
    const sessionId = "session-inflate-later";

    const start = await startGameSession(100, userId, sessionId);
    assert.equal(start.success, true);

    // Win round 1 - use low seed to ensure survival
    const round1 = await executeRound(1, 100, sessionId, userId, "50");
    assert.equal(round1.survived, true);

    // Client tries to inflate value on round 2
    const inflatedValue = round1.totalValue * 10;
    await assert.rejects(
      () => executeRound(2, inflatedValue, sessionId, userId, "50"),
      /current value mismatch/i
    );
  });

  it("should reject when client deflates currentValue", async () => {
    const userId = "user-deflate";
    const sessionId = "session-deflate";

    const start = await startGameSession(100, userId, sessionId);
    assert.equal(start.success, true);

    const round1 = await executeRound(1, 100, sessionId, userId, "50");
    assert.equal(round1.survived, true);

    // Client sends a smaller value than server has
    const deflatedValue = round1.totalValue / 2;
    await assert.rejects(
      () => executeRound(2, deflatedValue, sessionId, userId, "50"),
      /current value mismatch/i
    );
  });

  it("should allow correct currentValue matching server state", async () => {
    const userId = "user-correct-value";
    const sessionId = "session-correct-value";

    const start = await startGameSession(100, userId, sessionId);
    assert.equal(start.success, true);

    // Round 1 with correct initial bet
    const round1 = await executeRound(1, 100, sessionId, userId, "50");
    assert.equal(round1.survived, true);

    // Round 2 with correct value from round 1
    const round2 = await executeRound(
      2,
      round1.totalValue,
      sessionId,
      userId,
      "50"
    );
    assert.equal(round2.survived, true);

    // Both should succeed
  });

  it("should reject when currentValue is correct but round number is wrong", async () => {
    const userId = "user-correct-value-wrong-round";
    const sessionId = "session-correct-value-wrong-round";

    const start = await startGameSession(100, userId, sessionId);
    assert.equal(start.success, true);

    const round1 = await executeRound(1, 100, sessionId, userId, "50");
    assert.equal(round1.survived, true);

    // Client sends correct currentValue but wrong round number
    // This tests that BOTH validations are enforced
    await assert.rejects(
      () => executeRound(1, round1.totalValue, sessionId, userId, "50"),
      /round number mismatch/i
    );
  });
});

describe("Combined Attack Scenarios", () => {
  it("should prevent double-spending by replaying winning rounds", async () => {
    const userId = "user-double-spend";
    const sessionId = "session-double-spend";

    const start = await startGameSession(100, userId, sessionId);
    assert.equal(start.success, true);

    // Win round 1
    const round1 = await executeRound(1, 100, sessionId, userId, "50");
    assert.equal(round1.survived, true);
    const winnings = round1.totalValue;

    // Try to replay round 1 with the winnings (should fail)
    await assert.rejects(
      () => executeRound(1, winnings, sessionId, userId, "50"),
      /round number mismatch/i
    );
  });

  it("should prevent manipulation of game progression", async () => {
    const userId = "user-manipulate";
    const sessionId = "session-manipulate";

    const start = await startGameSession(100, userId, sessionId);
    assert.equal(start.success, true);

    // Attacker tries to skip to round 10 with a huge treasure value
    await assert.rejects(
      () => executeRound(10, 100000, sessionId, userId, "50"),
      /round number mismatch/i
    );
  });

  it("should validate every parameter on every call", async () => {
    const userId = "user-validate-all";
    const sessionId = "session-validate-all";

    const start = await startGameSession(100, userId, sessionId);
    assert.equal(start.success, true);

    // Valid round 1
    const round1 = await executeRound(1, 100, sessionId, userId, "50");
    assert.equal(round1.survived, true);

    // Try various invalid combinations
    const validRound = 2;
    const validValue = round1.totalValue;
    const invalidRound = 5;
    const invalidValue = 99999;

    // Wrong round, correct value
    await assert.rejects(
      () => executeRound(invalidRound, validValue, sessionId, userId, "50"),
      /round number mismatch/i
    );

    // Correct round, wrong value
    await assert.rejects(
      () => executeRound(validRound, invalidValue, sessionId, userId, "50"),
      /current value mismatch/i
    );

    // Both wrong - should fail on first check (round number)
    await assert.rejects(() =>
      executeRound(invalidRound, invalidValue, sessionId, userId, "50")
    );
  });
});

describe("Edge Cases", () => {
  it("should handle round 1 correctly (initialBet validation)", async () => {
    const userId = "user-edge-round1";
    const sessionId = "session-edge-round1";

    const start = await startGameSession(100, userId, sessionId);
    assert.equal(start.success, true);

    // For round 1, currentValue MUST equal initialBet
    const session = getGameSession(sessionId)!;
    assert.equal(session.currentTreasure, 0); // Not set yet
    assert.equal(session.initialBet, 100);

    // Should accept initialBet
    const round1 = await executeRound(1, 100, sessionId, userId, "50");
    assert.equal(round1.survived, true);
  });

  it("should handle session state after failed validation", async () => {
    const userId = "user-after-fail";
    const sessionId = "session-after-fail";

    const start = await startGameSession(100, userId, sessionId);
    assert.equal(start.success, true);

    // Try to cheat
    try {
      await executeRound(1, 999, sessionId, userId, "50");
      assert.fail("Should have thrown an error");
    } catch (e: any) {
      assert.match(e.message, /current value mismatch/i);
    }

    // Session should still be valid and at correct state
    const session = getGameSession(sessionId)!;
    assert.equal(session.isActive, true);
    assert.equal(session.diveNumber, 1); // Still expecting round 1
    assert.equal(session.currentTreasure, 0);

    // Should be able to continue with correct values
    const round1 = await executeRound(1, 100, sessionId, userId, "50");
    assert.equal(round1.survived, true);
  });
});

describe("Security Blindspot #4: Cash Out with Zero Server Treasure", () => {
  it("should fail if server treasure is 0 but client sends > 0", async () => {
    const userId = "user-zero-server-treasure";
    const sessionId = "session-zero-server-treasure";

    const start = await startGameSession(100, userId, sessionId);
    assert.equal(start.success, true);

    // Force a corrupt session where currentTreasure is 0
    const session = getGameSession(sessionId)!;
    session.currentTreasure = 0;
    setGameSession(session);

    // Try to cash out with $100 when server has $0
    await assert.rejects(
      () => cashOut(100, sessionId, userId),
      /doesn't match session treasure.*0/i
    );
  });

  it("should reject negative server treasure (impossible state)", async () => {
    const userId = "user-negative-treasure";
    const sessionId = "session-negative-treasure";

    const start = await startGameSession(100, userId, sessionId);
    assert.equal(start.success, true);

    // Force impossible state
    const session = getGameSession(sessionId)!;
    session.currentTreasure = -50;
    setGameSession(session);

    await assert.rejects(() => cashOut(50, sessionId, userId));
  });
});
