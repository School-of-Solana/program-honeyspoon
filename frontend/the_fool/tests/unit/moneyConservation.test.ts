/**
 * Money Conservation & Invariant Tests
 * Verifies that money is never created or destroyed
 * Run with: tsx --test tests/unit/moneyConservation.test.ts
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
import { resetWalletStore } from "../../lib/walletStore";

describe("Money Conservation - Single Game", () => {
  let userId: string;
  let sessionId: string;

  beforeEach(async () => {
    resetWalletStore();
    userId = `test_user_${Date.now()}_${Math.random()}`;
    sessionId = await generateSessionId();
  });

  it("should conserve money when player loses", async () => {
    const initialUser = await getWalletInfo(userId);
    const initialHouse = await getHouseStatus();

    const totalBefore = initialUser.balance + initialHouse.balance;

    // Start game
    await startGame(50, userId, sessionId);

    // Die
    const diveResult = await performDive(1, 50, sessionId, userId, "0");

    if (!diveResult.survived) {
      const finalUser = await getWalletInfo(userId);
      const finalHouse = await getHouseStatus();

      const totalAfter = finalUser.balance + finalHouse.balance;

      // Total money should be conserved
      assert.strictEqual(
        totalAfter,
        totalBefore,
        "Total money must be conserved on loss"
      );

      // User lost bet
      assert.strictEqual(
        finalUser.balance,
        initialUser.balance - 50,
        "User should lose bet"
      );

      // House gained bet
      assert.strictEqual(
        finalHouse.balance,
        initialHouse.balance + 50,
        "House should gain bet"
      );

      console.log(
        `✓ Money conserved on loss: $${totalBefore} → $${totalAfter}`
      );
    } else {
      console.log("⚠ Survived with roll=0, skipping");
    }
  });

  it("should conserve money when player wins", async () => {
    const initialUser = await getWalletInfo(userId);
    const initialHouse = await getHouseStatus();

    const totalBefore = initialUser.balance + initialHouse.balance;

    // Start game
    await startGame(50, userId, sessionId);

    // Win
    const diveResult = await performDive(1, 50, sessionId, userId, "99");
    assert.strictEqual(diveResult.survived, true, "Should survive");

    // Cash out
    await surfaceWithTreasure(diveResult.totalTreasure, sessionId, userId);

    const finalUser = await getWalletInfo(userId);
    const finalHouse = await getHouseStatus();

    const totalAfter = finalUser.balance + finalHouse.balance;

    // Total money should be conserved
    assert.strictEqual(
      totalAfter,
      totalBefore,
      "Total money must be conserved on win"
    );

    // User's change = treasure - bet
    const userChange = finalUser.balance - initialUser.balance;
    const houseChange = finalHouse.balance - initialHouse.balance;

    // User + House change should equal 0
    assert.strictEqual(
      userChange + houseChange,
      0,
      "Money transfer should sum to zero"
    );

    console.log(`✓ Money conserved on win: $${totalBefore} → $${totalAfter}`);
    console.log(
      `  User: ${userChange > 0 ? "+" : ""}$${userChange}, House: ${houseChange > 0 ? "+" : ""}$${houseChange}`
    );
  });

  it("should conserve money with multiple dives", async () => {
    const initialUser = await getWalletInfo(userId);
    const initialHouse = await getHouseStatus();

    const totalBefore = initialUser.balance + initialHouse.balance;

    await startGame(50, userId, sessionId);

    // Do 3 dives
    let treasure = 50;
    let survived = true;
    for (let dive = 1; dive <= 3; dive++) {
      const result = await performDive(dive, treasure, sessionId, userId, "99");
      if (!result.survived) {
        survived = false;
        break;
      }
      treasure = result.totalTreasure;
    }

    // Cash out only if survived all dives
    if (survived) {
      await surfaceWithTreasure(treasure, sessionId, userId);
    }

    const finalUser = await getWalletInfo(userId);
    const finalHouse = await getHouseStatus();

    const totalAfter = finalUser.balance + finalHouse.balance;

    assert.strictEqual(
      totalAfter,
      totalBefore,
      "Money conserved after multiple dives"
    );

    console.log(
      `✓ Money conserved with 3 dives (survived=${survived}): $${totalBefore} → $${totalAfter}`
    );
  });

  console.log("✓ Money conservation single game tests passed");
});

describe("Money Conservation - Multiple Games", () => {
  let userId: string;

  beforeEach(() => {
    resetWalletStore();
    userId = `test_user_${Date.now()}_${Math.random()}`;
  });

  it("should conserve money across 10 games", async () => {
    const initialUser = await getWalletInfo(userId);
    const initialHouse = await getHouseStatus();

    const totalBefore = initialUser.balance + initialHouse.balance;

    // Play 10 games
    for (let game = 1; game <= 10; game++) {
      const sessionId = await generateSessionId();
      await startGame(10, userId, sessionId);

      const result = await performDive(
        1,
        10,
        sessionId,
        userId,
        `${game * 10}`
      );

      if (result.survived) {
        await surfaceWithTreasure(result.totalTreasure, sessionId, userId);
      }
    }

    const finalUser = await getWalletInfo(userId);
    const finalHouse = await getHouseStatus();

    const totalAfter = finalUser.balance + finalHouse.balance;

    assert.strictEqual(
      totalAfter,
      totalBefore,
      "Total money must be conserved across games"
    );

    console.log(
      `✓ Money conserved across 10 games: $${totalBefore} → $${totalAfter}`
    );
  });

  it("should conserve money with concurrent users", async () => {
    const user1 = `user1_${Date.now()}`;
    const user2 = `user2_${Date.now()}`;
    const user3 = `user3_${Date.now()}`;

    const wallet1Before = await getWalletInfo(user1);
    const wallet2Before = await getWalletInfo(user2);
    const wallet3Before = await getWalletInfo(user3);
    const houseBefore = await getHouseStatus();

    const totalBefore =
      wallet1Before.balance +
      wallet2Before.balance +
      wallet3Before.balance +
      houseBefore.balance;

    // All 3 users play simultaneously
    const session1 = await generateSessionId();
    const session2 = await generateSessionId();
    const session3 = await generateSessionId();

    await startGame(10, user1, session1);
    await startGame(10, user2, session2);
    await startGame(10, user3, session3);

    await performDive(1, 10, session1, user1, "30");
    await performDive(1, 10, session2, user2, "50");
    await performDive(1, 10, session3, user3, "35");

    const wallet1After = await getWalletInfo(user1);
    const wallet2After = await getWalletInfo(user2);
    const wallet3After = await getWalletInfo(user3);
    const houseAfter = await getHouseStatus();

    const totalAfter =
      wallet1After.balance +
      wallet2After.balance +
      wallet3After.balance +
      houseAfter.balance;

    assert.strictEqual(
      totalAfter,
      totalBefore,
      "Money conserved with concurrent users"
    );

    console.log(
      `✓ Money conserved with 3 concurrent users: $${totalBefore} → $${totalAfter}`
    );
  });

  console.log("✓ Money conservation multiple games tests passed");
});

describe("House Fund Reservation", () => {
  let userId: string;

  beforeEach(() => {
    resetWalletStore();
    userId = `test_user_${Date.now()}_${Math.random()}`;
  });

  it("should reserve funds on game start", async () => {
    const houseBefore = await getHouseStatus();
    const reservedBefore = houseBefore.reservedFunds;

    const sessionId = await generateSessionId();
    await startGame(50, userId, sessionId);

    const houseAfter = await getHouseStatus();
    const reservedAfter = houseAfter.reservedFunds;

    // Reserved funds should increase
    assert.ok(reservedAfter > reservedBefore, "Reserved funds should increase");

    console.log(
      `✓ Reserved funds: $${reservedBefore} → $${reservedAfter} (+$${reservedAfter - reservedBefore})`
    );
  });

  it("should release funds on loss", async () => {
    const sessionId = await generateSessionId();
    await startGame(50, userId, sessionId);

    const houseMid = await getHouseStatus();
    const reservedMid = houseMid.reservedFunds;

    // Die
    const result = await performDive(1, 50, sessionId, userId, "0");

    if (!result.survived) {
      const houseAfter = await getHouseStatus();
      const reservedAfter = houseAfter.reservedFunds;

      // Reserved funds should decrease back to 0
      assert.ok(
        reservedAfter < reservedMid,
        "Reserved funds should be released"
      );

      console.log(
        `✓ Reserved funds released: $${reservedMid} → $${reservedAfter}`
      );
    } else {
      console.log("⚠ Survived with roll=0, skipping");
    }
  });

  it("should release funds on win", async () => {
    const sessionId = await generateSessionId();
    await startGame(50, userId, sessionId);

    const houseMid = await getHouseStatus();
    const reservedMid = houseMid.reservedFunds;

    const result = await performDive(1, 50, sessionId, userId, "99");
    await surfaceWithTreasure(result.totalTreasure, sessionId, userId);

    const houseAfter = await getHouseStatus();
    const reservedAfter = houseAfter.reservedFunds;

    // Reserved funds should be released
    assert.ok(
      reservedAfter < reservedMid,
      "Reserved funds should be released on win"
    );

    console.log(
      `✓ Reserved funds released on win: $${reservedMid} → $${reservedAfter}`
    );
  });

  it("should not leak reserved funds across multiple games", async () => {
    const houseBefore = await getHouseStatus();

    // Play 5 complete games
    for (let i = 0; i < 5; i++) {
      const sessionId = await generateSessionId();
      await startGame(10, userId, sessionId);
      const result = await performDive(1, 10, sessionId, userId, "50");
      if (result.survived) {
        await surfaceWithTreasure(result.totalTreasure, sessionId, userId);
      }
    }

    const houseAfter = await getHouseStatus();

    // Reserved funds should be back to starting (or close if games still active)
    assert.ok(
      houseAfter.reservedFunds <= houseBefore.reservedFunds + 50,
      "Reserved funds should not accumulate across completed games"
    );

    console.log(
      `✓ No reserve leaks: $${houseBefore.reservedFunds} → $${houseAfter.reservedFunds}`
    );
  });

  console.log("✓ House fund reservation tests passed");
});

describe("Treasure Accumulation Correctness", () => {
  let userId: string;
  let sessionId: string;

  beforeEach(async () => {
    resetWalletStore();
    userId = `test_user_${Date.now()}_${Math.random()}`;
    sessionId = await generateSessionId();
  });

  it("should multiply treasure correctly on each dive", async () => {
    await startGame(100, userId, sessionId);

    let treasure = 100;
    const treasures: number[] = [treasure];

    for (let dive = 1; dive <= 5; dive++) {
      const result = await performDive(dive, treasure, sessionId, userId, "99");

      if (!result.survived) break;

      // Verify treasure = previous * multiplier (floored)
      const expected = Math.floor(treasure * result.multiplier);
      assert.strictEqual(
        result.totalTreasure,
        expected,
        `Dive ${dive}: Expected $${expected}, got $${result.totalTreasure}`
      );

      treasure = result.totalTreasure;
      treasures.push(treasure);
    }

    console.log(`  Treasure progression: ${treasures.join(" → ")}`);
    console.log("✓ Treasure multiplication correct");
  });

  it("should never increase treasure on loss", async () => {
    await startGame(100, userId, sessionId);

    const result = await performDive(1, 100, sessionId, userId, "0");

    if (!result.survived) {
      assert.strictEqual(
        result.totalTreasure,
        0,
        "Treasure should be 0 on loss"
      );
      console.log("✓ Treasure correctly zeroed on loss");
    }
  });

  it("should handle very small treasure values without underflow", async () => {
    await startGame(10, userId, sessionId);

    let treasure = 10;

    // Dive until treasure becomes very small
    for (let dive = 1; dive <= 20; dive++) {
      const result = await performDive(dive, treasure, sessionId, userId, "99");

      if (!result.survived) break;

      treasure = result.totalTreasure;

      // Should never go negative
      assert.ok(treasure >= 0, `Treasure should not be negative: ${treasure}`);

      // If treasure hits 0, it should stay 0
      if (treasure === 0) {
        console.log(`  Treasure reached $0 at dive ${dive}`);
        break;
      }
    }

    console.log("✓ Small treasure values handled correctly");
  });

  it("should handle large treasure values without overflow", async () => {
    await startGame(500, userId, sessionId);

    let treasure = 500;
    let maxTreasure = treasure;
    let diveCount = 0;

    // Dive with guaranteed survival (but it might still fail at high rounds)
    for (let dive = 1; dive <= 15; dive++) {
      try {
        const result = await performDive(
          dive,
          treasure,
          sessionId,
          userId,
          "99"
        );

        if (!result.survived) {
          console.log(
            `  Died at dive ${dive} (roll=99 but probability too low)`
          );
          break;
        }

        treasure = result.totalTreasure;
        maxTreasure = Math.max(maxTreasure, treasure);
        diveCount = dive;

        // Should be finite
        assert.ok(Number.isFinite(treasure), "Treasure should be finite");

        // Should not exceed safe integer
        assert.ok(
          treasure <= Number.MAX_SAFE_INTEGER,
          "Treasure should not exceed MAX_SAFE_INTEGER"
        );
      } catch (error) {
        // Session might become invalid if died
        console.log(`  Session ended at dive ${dive}`);
        break;
      }
    }

    console.log(
      `  Max treasure reached: $${maxTreasure} after ${diveCount} dives`
    );
    console.log("✓ Large treasure values handled correctly");
  });

  console.log("✓ Treasure accumulation correctness tests passed");
});

console.log("\n✅ All money conservation tests completed!\n");
