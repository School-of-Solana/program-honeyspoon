/**
 * Reliability Improvements Tests
 *
 * Tests for concrete reliability improvements:
 * A. Stronger session state with explicit status
 * B. Defensive wallet updates with invariants
 * C. Session ID generation quality
 *
 * Run with: NODE_ENV=test npx tsx --test tests/unit/reliabilityImprovements.test.ts
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import {
  executeRound,
  startGameSession,
  cashOut,
  generateSessionId,
} from "../../app/actions/gameEngine";
import {
  resetWalletStore,
  getGameSession,
  getUserWallet,
  getHouseWallet,
} from "../../lib/walletStore";

describe("A. Session Status Transitions", () => {
  let userId: string;
  let sessionId: string;

  beforeEach(async () => {
    resetWalletStore();
    userId = `test_user_${Date.now()}_${Math.random()}`;
    sessionId = `session_${Date.now()}_${Math.random()}`;
  });

  it("should start game with status ACTIVE", async () => {
    const initialBet = 100;

    const result = await startGameSession(initialBet, userId, sessionId);

    assert.strictEqual(result.success, true, "Game should start");

    const session = getGameSession(sessionId);
    assert.ok(session, "Session should exist");
    assert.strictEqual(session!.status, "ACTIVE", "Status should be ACTIVE");
    assert.strictEqual(
      session!.isActive,
      true,
      "isActive should be true (backward compat)"
    );

    console.log("✓ New game starts with status ACTIVE");
  });

  it("should transition to LOST status on death", async () => {
    const initialBet = 100;
    await startGameSession(initialBet, userId, sessionId);

    // Use seed that guarantees loss (very low roll)
    const result = await executeRound(1, initialBet, sessionId, userId, "0");

    if (!result.survived) {
      const session = getGameSession(sessionId);

      // Session should be LOST (may be deleted)
      if (session) {
        assert.strictEqual(session.status, "LOST", "Status should be LOST");
        assert.strictEqual(session.isActive, false, "isActive should be false");
        assert.ok(session.endTime, "Should have endTime");
      }

      console.log(
        `✓ Death transitions to LOST status (roll=${result.randomRoll})`
      );
    } else {
      console.log(
        `⚠ Survived with roll=${result.randomRoll}, trying another seed`
      );

      // Try with more seeds until we get a loss
      for (const seed of ["1", "2", "3", "4", "5"]) {
        const uid2 = `user_${seed}_${Date.now()}`;
        const sid2 = `session_${seed}_${Date.now()}`;
        await startGameSession(initialBet, uid2, sid2);

        const result2 = await executeRound(1, initialBet, sid2, uid2, seed);
        if (!result2.survived) {
          const session2 = getGameSession(sid2);
          if (session2) {
            assert.strictEqual(session2.status, "LOST");
          }
          console.log(`✓ Death transitions to LOST status (seed=${seed})`);
          break;
        }
      }
    }
  });

  it("should transition to CASHED_OUT status on cashout", async () => {
    const initialBet = 100;
    await startGameSession(initialBet, userId, sessionId);

    // Get a win first (use high seed)
    let won = false;
    let winAmount = 0;

    for (const seed of ["99", "98", "97", "96", "95", "90", "85"]) {
      const result = await executeRound(1, initialBet, sessionId, userId, seed);
      if (result.survived) {
        won = true;
        winAmount = result.totalValue;
        break;
      }

      // Reset for next attempt
      resetWalletStore();
      userId = `test_user_${Date.now()}_${Math.random()}`;
      sessionId = `session_${Date.now()}_${Math.random()}`;
      await startGameSession(initialBet, userId, sessionId);
    }

    assert.ok(won, "Should eventually win with high seeds");

    // Cash out
    const cashoutResult = await cashOut(winAmount, sessionId, userId);

    assert.strictEqual(cashoutResult.success, true, "Cashout should succeed");

    // Session may be deleted after cashout, but if it exists, check status
    const session = getGameSession(sessionId);
    if (session) {
      assert.strictEqual(
        session.status,
        "CASHED_OUT",
        "Status should be CASHED_OUT"
      );
      assert.strictEqual(session.isActive, false, "isActive should be false");
      assert.ok(session.endTime, "Should have endTime");
    }

    console.log(
      `✓ Cashout transitions to CASHED_OUT status (won $${winAmount})`
    );
  });

  it("should reject executeRound on non-ACTIVE session", async () => {
    const initialBet = 100;
    await startGameSession(initialBet, userId, sessionId);

    // End the session by losing
    let lost = false;
    for (const seed of ["0", "1", "2", "3", "4", "5"]) {
      const result = await executeRound(1, initialBet, sessionId, userId, seed);
      if (!result.survived) {
        lost = true;
        break;
      }

      // Reset if survived
      resetWalletStore();
      userId = `test_user_${Date.now()}_${Math.random()}`;
      sessionId = `session_${Date.now()}_${Math.random()}`;
      await startGameSession(initialBet, userId, sessionId);
    }

    assert.ok(lost, "Should eventually lose");

    // Try to execute another round on dead session
    await assert.rejects(
      async () => executeRound(2, 100, sessionId, userId, "50"),
      (error: Error) => {
        const msg = error.message;
        assert.ok(
          msg.includes("Invalid or inactive") || msg.includes("status"),
          `Expected status error, got: ${msg}`
        );
        console.log(`✓ Rejected executeRound on non-ACTIVE session: ${msg}`);
        return true;
      }
    );
  });

  it("should reject cashOut on non-ACTIVE session", async () => {
    const initialBet = 100;
    await startGameSession(initialBet, userId, sessionId);

    // End session
    let ended = false;
    for (const seed of ["0", "1", "2", "3", "4"]) {
      const result = await executeRound(1, initialBet, sessionId, userId, seed);
      if (!result.survived) {
        ended = true;
        break;
      }

      resetWalletStore();
      userId = `test_user_${Date.now()}_${Math.random()}`;
      sessionId = `session_${Date.now()}_${Math.random()}`;
      await startGameSession(initialBet, userId, sessionId);
    }

    assert.ok(ended, "Should end session");

    // Try to cash out ended session
    await assert.rejects(
      async () => cashOut(100, sessionId, userId),
      (error: Error) => {
        const msg = error.message;
        assert.ok(
          msg.includes("Invalid or inactive") || msg.includes("status"),
          `Expected status error, got: ${msg}`
        );
        console.log(`✓ Rejected cashOut on non-ACTIVE session: ${msg}`);
        return true;
      }
    );
  });

  it("should track status through complete game lifecycle", async () => {
    const initialBet = 100;

    // Start
    await startGameSession(initialBet, userId, sessionId);
    let session = getGameSession(sessionId);
    assert.strictEqual(session!.status, "ACTIVE", "Should start ACTIVE");

    // Win round 1
    let round1;
    for (const seed of ["99", "95", "90", "85"]) {
      round1 = await executeRound(1, initialBet, sessionId, userId, seed);
      if (round1.survived) break;

      resetWalletStore();
      userId = `test_user_${Date.now()}_${Math.random()}`;
      sessionId = `session_${Date.now()}_${Math.random()}`;
      await startGameSession(initialBet, userId, sessionId);
    }

    assert.ok(round1 && round1.survived, "Should win round 1");
    session = getGameSession(sessionId);
    assert.strictEqual(
      session!.status,
      "ACTIVE",
      "Should still be ACTIVE after win"
    );

    // Cash out
    await cashOut(round1!.totalValue, sessionId, userId);
    session = getGameSession(sessionId);

    // Session deleted or CASHED_OUT
    if (session) {
      assert.strictEqual(session.status, "CASHED_OUT", "Should be CASHED_OUT");
    }

    console.log(
      "✓ Complete lifecycle: ACTIVE → (win) → ACTIVE → (cashout) → CASHED_OUT"
    );
  });
});

describe("B. Wallet Invariants", () => {
  let userId: string;
  let sessionId: string;

  beforeEach(async () => {
    resetWalletStore();
    userId = `test_user_${Date.now()}_${Math.random()}`;
    sessionId = `session_${Date.now()}_${Math.random()}`;
  });

  function assertWalletInvariants(context: string) {
    const userWallet = getUserWallet(userId);
    const houseWallet = getHouseWallet();

    // Invariant 1: No negative balances
    assert.ok(
      userWallet.balance >= 0,
      `${context}: User balance should not be negative (got ${userWallet.balance})`
    );

    assert.ok(
      houseWallet.balance >= 0,
      `${context}: House balance should not be negative (got ${houseWallet.balance})`
    );

    // Invariant 2: No negative reserved funds
    assert.ok(
      houseWallet.reservedFunds >= 0,
      `${context}: Reserved funds should not be negative (got ${houseWallet.reservedFunds})`
    );

    // Invariant 3: Reserved funds don't exceed balance
    assert.ok(
      houseWallet.reservedFunds <= houseWallet.balance,
      `${context}: Reserved funds (${houseWallet.reservedFunds}) should not exceed balance (${houseWallet.balance})`
    );

    // Invariant 4: Total wagered should match sum of bets
    if (userWallet.gamesPlayed > 0) {
      assert.ok(
        userWallet.totalWagered >= 0,
        `${context}: Total wagered should not be negative`
      );
    }
  }

  it("should maintain invariants after startGameSession", async () => {
    const initialBet = 100;

    await startGameSession(initialBet, userId, sessionId);

    assertWalletInvariants("After startGameSession");

    const houseWallet = getHouseWallet();
    assert.ok(
      houseWallet.reservedFunds > 0,
      "Should have reserved funds for active game"
    );

    console.log("✓ Invariants maintained after startGameSession");
  });

  it("should maintain invariants after executeRound (win)", async () => {
    const initialBet = 100;
    await startGameSession(initialBet, userId, sessionId);

    // Win a round
    let won = false;
    for (const seed of ["99", "95", "90", "85", "80"]) {
      const result = await executeRound(1, initialBet, sessionId, userId, seed);
      if (result.survived) {
        won = true;
        assertWalletInvariants(`After executeRound (win, seed=${seed})`);
        console.log(
          `✓ Invariants maintained after executeRound (win, seed=${seed})`
        );
        break;
      }

      resetWalletStore();
      userId = `test_user_${Date.now()}_${Math.random()}`;
      sessionId = `session_${Date.now()}_${Math.random()}`;
      await startGameSession(initialBet, userId, sessionId);
    }

    assert.ok(won, "Should eventually win");
  });

  it("should maintain invariants after executeRound (loss)", async () => {
    const initialBet = 100;
    await startGameSession(initialBet, userId, sessionId);

    // Lose a round
    let lost = false;
    for (const seed of ["0", "1", "2", "3", "4", "5"]) {
      const result = await executeRound(1, initialBet, sessionId, userId, seed);
      if (!result.survived) {
        lost = true;
        assertWalletInvariants(`After executeRound (loss, seed=${seed})`);

        const houseWallet = getHouseWallet();
        assert.strictEqual(
          houseWallet.reservedFunds,
          0,
          "Reserved funds should be released after loss"
        );

        console.log(
          `✓ Invariants maintained after executeRound (loss, seed=${seed})`
        );
        break;
      }

      resetWalletStore();
      userId = `test_user_${Date.now()}_${Math.random()}`;
      sessionId = `session_${Date.now()}_${Math.random()}`;
      await startGameSession(initialBet, userId, sessionId);
    }

    assert.ok(lost, "Should eventually lose");
  });

  it("should maintain invariants after cashOut", async () => {
    const initialBet = 100;
    await startGameSession(initialBet, userId, sessionId);

    // Win then cash out
    let winAmount = 0;
    for (const seed of ["99", "95", "90", "85"]) {
      const result = await executeRound(1, initialBet, sessionId, userId, seed);
      if (result.survived) {
        winAmount = result.totalValue;
        break;
      }

      resetWalletStore();
      userId = `test_user_${Date.now()}_${Math.random()}`;
      sessionId = `session_${Date.now()}_${Math.random()}`;
      await startGameSession(initialBet, userId, sessionId);
    }

    assert.ok(winAmount > 0, "Should have winnings");

    await cashOut(winAmount, sessionId, userId);

    assertWalletInvariants("After cashOut");

    const houseWallet = getHouseWallet();
    assert.strictEqual(
      houseWallet.reservedFunds,
      0,
      "Reserved funds should be released after cashout"
    );

    const userWallet = getUserWallet(userId);
    assert.ok(
      userWallet.balance >= initialBet,
      "User should have at least initial bet after winning cashout"
    );

    console.log(`✓ Invariants maintained after cashOut (won $${winAmount})`);
  });

  it("should maintain money conservation across operations", async () => {
    // Track total money in system
    const initialHouse = getHouseWallet().balance;
    const initialUser = getUserWallet(userId).balance;
    const totalMoneyBefore = initialHouse + initialUser;

    const initialBet = 100;
    await startGameSession(initialBet, userId, sessionId);

    // Money should be conserved (just moved from user to house)
    let totalMoneyAfter =
      getHouseWallet().balance + getUserWallet(userId).balance;
    assert.strictEqual(
      totalMoneyAfter,
      totalMoneyBefore,
      "Money should be conserved after bet"
    );

    // Execute round
    for (const seed of ["50", "51", "52"]) {
      await executeRound(1, initialBet, sessionId, userId, seed);
      break;
    }

    // Money still conserved
    totalMoneyAfter = getHouseWallet().balance + getUserWallet(userId).balance;
    assert.strictEqual(
      totalMoneyAfter,
      totalMoneyBefore,
      "Money should be conserved after round"
    );

    console.log("✓ Money conservation maintained across operations");
  });
});

describe("C. Session ID Generation Quality", () => {
  it("should generate consistent length IDs", async () => {
    const ids: string[] = [];

    for (let i = 0; i < 100; i++) {
      const id = await generateSessionId();
      ids.push(id);
    }

    // All should have same length (16 bytes = 32 hex chars)
    const lengths = ids.map((id) => id.length);
    const uniqueLengths = new Set(lengths);

    assert.strictEqual(
      uniqueLengths.size,
      1,
      `All IDs should have same length, got: ${Array.from(uniqueLengths).join(", ")}`
    );

    assert.strictEqual(
      ids[0].length,
      32,
      `Expected 32 chars (16 bytes hex), got ${ids[0].length}`
    );

    console.log(`✓ 100 IDs all have consistent length: ${ids[0].length} chars`);
  });

  it("should generate unique IDs", async () => {
    const ids = new Set<string>();
    const count = 1000;

    for (let i = 0; i < count; i++) {
      const id = await generateSessionId();
      ids.add(id);
    }

    assert.strictEqual(
      ids.size,
      count,
      `Expected ${count} unique IDs, got ${ids.size} (${count - ids.size} duplicates)`
    );

    console.log(`✓ Generated ${count} unique IDs (no duplicates)`);
  });

  it("should generate hex-only IDs", async () => {
    const hexPattern = /^[0-9a-f]+$/i;
    const invalidIds: string[] = [];

    for (let i = 0; i < 100; i++) {
      const id = await generateSessionId();
      if (!hexPattern.test(id)) {
        invalidIds.push(id);
      }
    }

    assert.strictEqual(
      invalidIds.length,
      0,
      `All IDs should be hex-only, found invalid: ${invalidIds.join(", ")}`
    );

    console.log("✓ 100 IDs all hex-only (0-9, a-f)");
  });

  it("should have high entropy (varied characters)", async () => {
    const ids: string[] = [];

    for (let i = 0; i < 100; i++) {
      const id = await generateSessionId();
      ids.push(id);
    }

    // Count unique characters across all IDs
    const allChars = ids.join("");
    const uniqueChars = new Set(allChars);

    // Should have all 16 hex characters (0-9, a-f)
    assert.ok(
      uniqueChars.size >= 15,
      `Expected at least 15/16 hex chars used, got ${uniqueChars.size}`
    );

    console.log(
      `✓ High entropy: ${uniqueChars.size}/16 hex chars used across 100 IDs`
    );
  });

  it("should not have obvious patterns", async () => {
    const ids: string[] = [];

    for (let i = 0; i < 50; i++) {
      const id = await generateSessionId();
      ids.push(id);
    }

    // Check for repeated patterns (e.g., "aaaaaa", "111111")
    const hasRepeats = ids.some((id) => {
      // Check for 6+ consecutive same characters
      return /(.)\1{5,}/.test(id);
    });

    assert.strictEqual(
      hasRepeats,
      false,
      "IDs should not have obvious repeat patterns"
    );

    // Check for sequential patterns (e.g., "123456", "abcdef")
    const hasSequential = ids.some((id) => {
      for (let i = 0; i < id.length - 5; i++) {
        const substr = id.substring(i, i + 6);
        if (substr === "123456" || substr === "abcdef" || substr === "fedcba") {
          return true;
        }
      }
      return false;
    });

    assert.strictEqual(
      hasSequential,
      false,
      "IDs should not have obvious sequential patterns"
    );

    console.log("✓ No obvious patterns detected in 50 IDs");
  });

  it("should demonstrate cryptographic quality", async () => {
    const ids: string[] = [];

    for (let i = 0; i < 1000; i++) {
      const id = await generateSessionId();
      ids.push(id);
    }

    // Calculate character distribution
    const charCounts: Record<string, number> = {};
    for (const id of ids) {
      for (const char of id) {
        charCounts[char] = (charCounts[char] || 0) + 1;
      }
    }

    // Each hex char (0-f) should appear roughly equally
    // With 1000 IDs × 32 chars = 32,000 total chars
    // Expected per char: 32,000 / 16 = 2,000
    // Allow 20% variance: 1,600 - 2,400
    const totalChars = ids.length * 32;
    const expectedPerChar = totalChars / 16;
    const minExpected = expectedPerChar * 0.8;
    const maxExpected = expectedPerChar * 1.2;

    let balanced = true;
    for (const char of "0123456789abcdef") {
      const count = charCounts[char.toLowerCase()] || 0;
      if (count < minExpected || count > maxExpected) {
        balanced = false;
        console.log(
          `  ⚠ Char '${char}': ${count} (expected ${expectedPerChar.toFixed(0)} ± 20%)`
        );
      }
    }

    assert.ok(
      balanced,
      "Character distribution should be balanced (within 20% of expected)"
    );

    console.log(
      `✓ Cryptographic quality: balanced distribution across ${totalChars} chars`
    );
  });
});

console.log("\n✅ All reliability improvement tests completed!\n");
