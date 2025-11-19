/**
 * Session Lifecycle & Illegal Sequence Tests
 *
 * Tests the session state machine and prevents illegal operations:
 *
 * Valid sequence:
 *   startGameSession → executeRound (1+) → cashOut OR loss → session ends
 *
 * Invalid sequences (must be rejected):
 *   - Double cashout on same session
 *   - executeRound after cashOut
 *   - executeRound after loss
 *   - cashOut after loss
 *   - executeRound with wrong round number
 *   - Operations on non-existent session
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import {
  startGameSession,
  executeRound,
  cashOut,
} from "../../app/actions/gameEngine";
import {
  resetWalletStore,
  getUserWallet,
  getHouseWallet,
  getGameSession,
  getUserTransactions,
} from "../../lib/walletStore";

describe("Session Lifecycle - Illegal Sequences", () => {
  let userId: string;
  let sessionId: string;

  beforeEach(() => {
    resetWalletStore();
    userId = `test_user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    sessionId = `test_session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  });

  describe("Double Cashout Protection", () => {
    it("should reject second cashout on same session", async () => {
      // Arrange: Setup winning game ready to cash out
      await startGameSession(100, userId, sessionId);

      // Execute one winning round to get some treasure
      const round1 = await executeRound(1, 100, sessionId, userId, "15"); // High roll = win
      assert.strictEqual(round1.survived, true, "Round 1 should succeed");

      const treasureAmount = round1.totalValue;
      assert.ok(treasureAmount > 100, "Should have profit");

      // Capture state before first cashout
      const userBefore = getUserWallet(userId);
      const transactionsBefore = getUserTransactions(userId);

      // Act: First cashout (should succeed)
      const firstCashout = await cashOut(treasureAmount, sessionId, userId);
      assert.strictEqual(
        firstCashout.success,
        true,
        "First cashout should succeed"
      );

      // Capture state after first cashout
      const userAfterFirst = getUserWallet(userId);
      const houseAfterFirst = getHouseWallet();
      const transactionsAfterFirst = getUserTransactions(userId);

      // Verify first cashout worked
      assert.ok(
        userAfterFirst.balance > userBefore.balance,
        "User balance should increase after first cashout"
      );
      assert.ok(
        transactionsAfterFirst.length > transactionsBefore.length,
        "Transaction should be recorded"
      );

      // Act: Second cashout (should fail)
      let secondCashoutError: Error | null = null;
      try {
        await cashOut(treasureAmount, sessionId, userId);
        assert.fail("Second cashout should have thrown an error");
      } catch (error) {
        secondCashoutError = error as Error;
      }

      // Assert: Second cashout rejected
      assert.ok(
        secondCashoutError !== null,
        "Second cashout should throw error"
      );
      assert.ok(
        secondCashoutError!.message.includes("Invalid") ||
          secondCashoutError!.message.includes("inactive"),
        `Error should mention invalid/inactive session: ${secondCashoutError!.message}`
      );

      // Assert: No wallet mutations from second cashout
      const userAfterSecond = getUserWallet(userId);
      const houseAfterSecond = getHouseWallet();
      const transactionsAfterSecond = getUserTransactions(userId);

      assert.strictEqual(
        userAfterSecond.balance,
        userAfterFirst.balance,
        "User balance should not change on second cashout"
      );
      assert.strictEqual(
        houseAfterSecond.balance,
        houseAfterFirst.balance,
        "House balance should not change on second cashout"
      );
      assert.strictEqual(
        transactionsAfterSecond.length,
        transactionsAfterFirst.length,
        "No new transaction should be added"
      );

      console.log("OK: Double cashout correctly rejected");
      console.log(`   First cashout: $${firstCashout.finalAmount}`);
      console.log(
        `   Second cashout: Rejected with "${secondCashoutError!.message}"`
      );
    });

    it("should prevent race condition double cashout", async () => {
      // Arrange: Setup winning game
      await startGameSession(100, userId, sessionId);
      const round1 = await executeRound(1, 100, sessionId, userId, "15");
      const treasureAmount = round1.totalValue;

      // Act: Simulate race condition - two simultaneous cashouts
      const cashoutPromises = [
        cashOut(treasureAmount, sessionId, userId),
        cashOut(treasureAmount, sessionId, userId),
      ];

      const results = await Promise.allSettled(cashoutPromises);

      // Assert: Exactly one should succeed, one should fail
      const successes = results.filter((r) => r.status === "fulfilled");
      const failures = results.filter((r) => r.status === "rejected");

      assert.strictEqual(
        successes.length,
        1,
        "Exactly one cashout should succeed"
      );
      assert.strictEqual(failures.length, 1, "Exactly one cashout should fail");

      // Verify the failure has correct error message
      const failure = failures[0] as PromiseRejectedResult;
      assert.ok(
        failure.reason.message.includes("Invalid") ||
          failure.reason.message.includes("inactive"),
        "Failed cashout should have correct error message"
      );

      console.log("OK: Race condition double cashout prevented");
    });
  });

  describe("executeRound After Cashout", () => {
    it("should reject executeRound after successful cashout", async () => {
      // Arrange: Complete a game with cashout
      await startGameSession(100, userId, sessionId);
      const round1 = await executeRound(1, 100, sessionId, userId, "15");

      assert.ok(round1.survived, "Round 1 should survive with roll 90");
      assert.ok(
        round1.totalValue > 0,
        `totalValue should be > 0, got: ${round1.totalValue}`
      );

      const treasureAmount = round1.totalValue;
      const sessionCheck = getGameSession(sessionId);
      assert.ok(sessionCheck !== undefined, "Session should exist");
      console.log(
        `[DEBUG] Session currentTreasure: ${sessionCheck?.currentTreasure}, treasureAmount: ${treasureAmount}`
      );

      await cashOut(treasureAmount, sessionId, userId);

      // Capture state after cashout
      const userAfterCashout = getUserWallet(userId);
      const houseAfterCashout = getHouseWallet();
      const transactionsAfterCashout = getUserTransactions(userId);

      // Act: Try to execute another round
      let executeRoundError: Error | null = null;
      try {
        await executeRound(2, treasureAmount, sessionId, userId);
        assert.fail("executeRound after cashout should throw error");
      } catch (error) {
        executeRoundError = error as Error;
      }

      // Assert: executeRound rejected
      assert.ok(executeRoundError !== null, "Should throw error");
      assert.ok(
        executeRoundError!.message.includes("Invalid") ||
          executeRoundError!.message.includes("inactive"),
        `Error should mention invalid/inactive session: ${executeRoundError!.message}`
      );

      // Assert: No wallet mutations
      const userAfterAttempt = getUserWallet(userId);
      const houseAfterAttempt = getHouseWallet();
      const transactionsAfterAttempt = getUserTransactions(userId);

      assert.strictEqual(
        userAfterAttempt.balance,
        userAfterCashout.balance,
        "User balance unchanged"
      );
      assert.strictEqual(
        houseAfterAttempt.balance,
        houseAfterCashout.balance,
        "House balance unchanged"
      );
      assert.strictEqual(
        transactionsAfterAttempt.length,
        transactionsAfterCashout.length,
        "No new transactions"
      );

      // Assert: Session is deleted or inactive
      const session = getGameSession(sessionId);
      assert.ok(
        session === undefined || session.isActive === false,
        "Session should be deleted or inactive"
      );

      console.log("OK: executeRound after cashout correctly rejected");
    });

    it("should reject multiple executeRound attempts after cashout", async () => {
      // Arrange
      await startGameSession(100, userId, sessionId);
      const round1 = await executeRound(1, 100, sessionId, userId, "15");
      await cashOut(round1.totalValue, sessionId, userId);

      // Act: Try multiple rounds
      const attemptPromises = [
        executeRound(2, round1.totalValue, sessionId, userId),
        executeRound(3, round1.totalValue, sessionId, userId),
        executeRound(4, round1.totalValue, sessionId, userId),
      ];

      const results = await Promise.allSettled(attemptPromises);

      // Assert: All should fail
      const failures = results.filter((r) => r.status === "rejected");
      assert.strictEqual(
        failures.length,
        3,
        "All executeRound attempts should fail"
      );

      console.log(
        "OK: Multiple executeRound attempts after cashout all rejected"
      );
    });
  });

  describe("executeRound After Loss", () => {
    it("should reject executeRound after player loses", async () => {
      // Arrange: Setup game that will lose
      await startGameSession(100, userId, sessionId);

      // Execute round with low roll to force loss
      const round1 = await executeRound(1, 100, sessionId, userId, "1"); // Low roll = loss
      assert.strictEqual(round1.survived, false, "Should lose on round 1");

      // Capture state after loss
      const userAfterLoss = getUserWallet(userId);
      const houseAfterLoss = getHouseWallet();
      const transactionsAfterLoss = getUserTransactions(userId);

      // Act: Try to execute another round
      let executeRoundError: Error | null = null;
      try {
        await executeRound(2, 100, sessionId, userId);
        assert.fail("executeRound after loss should throw error");
      } catch (error) {
        executeRoundError = error as Error;
      }

      // Assert: executeRound rejected
      assert.ok(executeRoundError !== null, "Should throw error");
      assert.ok(
        executeRoundError!.message.includes("Invalid") ||
          executeRoundError!.message.includes("inactive"),
        `Error should mention invalid/inactive session: ${executeRoundError!.message}`
      );

      // Assert: No wallet mutations
      const userAfterAttempt = getUserWallet(userId);
      const houseAfterAttempt = getHouseWallet();
      const transactionsAfterAttempt = getUserTransactions(userId);

      assert.strictEqual(
        userAfterAttempt.balance,
        userAfterLoss.balance,
        "User balance unchanged"
      );
      assert.strictEqual(
        houseAfterAttempt.balance,
        houseAfterLoss.balance,
        "House balance unchanged"
      );
      assert.strictEqual(
        transactionsAfterAttempt.length,
        transactionsAfterLoss.length,
        "No new transactions"
      );

      // Assert: Session is deleted
      const session = getGameSession(sessionId);
      assert.strictEqual(
        session,
        undefined,
        "Session should be deleted after loss"
      );

      console.log("OK: executeRound after loss correctly rejected");
    });

    it("should handle retry storms after loss gracefully", async () => {
      // Arrange: Lose the game
      await startGameSession(100, userId, sessionId);
      await executeRound(1, 100, sessionId, userId, "1"); // Force loss

      // Act: Simulate retry storm (10 simultaneous retries)
      const retryPromises = Array(10)
        .fill(null)
        .map(() => executeRound(2, 100, sessionId, userId));

      const results = await Promise.allSettled(retryPromises);

      // Assert: All should fail with same error
      const failures = results.filter((r) => r.status === "rejected");
      assert.strictEqual(failures.length, 10, "All retry attempts should fail");

      // Verify all have consistent error messages
      for (const failure of failures) {
        const error = (failure as PromiseRejectedResult).reason;
        assert.ok(
          error.message.includes("Invalid") ||
            error.message.includes("inactive"),
          "Should have consistent error message"
        );
      }

      console.log("OK: Retry storm after loss handled gracefully");
    });
  });

  describe("cashOut After Loss", () => {
    it("should reject cashOut after player loses", async () => {
      // Arrange: Lose the game
      await startGameSession(100, userId, sessionId);
      await executeRound(1, 100, sessionId, userId, "1"); // Force loss

      // Capture state after loss
      const userAfterLoss = getUserWallet(userId);
      const houseAfterLoss = getHouseWallet();

      // Act: Try to cash out
      let cashOutError: Error | null = null;
      try {
        await cashOut(100, sessionId, userId);
        assert.fail("cashOut after loss should throw error");
      } catch (error) {
        cashOutError = error as Error;
      }

      // Assert: cashOut rejected
      assert.ok(cashOutError !== null, "Should throw error");
      assert.ok(
        cashOutError!.message.includes("Invalid") ||
          cashOutError!.message.includes("inactive"),
        "Should mention invalid/inactive session"
      );

      // Assert: No wallet mutations
      const userAfterAttempt = getUserWallet(userId);
      const houseAfterAttempt = getHouseWallet();

      assert.strictEqual(
        userAfterAttempt.balance,
        userAfterLoss.balance,
        "User balance unchanged"
      );
      assert.strictEqual(
        houseAfterAttempt.balance,
        houseAfterLoss.balance,
        "House balance unchanged"
      );

      console.log("OK: cashOut after loss correctly rejected");
    });
  });

  describe("Round Number Sequence Validation", () => {
    it("should reject executeRound with wrong round number", async () => {
      // Arrange: Start game, complete round 1
      await startGameSession(100, userId, sessionId);
      const round1 = await executeRound(1, 100, sessionId, userId, "15");

      // Act: Try to skip to round 3 (should be round 2)
      let wrongRoundError: Error | null = null;
      try {
        await executeRound(3, round1.totalValue, sessionId, userId);
        assert.fail("executeRound with wrong round number should throw");
      } catch (error) {
        wrongRoundError = error as Error;
      }

      // Assert: Error mentions round mismatch
      assert.ok(wrongRoundError !== null, "Should throw error");
      assert.ok(
        wrongRoundError!.message.includes("Round mismatch") ||
          wrongRoundError!.message.includes("Expected round"),
        `Should mention round mismatch: ${wrongRoundError!.message}`
      );

      console.log("OK: Wrong round number correctly rejected");
    });

    it("should reject executeRound with round number going backwards", async () => {
      // Arrange: Complete two rounds
      await startGameSession(100, userId, sessionId);
      const round1 = await executeRound(1, 100, sessionId, userId, "15");
      await executeRound(2, round1.totalValue, sessionId, userId, "15");

      // Act: Try to go back to round 1
      let backwardsRoundError: Error | null = null;
      try {
        await executeRound(1, 100, sessionId, userId);
        assert.fail("executeRound going backwards should throw");
      } catch (error) {
        backwardsRoundError = error as Error;
      }

      // Assert: Error
      assert.ok(backwardsRoundError !== null, "Should throw error");
      assert.ok(
        backwardsRoundError!.message.includes("Round mismatch"),
        "Should mention round mismatch"
      );

      console.log("OK: Backwards round number correctly rejected");
    });
  });

  describe("Operations on Non-Existent Session", () => {
    it("should reject executeRound on non-existent session", async () => {
      const fakeSessionId = "non_existent_session";

      let error: Error | null = null;
      try {
        await executeRound(1, 100, fakeSessionId, userId);
        assert.fail("Should throw error");
      } catch (e) {
        error = e as Error;
      }

      assert.ok(error !== null, "Should throw error");
      assert.ok(
        error!.message.includes("Invalid") ||
          error!.message.includes("inactive"),
        "Should mention invalid session"
      );

      console.log("OK: Non-existent session correctly rejected");
    });

    it("should reject cashOut on non-existent session", async () => {
      const fakeSessionId = "non_existent_session";

      let error: Error | null = null;
      try {
        await cashOut(100, fakeSessionId, userId);
        assert.fail("Should throw error");
      } catch (e) {
        error = e as Error;
      }

      assert.ok(error !== null, "Should throw error");
      assert.ok(
        error!.message.includes("Invalid") ||
          error!.message.includes("inactive"),
        "Should mention invalid session"
      );

      console.log("OK: Non-existent session cashOut correctly rejected");
    });
  });

  describe("Session State Consistency", () => {
    it("should maintain transaction log integrity across illegal operations", async () => {
      // Arrange: Complete valid game
      await startGameSession(100, userId, sessionId);
      const round1 = await executeRound(1, 100, sessionId, userId, "15");
      await cashOut(round1.totalValue, sessionId, userId);

      const validTransactionCount = getUserTransactions(userId).length;

      // Act: Try multiple illegal operations
      const illegalOps = [
        executeRound(2, round1.totalValue, sessionId, userId).catch(() => null),
        cashOut(round1.totalValue, sessionId, userId).catch(() => null),
        executeRound(3, 200, sessionId, userId).catch(() => null),
      ];

      await Promise.all(illegalOps);

      // Assert: Transaction count unchanged
      assert.strictEqual(
        getUserTransactions(userId).length,
        validTransactionCount,
        "No spurious transactions added"
      );

      console.log("OK: Transaction log integrity maintained");
    });

    it("should prevent session resurrection after deletion", async () => {
      // Arrange: Lose game (session deleted)
      await startGameSession(100, userId, sessionId);
      await executeRound(1, 100, sessionId, userId, "1"); // Loss

      // Verify session deleted
      assert.strictEqual(
        getGameSession(sessionId),
        undefined,
        "Session should be deleted"
      );

      // Act: Try various operations that might "resurrect" session
      const resurrectAttempts = [
        executeRound(1, 100, sessionId, userId).catch(() => "failed"),
        cashOut(100, sessionId, userId).catch(() => "failed"),
      ];

      const results = await Promise.all(resurrectAttempts);

      // Assert: All failed, session still deleted
      assert.ok(
        results.every((r) => r === "failed"),
        "All resurrection attempts should fail"
      );
      assert.strictEqual(
        getGameSession(sessionId),
        undefined,
        "Session should still be deleted"
      );

      console.log("OK: Session resurrection prevented");
    });
  });
});

console.log("OK: Session lifecycle tests defined");
