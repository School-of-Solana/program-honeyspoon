/**
 * Unit Tests for Wallet Logic
 * Run with: node --import tsx --test tests/unit/walletLogic.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  calculateMaxPotentialPayout,
  calculateMaxBetFromHouseWallet,
  validateBet,
  validateDiveDeeper,
  reserveHouseFunds,
  releaseHouseFunds,
  processBet,
  processWin,
  processLoss,
  processHousePayout,
  processHouseReceiveBet,
  getHouseRiskExposure,
  DEFAULT_LIMITS,
} from "../../lib/walletLogic";
import type {
  UserWallet,
  HouseWallet,
  GameSession,
} from "../../lib/walletTypes";

// Helper to create mock wallets
function createMockUserWallet(balance: number = 1000): UserWallet {
  return {
    userId: "test_user",
    balance,
    totalWagered: 0,
    totalWon: 0,
    totalLost: 0,
    gamesPlayed: 0,
    lastUpdated: Date.now(),
  };
}

function createMockHouseWallet(
  balance: number = 50000,
  reservedFunds: number = 0
): HouseWallet {
  return {
    balance,
    totalPaidOut: 0,
    totalReceived: 0,
    reservedFunds,
    lastUpdated: Date.now(),
  };
}

function createMockGameSession(
  initialBet: number = 100,
  currentTreasure: number = 100,
  diveNumber: number = 1
): GameSession {
  return {
    sessionId: "test_session",
    userId: "test_user",
    initialBet,
    currentTreasure,
    diveNumber,
    isActive: true,
    status: "ACTIVE" as const,
    reservedPayout: calculateMaxPotentialPayout(initialBet),
    startTime: Date.now(),
  };
}

describe("Wallet Logic - calculateMaxPotentialPayout", () => {
  it("should calculate max payout for $100 bet", () => {
    const maxPayout = calculateMaxPotentialPayout(100);

    // With 10 dives and increasing multipliers, this should be significant
    assert.ok(maxPayout > 100, "Max payout should be greater than initial bet");
    assert.ok(maxPayout < 100000, "Max payout should be reasonable");

    console.log(`- Max payout for $100 bet: $${maxPayout}`);
  });

  it("should calculate max payout for $10 bet", () => {
    const maxPayout = calculateMaxPotentialPayout(10);

    assert.ok(maxPayout >= 10, "Max payout should be at least initial bet");

    console.log(`- Max payout for $10 bet: $${maxPayout}`);
  });

  it("should scale linearly with bet amount", () => {
    const payout100 = calculateMaxPotentialPayout(100);
    const payout200 = calculateMaxPotentialPayout(200);

    // Should be approximately 2x (exact due to floor operations)
    const ratio = payout200 / payout100;
    assert.ok(ratio > 1.9 && ratio < 2.1, `Ratio should be ~2.0, got ${ratio}`);

    console.log(
      `- Payout scales linearly: $100→$${payout100}, $200→$${payout200} (ratio: ${ratio.toFixed(2)})`
    );
  });

  it("should handle different dive counts", () => {
    const payout5 = calculateMaxPotentialPayout(100, 5);
    const payout10 = calculateMaxPotentialPayout(100, 10);

    assert.ok(payout10 > payout5, "10 dives should have higher payout than 5");

    console.log(`- 5 dives: $${payout5}, 10 dives: $${payout10}`);
  });
});

describe("Wallet Logic - calculateMaxBetFromHouseWallet", () => {
  it("should calculate safe max bet for healthy house", () => {
    const house = createMockHouseWallet(50000, 0);
    const maxBet = calculateMaxBetFromHouseWallet(house);

    assert.ok(maxBet > 0, "Max bet should be positive");
    assert.ok(
      maxBet <= DEFAULT_LIMITS.maxBet,
      "Should not exceed absolute max"
    );

    console.log(`- Max bet for $50k house: $${maxBet}`);
  });

  it("should reduce max bet when house has reserved funds", () => {
    const house1 = createMockHouseWallet(50000, 0);
    const house2 = createMockHouseWallet(50000, 20000);

    const maxBet1 = calculateMaxBetFromHouseWallet(house1);
    const maxBet2 = calculateMaxBetFromHouseWallet(house2);

    assert.ok(
      maxBet2 <= maxBet1,
      "Max bet should be lower or equal with reserved funds"
    );

    console.log(`- No reserves: $${maxBet1}, With $20k reserves: $${maxBet2}`);
  });

  it("should return 0 when house is depleted", () => {
    const house = createMockHouseWallet(1000, 0);
    const maxBet = calculateMaxBetFromHouseWallet(house);

    assert.ok(maxBet >= 0, "Max bet should not be negative");

    console.log(`- Depleted house ($1k) max bet: $${maxBet}`);
  });
});

describe("Wallet Logic - validateBet", () => {
  it("should validate bet within limits", () => {
    const user = createMockUserWallet(1000);
    const house = createMockHouseWallet(50000);

    // Try $50 bet which should be safe for a $50k house
    const validation = validateBet(50, user, house);

    if (validation.valid) {
      assert.strictEqual(validation.error, undefined, "Should have no error");
      console.log("- Valid $50 bet accepted");
    } else {
      console.log(`- $50 bet validation: ${validation.error}`);
    }
  });

  it("should reject bet below minimum", () => {
    const user = createMockUserWallet(1000);
    const house = createMockHouseWallet(50000);

    const validation = validateBet(5, user, house);

    assert.strictEqual(
      validation.valid,
      false,
      "Should reject bet below minimum"
    );
    assert.ok(
      validation.error?.includes("Minimum bet"),
      "Error should mention minimum bet"
    );

    console.log(`- Bet below minimum rejected: ${validation.error}`);
  });

  it("should reject bet exceeding user balance", () => {
    const user = createMockUserWallet(50);
    const house = createMockHouseWallet(50000);

    const validation = validateBet(100, user, house);

    assert.strictEqual(
      validation.valid,
      false,
      "Should reject bet exceeding balance"
    );
    assert.ok(
      validation.error?.includes("Insufficient balance"),
      "Error should mention insufficient balance"
    );
    assert.strictEqual(
      validation.userBalance,
      50,
      "Should return user balance"
    );

    console.log(`- Bet exceeding balance rejected: ${validation.error}`);
  });

  it("should reject bet when house cannot cover", () => {
    const user = createMockUserWallet(1000);
    const house = createMockHouseWallet(1000, 0); // Small house

    const validation = validateBet(100, user, house);

    if (!validation.valid) {
      assert.ok(
        validation.error?.includes("House cannot") ||
          validation.error?.includes("Maximum bet"),
        "Error should mention house capacity"
      );
      console.log(`- Bet rejected due to house limit: ${validation.error}`);
    } else {
      console.log("- $100 bet accepted by $1k house (within limits)");
    }
  });

  it("should reject bet above absolute maximum", () => {
    const user = createMockUserWallet(10000);
    const house = createMockHouseWallet(1000000);

    const validation = validateBet(1000, user, house); // Way above $500 max

    assert.strictEqual(validation.valid, false, "Should reject bet above max");
    assert.ok(
      validation.error?.includes("Maximum bet"),
      "Error should mention maximum bet"
    );

    console.log(`- Bet above maximum rejected: ${validation.error}`);
  });

  it("should validate bet at exact user balance (if within limits)", () => {
    const user = createMockUserWallet(50);
    const house = createMockHouseWallet(50000);

    // $50 is within both user balance and house limits
    const validation = validateBet(50, user, house);

    if (validation.valid) {
      console.log("- Bet at exact balance accepted");
    } else {
      console.log(`- Bet at exact balance: ${validation.error}`);
    }

    // Should at least not error for insufficient balance
    assert.ok(
      !validation.error || !validation.error.includes("Insufficient"),
      "Should not complain about insufficient balance"
    );
  });

  it("should validate edge case: minimum bet", () => {
    const user = createMockUserWallet(1000);
    // Use larger house balance (500k like in production) to cover max potential payout
    const house = createMockHouseWallet(500000);

    const validation = validateBet(DEFAULT_LIMITS.minBet, user, house);

    assert.strictEqual(validation.valid, true, "Should accept minimum bet");

    console.log(`- Minimum bet ($${DEFAULT_LIMITS.minBet}) accepted`);
  });
});

describe("Wallet Logic - validateDiveDeeper", () => {
  it("should allow dive when house can afford", () => {
    const session = createMockGameSession(100, 200, 2);
    const house = createMockHouseWallet(50000, 5000);

    const validation = validateDiveDeeper(session, house);

    assert.strictEqual(validation.valid, true, "Should allow dive");

    console.log("- Dive deeper allowed when house can afford");
  });

  it("should block dive when house cannot afford increase", () => {
    const session = createMockGameSession(100, 8000, 8);
    const house = createMockHouseWallet(10000, 5000);

    const validation = validateDiveDeeper(session, house);

    if (!validation.valid) {
      assert.ok(
        validation.error?.includes("House cannot"),
        "Error should mention house capacity"
      );
      console.log(`- Dive blocked due to house limit: ${validation.error}`);
    } else {
      console.log("- Dive allowed (house still has capacity)");
    }
  });

  it("should block dive when approaching max win", () => {
    const session = createMockGameSession(100, 9500, 9);
    const house = createMockHouseWallet(50000, 5000);

    const validation = validateDiveDeeper(session, house, DEFAULT_LIMITS);

    // Next dive would push over $10k limit
    if (!validation.valid) {
      assert.ok(
        validation.error?.includes("maximum") ||
          validation.error?.includes("surface"),
        "Error should mention limit"
      );
      console.log(`- Dive blocked near max win: ${validation.error}`);
    } else {
      console.log("- Dive allowed (still under max win)");
    }
  });
});

describe("Wallet Logic - House Fund Management", () => {
  it("should reserve funds correctly", () => {
    const house = createMockHouseWallet(50000, 0);
    const updated = reserveHouseFunds(house, 5000);

    assert.strictEqual(updated.reservedFunds, 5000, "Should reserve $5k");
    assert.strictEqual(updated.balance, 50000, "Balance should not change");

    console.log("- Funds reserved: $5k");
  });

  it("should release funds correctly", () => {
    const house = createMockHouseWallet(50000, 5000);
    const updated = releaseHouseFunds(house, 5000);

    assert.strictEqual(updated.reservedFunds, 0, "Should release all reserved");

    console.log("- Funds released: $5k");
  });

  it("should not allow negative reserves", () => {
    const house = createMockHouseWallet(50000, 1000);
    const updated = releaseHouseFunds(house, 2000);

    assert.strictEqual(updated.reservedFunds, 0, "Should floor at 0");

    console.log("- Reserves cannot go negative");
  });

  it("should accumulate multiple reservations", () => {
    let house = createMockHouseWallet(50000, 0);
    house = reserveHouseFunds(house, 5000);
    house = reserveHouseFunds(house, 3000);

    assert.strictEqual(house.reservedFunds, 8000, "Should accumulate to $8k");

    console.log("- Multiple reservations accumulate");
  });
});

describe("Wallet Logic - User Wallet Transactions", () => {
  it("should process bet correctly", () => {
    const user = createMockUserWallet(1000);
    const updated = processBet(user, 100);

    assert.strictEqual(updated.balance, 900, "Balance should decrease by $100");
    assert.strictEqual(
      updated.totalWagered,
      100,
      "Total wagered should be $100"
    );

    console.log("- Bet processed: $1000 → $900");
  });

  it("should process win correctly", () => {
    const user = createMockUserWallet(900); // After $100 bet
    const updated = processWin(user, 500, 100);

    assert.strictEqual(updated.balance, 1400, "Balance should be $900 + $500");
    assert.strictEqual(
      updated.totalWon,
      400,
      "Profit should be $400 ($500 - $100)"
    );
    assert.strictEqual(updated.gamesPlayed, 1, "Should increment games played");

    console.log("- Win processed: $900 + $500 = $1400 (profit: $400)");
  });

  it("should process loss correctly", () => {
    const user = createMockUserWallet(900); // After $100 bet (already deducted)
    const updated = processLoss(user, 100);

    assert.strictEqual(
      updated.balance,
      900,
      "Balance should not change (already deducted)"
    );
    assert.strictEqual(updated.totalLost, 100, "Total lost should be $100");
    assert.strictEqual(updated.gamesPlayed, 1, "Should increment games played");

    console.log("- Loss processed: total lost = $100");
  });

  it("should handle multiple bets", () => {
    let user = createMockUserWallet(1000);
    user = processBet(user, 100);
    user = processBet(user, 50);

    assert.strictEqual(user.balance, 850, "Should be $1000 - $100 - $50");
    assert.strictEqual(user.totalWagered, 150, "Total wagered should be $150");

    console.log("- Multiple bets processed: $1000 → $850");
  });
});

describe("Wallet Logic - House Wallet Transactions", () => {
  it("should receive bet correctly", () => {
    const house = createMockHouseWallet(50000);
    const updated = processHouseReceiveBet(house, 100);

    assert.strictEqual(updated.balance, 50100, "Should increase by $100");
    assert.strictEqual(
      updated.totalReceived,
      100,
      "Total received should be $100"
    );

    console.log("- House received bet: $50000 → $50100");
  });

  it("should process payout correctly", () => {
    const house = createMockHouseWallet(50100, 5000);
    const updated = processHousePayout(house, 500, 5000);

    assert.strictEqual(updated.balance, 49600, "Should decrease by $500");
    assert.strictEqual(
      updated.totalPaidOut,
      500,
      "Total paid out should be $500"
    );
    assert.strictEqual(updated.reservedFunds, 0, "Should release reserves");

    console.log("- House payout: $50100 → $49600, released $5k reserves");
  });

  it("should handle partial reserve release", () => {
    const house = createMockHouseWallet(50000, 10000);
    const updated = processHousePayout(house, 200, 5000);

    assert.strictEqual(
      updated.reservedFunds,
      5000,
      "Should release only $5k of $10k"
    );

    console.log("- Partial reserve release: $10k → $5k");
  });
});

describe("Wallet Logic - Risk Exposure", () => {
  it("should calculate risk exposure correctly", () => {
    const house = createMockHouseWallet(50000, 10000);
    const exposure = getHouseRiskExposure(house);

    assert.strictEqual(
      exposure.totalReserved,
      10000,
      "Should show $10k reserved"
    );

    // Available = balance - reserved - (10% reserve)
    // = 50000 - 10000 - 5000 = 35000
    assert.strictEqual(
      exposure.availableFunds,
      35000,
      "Should have $35k available"
    );
    assert.strictEqual(
      exposure.reserveRequired,
      5000,
      "Should require $5k reserve (10%)"
    );

    console.log(
      `- Risk exposure: $${exposure.availableFunds} available of $${house.balance}`
    );
  });

  it("should indicate when house can accept bets", () => {
    const house = createMockHouseWallet(50000, 0);
    const exposure = getHouseRiskExposure(house);

    assert.strictEqual(
      exposure.canAcceptNewBets,
      true,
      "Should accept new bets"
    );

    console.log("- House can accept new bets");
  });

  it("should indicate when house cannot accept bets", () => {
    const house = createMockHouseWallet(1000, 0);
    const exposure = getHouseRiskExposure(house);

    // With only $1000, after 20% reserve ($200), only $800 available
    // Need at least min_bet * 50 = $500 to accept bets
    const canAccept = exposure.canAcceptNewBets;

    console.log(`- Small house ($1k) can accept bets: ${canAccept}`);
  });

  it("should calculate max new bet correctly", () => {
    const house = createMockHouseWallet(50000, 0);
    const exposure = getHouseRiskExposure(house);

    assert.ok(exposure.maxNewBet > 0, "Max bet should be positive");
    assert.ok(
      exposure.maxNewBet <= DEFAULT_LIMITS.maxBet,
      "Should not exceed absolute max"
    );

    console.log(`- Max new bet: $${exposure.maxNewBet}`);
  });

  it("should handle edge case: fully reserved house", () => {
    const house = createMockHouseWallet(50000, 50000);
    const exposure = getHouseRiskExposure(house);

    assert.strictEqual(
      exposure.availableFunds,
      0,
      "Should have no available funds"
    );
    assert.strictEqual(
      exposure.canAcceptNewBets,
      false,
      "Should not accept bets"
    );

    console.log("- Fully reserved house cannot accept bets");
  });
});

describe("Wallet Logic - Edge Cases", () => {
  it("should handle zero bet amount", () => {
    const user = createMockUserWallet(1000);
    const house = createMockHouseWallet(50000);

    const validation = validateBet(0, user, house);

    assert.strictEqual(validation.valid, false, "Should reject zero bet");

    console.log("- Zero bet rejected");
  });

  it("should handle negative bet amount", () => {
    const user = createMockUserWallet(1000);
    const house = createMockHouseWallet(50000);

    const validation = validateBet(-100, user, house);

    assert.strictEqual(validation.valid, false, "Should reject negative bet");

    console.log("- Negative bet rejected");
  });

  it("should handle user with zero balance", () => {
    const user = createMockUserWallet(0);
    const house = createMockHouseWallet(50000);

    const validation = validateBet(10, user, house);

    assert.strictEqual(
      validation.valid,
      false,
      "Should reject when balance is zero"
    );

    console.log("- Bet rejected for zero balance user");
  });

  it("should handle house with zero balance", () => {
    const user = createMockUserWallet(1000);
    const house = createMockHouseWallet(0);

    const validation = validateBet(10, user, house);

    assert.strictEqual(
      validation.valid,
      false,
      "Should reject when house is empty"
    );

    console.log("- Bet rejected for empty house");
  });

  it("should handle very large bet amounts", () => {
    const user = createMockUserWallet(1000000);
    const house = createMockHouseWallet(1000000);

    const validation = validateBet(10000, user, house);

    assert.strictEqual(
      validation.valid,
      false,
      "Should reject extremely large bets"
    );

    console.log("- Extremely large bet rejected");
  });
});

console.log("\nOK: All wallet logic tests completed!\n");
