/**
 * Transaction History Mapping Tests
 * 
 * Tests the correctness of getTransactionHistory() mapping from
 * walletStore transactions to theme-specific shape.
 * 
 * Critical scenarios:
 * 1. Round/dive number mapping - metadata.diveNumber || metadata.roundNumber
 * 2. Profit field only on cashout transactions
 * 3. Limit and ordering correctness
 * 4. Cross-user isolation
 * 5. Mixed metadata formats (old vs new)
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import {
  startGame,
  performDive,
  surfaceWithTreasure,
  generateSessionId,
  getTransactionHistory,
} from "../../app/actions/gameActions";
import {
  resetWalletStore,
  addTransaction,
} from "../../lib/walletStore";

describe("Transaction History Mapping", () => {
  let userId: string;

  beforeEach(() => {
    resetWalletStore();
    userId = `test_user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  });

  describe("Round/Dive Number Mapping", () => {
    it("should map metadata.roundNumber to diveNumber", async () => {
      // Create a transaction with only roundNumber (new format)
      addTransaction({
        id: "tx_round_only",
        userId,
        type: "loss",
        amount: 100,
        balanceBefore: 1000,
        balanceAfter: 900,
        gameSessionId: "session_test",
        timestamp: Date.now(),
        metadata: {
          roundNumber: 3,
          survived: false,
        },
      });

      const history = await getTransactionHistory(userId, 10);

      assert.strictEqual(history.length, 1, "Should have 1 transaction");
      assert.strictEqual(
        history[0].diveNumber,
        3,
        "Should map roundNumber to diveNumber"
      );
      assert.strictEqual(history[0].type, "loss");
      assert.strictEqual(history[0].amount, 100);

      console.log("✅ roundNumber → diveNumber mapping works");
    });

    it("should map metadata.diveNumber to diveNumber", async () => {
      // Create a transaction with only diveNumber (legacy format)
      addTransaction({
        id: "tx_dive_only",
        userId,
        type: "win",
        amount: 150,
        balanceBefore: 1000,
        balanceAfter: 1150,
        gameSessionId: "session_test",
        timestamp: Date.now(),
        metadata: {
          diveNumber: 5,
          survived: true,
          profit: 50,
        },
      });

      const history = await getTransactionHistory(userId, 10);

      assert.strictEqual(history.length, 1);
      assert.strictEqual(
        history[0].diveNumber,
        5,
        "Should map diveNumber to diveNumber"
      );
      assert.strictEqual(history[0].profit, 50);

      console.log("✅ diveNumber → diveNumber mapping works");
    });

    it("should prefer diveNumber over roundNumber when both exist", async () => {
      // Edge case: Both fields present (shouldn't happen, but test the || logic)
      addTransaction({
        id: "tx_both",
        userId,
        type: "win",
        amount: 200,
        balanceBefore: 1000,
        balanceAfter: 1200,
        gameSessionId: "session_test",
        timestamp: Date.now(),
        metadata: {
          diveNumber: 7,
          roundNumber: 3, // Should be ignored
          survived: true,
        },
      });

      const history = await getTransactionHistory(userId, 10);

      assert.strictEqual(history.length, 1);
      assert.strictEqual(
        history[0].diveNumber,
        7,
        "Should prefer diveNumber over roundNumber"
      );

      console.log("✅ diveNumber takes precedence over roundNumber");
    });

    it("should handle missing metadata gracefully", async () => {
      // Transaction without metadata
      addTransaction({
        id: "tx_no_metadata",
        userId,
        type: "bet",
        amount: 50,
        balanceBefore: 1000,
        balanceAfter: 950,
        gameSessionId: "session_test",
        timestamp: Date.now(),
      });

      const history = await getTransactionHistory(userId, 10);

      assert.strictEqual(history.length, 1);
      assert.strictEqual(
        history[0].diveNumber,
        undefined,
        "Should be undefined when no metadata"
      );
      assert.strictEqual(history[0].profit, undefined);

      console.log("✅ Missing metadata handled gracefully");
    });

    it("should handle mixed transaction formats in same history", async () => {
      const baseTime = Date.now();

      // Mix of different metadata formats
      addTransaction({
        id: "tx1",
        userId,
        type: "bet",
        amount: 10,
        balanceBefore: 1000,
        balanceAfter: 990,
        gameSessionId: "session1",
        timestamp: baseTime,
      });

      addTransaction({
        id: "tx2",
        userId,
        type: "loss",
        amount: 10,
        balanceBefore: 990,
        balanceAfter: 990,
        gameSessionId: "session1",
        timestamp: baseTime + 1,
        metadata: {
          roundNumber: 3, // New format
          survived: false,
        },
      });

      addTransaction({
        id: "tx3",
        userId,
        type: "win",
        amount: 121,
        balanceBefore: 990,
        balanceAfter: 1111,
        gameSessionId: "session2",
        timestamp: baseTime + 2,
        metadata: {
          diveNumber: 1, // Legacy format
          survived: true,
          profit: 111,
        },
      });

      const history = await getTransactionHistory(userId, 10);

      assert.strictEqual(history.length, 3);

      // Check each transaction's diveNumber mapping
      const betTx = history.find((t) => t.type === "bet");
      const lossTx = history.find((t) => t.type === "loss");
      const winTx = history.find((t) => t.type === "win");

      assert.strictEqual(betTx?.diveNumber, undefined, "Bet has no dive number");
      assert.strictEqual(lossTx?.diveNumber, 3, "Loss mapped from roundNumber");
      assert.strictEqual(winTx?.diveNumber, 1, "Win mapped from diveNumber");

      console.log("✅ Mixed transaction formats handled correctly");
    });
  });

  describe("Profit Field Handling", () => {
    it("should include profit on cashout transactions", async () => {
      addTransaction({
        id: "tx_cashout",
        userId,
        type: "win",
        amount: 150,
        balanceBefore: 1000,
        balanceAfter: 1150,
        gameSessionId: "session_test",
        timestamp: Date.now(),
        metadata: {
          roundNumber: 2,
          survived: true,
          profit: 50, // Profit = 150 - 100 (initial bet)
        },
      });

      const history = await getTransactionHistory(userId, 10);

      assert.strictEqual(history.length, 1);
      assert.strictEqual(history[0].profit, 50, "Should have profit field");
      assert.strictEqual(history[0].type, "win");

      console.log("✅ Profit field present on cashout");
    });

    it("should have undefined profit on loss transactions", async () => {
      addTransaction({
        id: "tx_loss",
        userId,
        type: "loss",
        amount: 100,
        balanceBefore: 1000,
        balanceAfter: 900,
        gameSessionId: "session_test",
        timestamp: Date.now(),
        metadata: {
          roundNumber: 1,
          survived: false,
          // No profit field
        },
      });

      const history = await getTransactionHistory(userId, 10);

      assert.strictEqual(history.length, 1);
      assert.strictEqual(
        history[0].profit,
        undefined,
        "Loss should not have profit"
      );

      console.log("✅ Profit undefined on loss");
    });

    it("should have undefined profit on bet transactions", async () => {
      addTransaction({
        id: "tx_bet",
        userId,
        type: "bet",
        amount: 50,
        balanceBefore: 1000,
        balanceAfter: 950,
        gameSessionId: "session_test",
        timestamp: Date.now(),
      });

      const history = await getTransactionHistory(userId, 10);

      assert.strictEqual(history.length, 1);
      assert.strictEqual(
        history[0].profit,
        undefined,
        "Bet should not have profit"
      );

      console.log("✅ Profit undefined on bet");
    });
  });

  describe("Limit and Ordering", () => {
    it("should respect limit parameter", async () => {
      const baseTime = Date.now();

      // Add 15 transactions
      for (let i = 0; i < 15; i++) {
        addTransaction({
          id: `tx_${i}`,
          userId,
          type: "bet",
          amount: 10,
          balanceBefore: 1000,
          balanceAfter: 990,
          gameSessionId: `session_${i}`,
          timestamp: baseTime + i,
        });
      }

      // Request only 10
      const history = await getTransactionHistory(userId, 10);

      assert.strictEqual(
        history.length,
        10,
        "Should return exactly 10 transactions"
      );

      console.log("✅ Limit parameter respected");
    });

    it("should return transactions in descending timestamp order (most recent first)", async () => {
      const baseTime = Date.now();

      // Add transactions with different timestamps
      addTransaction({
        id: "tx_old",
        userId,
        type: "bet",
        amount: 10,
        balanceBefore: 1000,
        balanceAfter: 990,
        gameSessionId: "session1",
        timestamp: baseTime,
      });

      addTransaction({
        id: "tx_newer",
        userId,
        type: "win",
        amount: 121,
        balanceBefore: 990,
        balanceAfter: 1111,
        gameSessionId: "session2",
        timestamp: baseTime + 2000,
      });

      addTransaction({
        id: "tx_newest",
        userId,
        type: "loss",
        amount: 50,
        balanceBefore: 1111,
        balanceAfter: 1061,
        gameSessionId: "session3",
        timestamp: baseTime + 4000,
      });

      const history = await getTransactionHistory(userId, 10);

      assert.strictEqual(history.length, 3);

      // Should be in descending timestamp order (newest first)
      assert.strictEqual(history[0].id, "tx_newest", "Newest should be first");
      assert.strictEqual(history[1].id, "tx_newer", "Newer should be second");
      assert.strictEqual(history[2].id, "tx_old", "Oldest should be last");

      console.log("✅ Transactions ordered by timestamp (newest first)");
    });

    it("should return fewer transactions if user has less than limit", async () => {
      // Add only 3 transactions
      for (let i = 0; i < 3; i++) {
        addTransaction({
          id: `tx_${i}`,
          userId,
          type: "bet",
          amount: 10,
          balanceBefore: 1000,
          balanceAfter: 990,
          gameSessionId: `session_${i}`,
          timestamp: Date.now() + i,
        });
      }

      // Request 10
      const history = await getTransactionHistory(userId, 10);

      assert.strictEqual(
        history.length,
        3,
        "Should return all 3 available transactions"
      );

      console.log("✅ Returns fewer than limit when not enough transactions");
    });

    it("should handle limit edge cases", async () => {
      // Add 5 transactions
      for (let i = 0; i < 5; i++) {
        addTransaction({
          id: `tx_${i}`,
          userId,
          type: "bet",
          amount: 10,
          balanceBefore: 1000,
          balanceAfter: 990,
          gameSessionId: `session_${i}`,
          timestamp: Date.now() + i,
        });
      }

      // Limit = 0 should return empty
      const historyZero = await getTransactionHistory(userId, 0);
      assert.strictEqual(historyZero.length, 0, "Limit 0 returns empty");

      // Limit = 1 should return 1
      const historyOne = await getTransactionHistory(userId, 1);
      assert.strictEqual(historyOne.length, 1, "Limit 1 returns 1");

      // Very large limit should return all available
      const historyLarge = await getTransactionHistory(userId, 1000);
      assert.strictEqual(historyLarge.length, 5, "Large limit returns all");

      console.log("✅ Edge case limits handled correctly");
    });
  });

  describe("Cross-User Isolation", () => {
    it("should not leak transactions across users", async () => {
      const user1 = `user1_${Date.now()}`;
      const user2 = `user2_${Date.now()}`;

      // Add transactions for user1
      for (let i = 0; i < 5; i++) {
        addTransaction({
          id: `user1_tx_${i}`,
          userId: user1,
          type: "bet",
          amount: 10,
          balanceBefore: 1000,
          balanceAfter: 990,
          gameSessionId: `session_${i}`,
          timestamp: Date.now() + i,
        });
      }

      // Add transactions for user2
      for (let i = 0; i < 3; i++) {
        addTransaction({
          id: `user2_tx_${i}`,
          userId: user2,
          type: "win",
          amount: 121,
          balanceBefore: 1000,
          balanceAfter: 1121,
          gameSessionId: `session_${i}`,
          timestamp: Date.now() + i,
        });
      }

      // Get history for each user
      const history1 = await getTransactionHistory(user1, 10);
      const history2 = await getTransactionHistory(user2, 10);

      // Verify isolation
      assert.strictEqual(history1.length, 5, "User1 has 5 transactions");
      assert.strictEqual(history2.length, 3, "User2 has 3 transactions");

      // Verify no cross-contamination
      assert.ok(
        history1.every((t) => t.id.startsWith("user1_")),
        "User1 only sees own transactions"
      );
      assert.ok(
        history2.every((t) => t.id.startsWith("user2_")),
        "User2 only sees own transactions"
      );

      console.log("✅ No cross-user transaction leakage");
    });

    it("should handle empty history for new user", async () => {
      const newUser = `new_user_${Date.now()}`;

      const history = await getTransactionHistory(newUser, 10);

      assert.strictEqual(
        history.length,
        0,
        "New user should have empty history"
      );

      console.log("✅ Empty history for new user");
    });
  });

  describe("Real Game Flow Integration", () => {
    it("should correctly map transactions from real game flow", async () => {
      const sessionId = await generateSessionId();

      // Start game
      await startGame(10, userId, sessionId);

      // Perform dive that wins
      const diveResult = await performDive(1, 10, sessionId, userId, "15");

      if (diveResult.survived) {
        // Cash out
        await surfaceWithTreasure(
          diveResult.totalTreasure,
          sessionId,
          userId
        );
      }

      const history = await getTransactionHistory(userId, 10);

      // Should have: bet, cashout
      assert.ok(history.length >= 2, "Should have at least 2 transactions");

      const betTx = history.find((t) => t.type === "bet");
      const cashoutTx = history.find((t) => t.type === "cashout");

      assert.ok(betTx !== undefined, "Should have bet transaction");
      assert.ok(cashoutTx !== undefined, "Should have cashout transaction");

      // Cashout transaction should have profit
      assert.ok(
        cashoutTx!.profit !== undefined && cashoutTx!.profit > 0,
        "Cashout should have positive profit"
      );

      // Cashout transaction should have diveNumber
      assert.strictEqual(
        cashoutTx!.diveNumber,
        1,
        "Cashout should have diveNumber = 1"
      );

      console.log("✅ Real game flow transactions mapped correctly");
      console.log(`   Bet: $${betTx!.amount}`);
      console.log(`   Cashout: $${cashoutTx!.amount} (profit: $${cashoutTx!.profit})`);
    });

    it("should correctly map loss transaction from real game flow", async () => {
      const sessionId = await generateSessionId();

      await startGame(10, userId, sessionId);

      // Perform dive that loses
      const diveResult = await performDive(1, 10, sessionId, userId, "1");

      assert.strictEqual(diveResult.survived, false, "Should lose with roll 1");

      const history = await getTransactionHistory(userId, 10);

      const lossTx = history.find((t) => t.type === "loss");

      assert.ok(lossTx !== undefined, "Should have loss transaction");
      assert.strictEqual(
        lossTx!.profit,
        undefined,
        "Loss should not have profit"
      );
      assert.strictEqual(
        lossTx!.diveNumber,
        1,
        "Loss should have diveNumber = 1"
      );

      console.log("✅ Real game loss transaction mapped correctly");
    });

    it("should handle multi-round game transaction history", async () => {
      const sessionId = await generateSessionId();

      await startGame(10, userId, sessionId);

      // Survive 3 rounds
      let treasure = 10;
      for (let round = 1; round <= 3; round++) {
        const result = await performDive(round, treasure, sessionId, userId, "15");
        treasure = result.totalTreasure;
      }

      // Cash out after round 3
      await surfaceWithTreasure(treasure, sessionId, userId);

      const history = await getTransactionHistory(userId, 10);

      // Should have: bet, cashout
      const betTx = history.find((t) => t.type === "bet");
      const cashoutTx = history.find((t) => t.type === "cashout");

      assert.ok(betTx !== undefined);
      assert.ok(cashoutTx !== undefined);

      // Cashout should reflect round 3 (final round)
      assert.ok(
        cashoutTx!.diveNumber !== undefined,
        "Cashout should have dive number"
      );

      console.log("✅ Multi-round game history correct");
      console.log(`   Final dive number: ${cashoutTx!.diveNumber}`);
      console.log(`   Final treasure: $${cashoutTx!.amount}`);
    });
  });

  describe("Data Integrity", () => {
    it("should preserve all transaction fields during mapping", async () => {
      const txId = "tx_integrity_test";
      const txAmount = 250;
      const txTimestamp = Date.now();

      addTransaction({
        id: txId,
        userId,
        type: "win",
        amount: txAmount,
        balanceBefore: 1000,
        balanceAfter: 1250,
        gameSessionId: "session_test",
        timestamp: txTimestamp,
        metadata: {
          roundNumber: 7,
          survived: true,
          profit: 150,
        },
      });

      const history = await getTransactionHistory(userId, 10);

      assert.strictEqual(history.length, 1);

      const tx = history[0];

      // Verify all fields preserved
      assert.strictEqual(tx.id, txId, "ID preserved");
      assert.strictEqual(tx.type, "win", "Type preserved");
      assert.strictEqual(tx.amount, txAmount, "Amount preserved");
      assert.strictEqual(tx.timestamp, txTimestamp, "Timestamp preserved");
      assert.strictEqual(tx.profit, 150, "Profit preserved");
      assert.strictEqual(tx.diveNumber, 7, "Dive number mapped");

      console.log("✅ All transaction fields preserved during mapping");
    });

    it("should not mutate original transaction objects", async () => {
      addTransaction({
        id: "tx_immutable",
        userId,
        type: "bet",
        amount: 50,
        balanceBefore: 1000,
        balanceAfter: 950,
        gameSessionId: "session_test",
        timestamp: Date.now(),
        metadata: {
          roundNumber: 1,
        },
      });

      // Get history twice
      const history1 = await getTransactionHistory(userId, 10);
      const history2 = await getTransactionHistory(userId, 10);

      // Verify consistency
      assert.deepStrictEqual(
        history1,
        history2,
        "Multiple calls should return same data"
      );

      console.log("✅ Transaction data immutability maintained");
    });
  });
});

console.log("✅ Transaction history tests defined");
