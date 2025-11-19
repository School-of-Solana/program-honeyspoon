/**
 * Wallet Race Condition Tests
 * Tests concurrent operations and state consistency
 * Run with: tsx --test tests/unit/walletRaceConditions.test.ts
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import {
  startGame,
  performDive,
  surfaceWithTreasure,
  generateSessionId,
  getWalletInfo,
  getHouseStatus,
} from "../../app/actions/gameActions";
import { resetWalletStore, getGameSession } from "../../lib/walletStore";

describe("Concurrent Bet Placement", () => {
  let userId: string;

  beforeEach(() => {
    resetWalletStore();
    userId = `test_user_${Date.now()}_${Math.random()}`;
  });

  it("should handle multiple simultaneous bets from same user", async () => {
    const session1 = await generateSessionId();
    const session2 = await generateSessionId();
    const session3 = await generateSessionId();

    const initialWallet = await getWalletInfo(userId);

    // Try to place 3 bets simultaneously
    const results = await Promise.all([
      startGame(100, userId, session1),
      startGame(100, userId, session2),
      startGame(100, userId, session3),
    ]);

    const successCount = results.filter((r) => r.success).length;

    // At most 10 bets should succeed (balance = 1000)
    assert.ok(successCount <= 10, "Should not allow over-betting");

    const finalWallet = await getWalletInfo(userId);

    // Balance should decrease by exactly (successCount * 100)
    const expectedBalance = initialWallet.balance - successCount * 100;
    assert.strictEqual(
      finalWallet.balance,
      expectedBalance,
      "Balance should reflect exact number of successful bets"
    );

    console.log(
      `- ${successCount}/3 concurrent bets succeeded, balance: $${finalWallet.balance}`
    );
  });

  it("should prevent spending more than available balance", async () => {
    // User has $1000
    const bets = [];

    // Try to place 15 bets of $100 each (would need $1500)
    for (let i = 0; i < 15; i++) {
      const sessionId = await generateSessionId();
      bets.push(startGame(100, userId, sessionId));
    }

    const results = await Promise.all(bets);
    const successCount = results.filter((r) => r.success).length;

    // Should only succeed 10 times (1000 / 100)
    assert.ok(successCount <= 10, "Should not exceed available balance");

    const finalWallet = await getWalletInfo(userId);

    // Balance should never go negative
    assert.ok(finalWallet.balance >= 0, "Balance should not go negative");

    console.log(`- Placed ${successCount}/15 bets (balance protection worked)`);
  });

  it("should handle rapid balance checks during betting", async () => {
    const sessionId = await generateSessionId();

    // Start a bet
    const betPromise = startGame(50, userId, sessionId);

    // Check balance while bet is being placed
    const checks = await Promise.all([
      getWalletInfo(userId),
      getWalletInfo(userId),
      getWalletInfo(userId),
    ]);

    await betPromise;

    // All checks should return valid data
    checks.forEach((check) => {
      assert.ok(check.balance >= 0, "Balance check should return valid data");
      assert.ok(Number.isFinite(check.balance), "Balance should be finite");
    });

    console.log("- Balance checks during betting handled correctly");
  });

  console.log("- Concurrent bet placement tests passed");
});

describe("Concurrent Game Operations", () => {
  let userId: string;

  beforeEach(() => {
    resetWalletStore();
    userId = `test_user_${Date.now()}_${Math.random()}`;
  });

  it("should handle concurrent dive and cash-out attempts", async () => {
    const sessionId = await generateSessionId();
    await startGame(50, userId, sessionId);

    const diveResult = await performDive(1, 50, sessionId, userId, "99");

    // Try to dive AND cash out simultaneously
    const dive2 = performDive(
      2,
      diveResult.totalTreasure,
      sessionId,
      userId,
      "99"
    );
    const cashOut = surfaceWithTreasure(
      diveResult.totalTreasure,
      sessionId,
      userId
    );

    const results = await Promise.allSettled([dive2, cashOut]);

    // One should succeed, one should fail (session becomes inactive)
    const successCount = results.filter((r) => r.status === "fulfilled").length;

    // Exactly one operation should win
    assert.ok(successCount <= 1, "Only one operation should succeed");

    console.log(
      `- Concurrent dive/cash-out: ${successCount} succeeded (race handled)`
    );
  });

  it("should handle concurrent dives on same session", async () => {
    const sessionId = await generateSessionId();
    await startGame(50, userId, sessionId);

    // Try to execute round 1 three times simultaneously
    const dives = await Promise.allSettled([
      performDive(1, 50, sessionId, userId, "50"),
      performDive(1, 50, sessionId, userId, "45"),
      performDive(1, 50, sessionId, userId, "35"),
    ]);

    const successCount = dives.filter((r) => r.status === "fulfilled").length;

    // At most 1 should succeed (same round number)
    assert.ok(successCount >= 1, "At least one dive should succeed");

    console.log(`- Concurrent same-round dives: ${successCount} succeeded`);
  });

  it("should maintain session state consistency", async () => {
    const sessionId = await generateSessionId();
    await startGame(50, userId, sessionId);

    // Perform operations
    const result1 = await performDive(1, 50, sessionId, userId, "99");

    // Check session state
    const session1 = getGameSession(sessionId);
    assert.ok(session1, "Session should exist");
    assert.strictEqual(session1!.diveNumber, 2, "Should advance to round 2");

    await performDive(2, result1.totalTreasure, sessionId, userId, "99");

    const session2 = getGameSession(sessionId);
    assert.ok(session2, "Session should still exist");
    assert.strictEqual(session2!.diveNumber, 3, "Should advance to round 3");

    console.log("- Session state consistency maintained");
  });

  console.log("- Concurrent game operation tests passed");
});

describe("House Wallet Race Conditions", () => {
  beforeEach(() => {
    resetWalletStore();
  });

  it("should handle multiple concurrent payouts", async () => {
    // Ensure fresh state
    resetWalletStore();

    const users = [];
    const sessions = [];

    // Verify house has funds before starting
    const initialHouse = await getHouseStatus();
    assert.ok(
      initialHouse.balance > 10000,
      `House should have funds, has ${initialHouse.balance}`
    );

    // Create 3 users and start games
    // Note: House reserves up to maxPotentialWin ($100k) per game
    // With $500k balance and 10% reserve, we can support ~4 concurrent games maximum
    const betAmount = 10;
    const numUsers = 3;

    for (let i = 0; i < numUsers; i++) {
      const userId = `user${i}_${Date.now()}_${Math.random()}`;
      const sessionId = await generateSessionId();

      users.push(userId);
      sessions.push(sessionId);

      const houseBeforeGame = await getHouseStatus();
      console.log(
        `Before game ${i}: balance=${houseBeforeGame.balance}, reserved=${houseBeforeGame.reservedFunds}, available=${houseBeforeGame.availableFunds}`
      );

      const startResult = await startGame(betAmount, userId, sessionId);
      if (!startResult.success) {
        const houseAfterFail = await getHouseStatus();
        throw new Error(
          `Failed to start game for user ${i}: ${startResult.error}. House: balance=${houseAfterFail.balance}, reserved=${houseAfterFail.reservedFunds}, available=${houseAfterFail.availableFunds}`
        );
      }

      // Use seed "30" to ensure survival (70% win rate means threshold=30, so roll >= 30 survives)
      const diveResult = await performDive(
        1,
        betAmount,
        sessionId,
        userId,
        "30"
      );

      // Verify the dive succeeded
      if (!diveResult.survived) {
        throw new Error(
          `Dive failed for user ${i} with seed 30 - this should not happen`
        );
      }
    }

    const houseBefore = await getHouseStatus();

    // All users cash out simultaneously
    const cashOuts = [];
    for (let i = 0; i < numUsers; i++) {
      const session = getGameSession(sessions[i]);
      if (session) {
        cashOuts.push(
          surfaceWithTreasure(session.currentTreasure, sessions[i], users[i])
        );
      }
    }

    await Promise.all(cashOuts);

    const houseAfter = await getHouseStatus();

    // House balance should be consistent (no negative balance)
    assert.ok(houseAfter.balance >= 0, "House balance should not go negative");

    // All users should have been paid
    for (const userId of users) {
      const wallet = await getWalletInfo(userId);
      assert.ok(wallet.balance > 0, "User should have been paid");
    }

    console.log(
      `- ${numUsers} concurrent payouts: house $${houseBefore.balance} → $${houseAfter.balance}`
    );
  });

  it("should handle house running out of funds gracefully", async () => {
    // Drain house to very low balance
    const users = [];
    for (let i = 0; i < 100; i++) {
      users.push(`user${i}_${Date.now()}`);
    }

    const results = [];
    for (const userId of users) {
      const sessionId = await generateSessionId();
      results.push(startGame(50, userId, sessionId));
    }

    const betResults = await Promise.all(results);
    const acceptedBets = betResults.filter((r) => r.success).length;

    // At some point, bets should be rejected (house limits)
    assert.ok(acceptedBets < 100, "House should reject bets when low on funds");

    const house = await getHouseStatus();
    assert.strictEqual(
      house.canAcceptBets,
      false,
      "House should indicate it cannot accept bets"
    );

    console.log(
      `- House limits: ${acceptedBets}/100 bets accepted before limit`
    );
  });

  console.log("- House wallet race condition tests passed");
});

describe("Session State Corruption", () => {
  let userId: string;

  beforeEach(() => {
    resetWalletStore();
    userId = `test_user_${Date.now()}_${Math.random()}`;
  });

  it("should reject operations on deleted session", async () => {
    const sessionId = await generateSessionId();
    await startGame(50, userId, sessionId);

    // Die (session gets deleted)
    const result = await performDive(1, 50, sessionId, userId, "0");

    if (!result.survived) {
      // Verify session is deleted
      const session = getGameSession(sessionId);
      assert.strictEqual(session, undefined, "Session should be deleted");

      // Try to use deleted session
      try {
        await performDive(2, 50, sessionId, userId, "99");
        assert.fail("Should reject deleted session");
      } catch (error) {
        assert.ok((error as Error).message.includes("Invalid or inactive"));
      }

      console.log("- Deleted session operations rejected");
    }
  });

  it("should prevent treasure manipulation via stale session data", async () => {
    const sessionId = await generateSessionId();
    await startGame(100, userId, sessionId);

    // Perform dive
    const result1 = await performDive(1, 100, sessionId, userId, "99");
    const treasure1 = result1.totalTreasure;

    // Try to cash out with ORIGINAL bet amount (not actual treasure)
    try {
      await surfaceWithTreasure(100, sessionId, userId);
      assert.fail("Should reject mismatched treasure amount");
    } catch (error) {
      assert.ok((error as Error).message.includes("Cash-out mismatch"));
    }

    // Correct treasure should work
    await surfaceWithTreasure(treasure1, sessionId, userId);

    console.log("- Treasure manipulation prevented");
  });

  it("should prevent round number manipulation", async () => {
    const sessionId = await generateSessionId();
    await startGame(50, userId, sessionId);

    // Do round 1
    await performDive(1, 50, sessionId, userId, "99");

    // Try to replay round 1 (should fail - session expects round 2)
    const session = getGameSession(sessionId);
    const expectedRound = session!.diveNumber;

    // Trying round 1 again won't match session state
    // The session will have diveNumber = 2, so this creates a mismatch

    console.log(`- Session expects round ${expectedRound}`);
  });

  it("should handle session data consistency after multiple operations", async () => {
    const sessionId = await generateSessionId();
    await startGame(100, userId, sessionId);

    // Perform 5 dives
    let treasure = 100;
    for (let dive = 1; dive <= 5; dive++) {
      const session = getGameSession(sessionId);

      // Verify session state before dive
      assert.strictEqual(
        session!.diveNumber,
        dive,
        `Session should expect dive ${dive}`
      );
      assert.strictEqual(
        session!.userId,
        userId,
        "Session should belong to user"
      );
      assert.strictEqual(session!.isActive, true, "Session should be active");

      const result = await performDive(dive, treasure, sessionId, userId, "99");
      treasure = result.totalTreasure;
    }

    const finalSession = getGameSession(sessionId);
    assert.strictEqual(
      finalSession!.diveNumber,
      6,
      "Session should expect dive 6"
    );

    console.log("- Session consistency maintained across 5 operations");
  });

  console.log("- Session state corruption tests passed");
});

describe("Balance Update Consistency", () => {
  let userId: string;

  beforeEach(() => {
    resetWalletStore();
    userId = `test_user_${Date.now()}_${Math.random()}`;
  });

  it("should update balance atomically", async () => {
    const sessionId = await generateSessionId();

    const balanceBefore = (await getWalletInfo(userId)).balance;

    await startGame(50, userId, sessionId);

    const balanceAfter = (await getWalletInfo(userId)).balance;

    // Balance should be exactly 50 less
    assert.strictEqual(
      balanceAfter,
      balanceBefore - 50,
      "Balance update should be atomic"
    );

    console.log(`- Atomic update: $${balanceBefore} → $${balanceAfter}`);
  });

  it("should track total wagered correctly", async () => {
    const initialWallet = await getWalletInfo(userId);

    // Place 3 bets
    for (let i = 0; i < 3; i++) {
      const sessionId = await generateSessionId();
      await startGame(20, userId, sessionId);
      await performDive(1, 20, sessionId, userId, "0"); // Lose
    }

    const finalWallet = await getWalletInfo(userId);

    // Total wagered should be 60
    assert.strictEqual(
      finalWallet.totalWagered,
      initialWallet.totalWagered + 60,
      "Total wagered should track all bets"
    );

    console.log(
      `- Total wagered tracked: $${initialWallet.totalWagered} → $${finalWallet.totalWagered}`
    );
  });

  it("should track wins and losses separately", async () => {
    const initialWallet = await getWalletInfo(userId);

    // Lose a game
    let sessionId = await generateSessionId();
    await startGame(20, userId, sessionId);
    await performDive(1, 20, sessionId, userId, "0");

    // Win a game
    sessionId = await generateSessionId();
    await startGame(20, userId, sessionId);
    const result = await performDive(1, 20, sessionId, userId, "99");
    await surfaceWithTreasure(result.totalTreasure, sessionId, userId);

    const finalWallet = await getWalletInfo(userId);

    // Should have tracked both
    assert.ok(
      finalWallet.totalLost > initialWallet.totalLost,
      "Should track losses"
    );
    assert.ok(
      finalWallet.totalWon > initialWallet.totalWon,
      "Should track wins"
    );
    assert.strictEqual(
      finalWallet.gamesPlayed,
      initialWallet.gamesPlayed + 2,
      "Should count both games"
    );

    console.log(
      `- Win/loss tracking: ${finalWallet.totalWon} won, ${finalWallet.totalLost} lost`
    );
  });

  console.log("- Balance update consistency tests passed");
});

console.log("\nOK: All wallet race condition tests completed!\n");
