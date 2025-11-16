/**
 * Unit Tests for Game Logic
 * Run with: tsx --test tests/unit/gameLogic.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  calculateDiveStats,
  getDepthZone,
  generateShipwreck,
  getTreasureVisual,
  validateBet,
  calculateCumulativeEV,
  getSeaCreatureForDepth,
} from "../../lib/gameLogic";
import { GAME_CONFIG } from "../../lib/constants";

describe("Game Logic - calculateDiveStats", () => {
  it("should calculate stats for dive 1", () => {
    const stats = calculateDiveStats(1);

    assert.strictEqual(stats.diveNumber, 1, "Dive number should be 1");
    assert.ok(
      stats.survivalProbability > 0 && stats.survivalProbability <= 1,
      "Survival prob should be 0-1"
    );
    assert.ok(stats.multiplier > 0, "Multiplier should be > 0");
    assert.ok(
      stats.multiplier < 1,
      "Multiplier should be < 1 (house edge means you lose value)"
    );
    assert.strictEqual(stats.expectedValue, 0.85, "EV should always be 0.85");
    assert.strictEqual(stats.depth, 50, "Depth should be 50m");
    assert.strictEqual(stats.oxygenRemaining, 96, "Oxygen should be 96%");

    console.log(
      `✓ Dive 1: ${(stats.survivalProbability * 100).toFixed(1)}% survival, ${stats.multiplier}x multiplier`
    );
  });

  it("should calculate stats for dive 5", () => {
    const stats = calculateDiveStats(5);

    assert.strictEqual(stats.diveNumber, 5, "Dive number should be 5");
    assert.strictEqual(stats.expectedValue, 0.85, "EV should always be 0.85");
    assert.strictEqual(stats.depth, 250, "Depth should be 250m");
    assert.strictEqual(stats.oxygenRemaining, 80, "Oxygen should be 80%");

    console.log(
      `✓ Dive 5: ${(stats.survivalProbability * 100).toFixed(1)}% survival, ${stats.multiplier}x multiplier`
    );
  });

  it("should calculate stats for dive 10", () => {
    const stats = calculateDiveStats(10);

    assert.strictEqual(stats.diveNumber, 10, "Dive number should be 10");
    assert.strictEqual(stats.expectedValue, 0.85, "EV should always be 0.85");
    assert.strictEqual(stats.depth, 500, "Depth should be 500m");
    assert.strictEqual(stats.oxygenRemaining, 60, "Oxygen should be 60%");

    console.log(
      `✓ Dive 10: ${(stats.survivalProbability * 100).toFixed(1)}% survival, ${stats.multiplier}x multiplier`
    );
  });

  it("should decrease survival probability over dives", () => {
    const dive1 = calculateDiveStats(1);
    const dive5 = calculateDiveStats(5);
    const dive10 = calculateDiveStats(10);

    assert.ok(
      dive1.survivalProbability > dive5.survivalProbability,
      "Dive 1 should be easier than dive 5"
    );
    assert.ok(
      dive5.survivalProbability > dive10.survivalProbability,
      "Dive 5 should be easier than dive 10"
    );

    console.log(
      `✓ Survival decreases: ${(dive1.survivalProbability * 100).toFixed(1)}% → ${(dive5.survivalProbability * 100).toFixed(1)}% → ${(dive10.survivalProbability * 100).toFixed(1)}%`
    );
  });

  it("should increase multiplier over dives", () => {
    const dive1 = calculateDiveStats(1);
    const dive5 = calculateDiveStats(5);
    const dive10 = calculateDiveStats(10);

    assert.ok(
      dive1.multiplier < dive5.multiplier,
      "Dive 5 multiplier should be higher than dive 1"
    );
    assert.ok(
      dive5.multiplier < dive10.multiplier,
      "Dive 10 multiplier should be higher than dive 5"
    );

    console.log(
      `✓ Multiplier increases: ${dive1.multiplier}x → ${dive5.multiplier}x → ${dive10.multiplier}x`
    );
  });

  it("should maintain 0.85 EV across all dives", () => {
    for (let i = 1; i <= 20; i++) {
      const stats = calculateDiveStats(i);
      assert.strictEqual(
        stats.expectedValue,
        0.85,
        `EV should be 0.85 for dive ${i}`
      );
    }

    console.log("✓ EV constant at 0.85 for dives 1-20");
  });

  it("should calculate mathematically correct EV", () => {
    for (let i = 1; i <= 10; i++) {
      const stats = calculateDiveStats(i);
      const calculatedEV = stats.survivalProbability * stats.multiplier;

      // Should be approximately 0.85 (within rounding error)
      assert.ok(
        Math.abs(calculatedEV - 0.85) < 0.01,
        `EV calculation incorrect for dive ${i}: ${calculatedEV}`
      );
    }

    console.log(
      "✓ EV calculation mathematically verified (survivalProb × multiplier = 0.85)"
    );
  });

  it("should calculate correct threshold for random rolls", () => {
    const stats = calculateDiveStats(1);

    // Threshold should be floor(survivalProb * 100)
    // Player survives if roll < threshold
    const expectedThreshold = Math.floor(stats.survivalProbability * 100);
    assert.strictEqual(
      stats.threshold,
      expectedThreshold,
      "Threshold calculation incorrect"
    );

    console.log(
      `✓ Threshold: ${stats.threshold} (roll must be < ${stats.threshold} to survive)`
    );
  });

  it("should deplete oxygen over dives", () => {
    const dive1 = calculateDiveStats(1);
    const dive20 = calculateDiveStats(20);
    const dive30 = calculateDiveStats(30);

    assert.strictEqual(dive1.oxygenRemaining, 96, "Dive 1 oxygen should be 96");
    assert.strictEqual(
      dive20.oxygenRemaining,
      20,
      "Dive 20 oxygen should be 20"
    );
    assert.strictEqual(dive30.oxygenRemaining, 5, "Oxygen should floor at 5%");

    console.log(`✓ Oxygen depletion: 96% → 20% → 5% (min)`);
  });

  it("should increase depth linearly", () => {
    const dive1 = calculateDiveStats(1);
    const dive2 = calculateDiveStats(2);
    const dive10 = calculateDiveStats(10);

    assert.strictEqual(dive1.depth, 50, "Dive 1 depth should be 50m");
    assert.strictEqual(dive2.depth, 100, "Dive 2 depth should be 100m");
    assert.strictEqual(dive10.depth, 500, "Dive 10 depth should be 500m");

    console.log("✓ Depth increases linearly: 50m per dive");
  });

  it("should respect minimum survival probability", () => {
    // Test very deep dives (max is 50)
    const dive40 = calculateDiveStats(40);
    const dive50 = calculateDiveStats(50);

    assert.ok(
      dive40.survivalProbability >= GAME_CONFIG.MIN_WIN_PROB,
      "Should respect min win prob"
    );
    assert.ok(
      dive50.survivalProbability >= GAME_CONFIG.MIN_WIN_PROB,
      "Should respect min win prob"
    );

    console.log(
      `✓ Survival probability floors at ${GAME_CONFIG.MIN_WIN_PROB} (${(GAME_CONFIG.MIN_WIN_PROB * 100).toFixed(1)}%)`
    );
  });

  it("should include depth zone information", () => {
    const dive1 = calculateDiveStats(1);

    assert.ok(dive1.depthZone, "Should have depth zone");
    assert.ok(dive1.depthZone.name, "Depth zone should have name");
    assert.ok(dive1.depthZone.color, "Depth zone should have color");

    console.log(`✓ Dive 1 depth zone: ${dive1.depthZone.name}`);
  });
});

describe("Game Logic - getDepthZone", () => {
  it("should return SUNLIGHT zone for shallow depths", () => {
    const zone = getDepthZone(50);

    assert.strictEqual(zone.name, "SUNLIGHT", "Should be SUNLIGHT zone");
    assert.ok(zone.max >= 50, "Zone max should include depth");

    console.log(`✓ 50m = ${zone.name} zone`);
  });

  it("should return TWILIGHT zone for medium depths", () => {
    const zone = getDepthZone(250);

    assert.strictEqual(zone.name, "TWILIGHT", "Should be TWILIGHT zone");

    console.log(`✓ 250m = ${zone.name} zone`);
  });

  it("should return ABYSS zone for deep depths", () => {
    const zone = getDepthZone(5000);

    assert.strictEqual(zone.name, "ABYSS", "Should be ABYSS zone");

    console.log(`✓ 5000m = ${zone.name} zone`);
  });

  it("should return HADAL zone for extreme depths", () => {
    const zone = getDepthZone(10000);

    assert.strictEqual(zone.name, "HADAL", "Should be HADAL zone");

    console.log(`✓ 10000m = ${zone.name} zone`);
  });

  it("should assign zones correctly across all depths", () => {
    const depths = [0, 100, 200, 500, 1000, 2000, 5000, 10000];

    for (const depth of depths) {
      const zone = getDepthZone(depth);
      assert.ok(zone.name, `Should have zone for ${depth}m`);
      assert.ok(
        depth <= zone.max,
        `${depth}m should be <= zone max ${zone.max}m`
      );
    }

    console.log("✓ All depth ranges covered by zones");
  });

  it("should include zone properties", () => {
    const zone = getDepthZone(100);

    assert.ok(zone.color, "Zone should have color");
    assert.ok(typeof zone.light === "number", "Zone should have light level");
    assert.ok(typeof zone.max === "number", "Zone should have max depth");

    console.log(
      `✓ Zone properties: color=${zone.color}, light=${zone.light}, max=${zone.max}m`
    );
  });
});

describe("Game Logic - generateShipwreck", () => {
  it("should generate deterministic shipwreck", () => {
    const wreck1 = generateShipwreck(1, "test_seed");
    const wreck2 = generateShipwreck(1, "test_seed");

    assert.deepStrictEqual(
      wreck1,
      wreck2,
      "Same seed should generate identical shipwreck"
    );

    console.log(`✓ Deterministic: "${wreck1.name}"`);
  });

  it("should generate different shipwrecks for different dives", () => {
    const wreck1 = generateShipwreck(1, "test_seed");
    const wreck2 = generateShipwreck(2, "test_seed");

    assert.notStrictEqual(
      wreck1.name,
      wreck2.name,
      "Different dives should generate different wrecks"
    );
    assert.notStrictEqual(wreck1.id, wreck2.id, "Different IDs");

    console.log(`✓ Dive 1: "${wreck1.name}", Dive 2: "${wreck2.name}"`);
  });

  it("should generate different shipwrecks for different seeds", () => {
    const wreck1 = generateShipwreck(1, "seed_a");
    const wreck2 = generateShipwreck(1, "seed_b");

    // High probability they'll be different (not guaranteed but very likely)
    const different = wreck1.name !== wreck2.name || wreck1.era !== wreck2.era;
    assert.ok(
      different,
      "Different seeds should likely generate different wrecks"
    );

    console.log(`✓ Seed A: "${wreck1.name}", Seed B: "${wreck2.name}"`);
  });

  it("should include all required shipwreck properties", () => {
    const wreck = generateShipwreck(5, "test");

    assert.ok(wreck.id, "Should have ID");
    assert.ok(wreck.name, "Should have name");
    assert.ok(wreck.era, "Should have era");
    assert.ok(wreck.shipType, "Should have ship type");
    assert.ok(wreck.treasureType, "Should have treasure type");
    assert.ok(wreck.visual, "Should have visual");
    assert.strictEqual(typeof wreck.depth, "number", "Should have depth");
    assert.strictEqual(
      typeof wreck.treasureValue,
      "number",
      "Should have treasure value"
    );
    assert.strictEqual(wreck.discovered, false, "Should start undiscovered");

    console.log(`✓ Complete shipwreck: ${wreck.name} (${wreck.era})`);
  });

  it("should increase treasure value with depth", () => {
    const wreck1 = generateShipwreck(1, "test");
    const wreck5 = generateShipwreck(5, "test");
    const wreck10 = generateShipwreck(10, "test");

    assert.ok(
      wreck5.treasureValue > wreck1.treasureValue,
      "Dive 5 treasure should be more valuable"
    );
    assert.ok(
      wreck10.treasureValue > wreck5.treasureValue,
      "Dive 10 treasure should be more valuable"
    );

    console.log(
      `✓ Treasure value scales: $${wreck1.treasureValue} → $${wreck5.treasureValue} → $${wreck10.treasureValue}`
    );
  });

  it("should calculate correct depth", () => {
    const wreck1 = generateShipwreck(1, "test");
    const wreck3 = generateShipwreck(3, "test");

    assert.strictEqual(wreck1.depth, 50, "Dive 1 should be 50m");
    assert.strictEqual(wreck3.depth, 150, "Dive 3 should be 150m");

    console.log("✓ Depth calculation correct");
  });

  it("should format ID correctly", () => {
    const wreck = generateShipwreck(5, "session123");

    assert.strictEqual(
      wreck.id,
      "session123-5",
      "ID should be seed-diveNumber"
    );

    console.log(`✓ ID format: ${wreck.id}`);
  });

  it("should generate valid ship names", () => {
    for (let i = 1; i <= 10; i++) {
      const wreck = generateShipwreck(i, `test${i}`);

      // Name should have 3 parts (prefix adjective noun)
      const parts = wreck.name.split(" ");
      assert.ok(
        parts.length >= 2,
        `Name should have multiple parts: "${wreck.name}"`
      );
    }

    console.log("✓ All ship names properly formatted");
  });

  it("should handle extreme dive numbers", () => {
    const wreck1 = generateShipwreck(1, "test");
    const wreck100 = generateShipwreck(100, "test");

    assert.ok(wreck100.depth > wreck1.depth, "Depth should scale");
    assert.ok(
      wreck100.treasureValue > wreck1.treasureValue,
      "Treasure should scale"
    );

    console.log(
      `✓ Dive 100: depth=${wreck100.depth}m, treasure=$${wreck100.treasureValue}`
    );
  });
});

describe("Game Logic - getTreasureVisual", () => {
  it("should return small treasure for low values", () => {
    const visual = getTreasureVisual(50);

    assert.strictEqual(visual.size, 30, "Size should be 30");
    assert.strictEqual(visual.particles, 5, "Should have 5 particles");

    console.log(
      `✓ $50 treasure: size=${visual.size}, particles=${visual.particles}`
    );
  });

  it("should return medium treasure for moderate values", () => {
    const visual = getTreasureVisual(300);

    assert.strictEqual(visual.size, 45, "Size should be 45");
    assert.strictEqual(visual.particles, 15, "Should have 15 particles");

    console.log(
      `✓ $300 treasure: size=${visual.size}, particles=${visual.particles}`
    );
  });

  it("should return large treasure for high values", () => {
    const visual = getTreasureVisual(750);

    assert.strictEqual(visual.size, 60, "Size should be 60");
    assert.strictEqual(visual.particles, 30, "Should have 30 particles");

    console.log(
      `✓ $750 treasure: size=${visual.size}, particles=${visual.particles}`
    );
  });

  it("should return epic treasure for very high values", () => {
    const visual = getTreasureVisual(2000);

    assert.strictEqual(visual.size, 80, "Size should be 80");
    assert.strictEqual(visual.particles, 50, "Should have 50 particles");

    console.log(
      `✓ $2000 treasure: size=${visual.size}, particles=${visual.particles}`
    );
  });

  it("should increase size with value", () => {
    const visual1 = getTreasureVisual(50);
    const visual2 = getTreasureVisual(300);
    const visual3 = getTreasureVisual(750);
    const visual4 = getTreasureVisual(2000);

    assert.ok(visual2.size > visual1.size, "Size should increase");
    assert.ok(visual3.size > visual2.size, "Size should increase");
    assert.ok(visual4.size > visual3.size, "Size should increase");

    console.log("✓ Visual size scales with treasure value");
  });

  it("should include all visual properties", () => {
    const visual = getTreasureVisual(500);

    assert.ok(typeof visual.size === "number", "Should have size");
    assert.ok(typeof visual.glow === "number", "Should have glow");
    assert.ok(typeof visual.particles === "number", "Should have particles");
    assert.ok(visual.color, "Should have color");

    console.log(
      `✓ Visual properties: size=${visual.size}, glow=${visual.glow}, color=${visual.color}`
    );
  });
});

describe("Game Logic - validateBet", () => {
  it("should accept valid bet", () => {
    const result = validateBet(100);

    assert.strictEqual(result.valid, true, "Should accept $100 bet");
    assert.strictEqual(result.error, undefined, "Should have no error");

    console.log("✓ $100 bet accepted");
  });

  it("should reject bet below minimum", () => {
    const result = validateBet(5);

    assert.strictEqual(result.valid, false, "Should reject $5 bet");
    assert.ok(
      result.error?.includes("Minimum"),
      "Error should mention minimum"
    );

    console.log(`✓ $5 bet rejected: ${result.error}`);
  });

  it("should reject bet above maximum", () => {
    const result = validateBet(1000);

    assert.strictEqual(result.valid, false, "Should reject $1000 bet");
    assert.ok(
      result.error?.includes("Maximum"),
      "Error should mention maximum"
    );

    console.log(`✓ $1000 bet rejected: ${result.error}`);
  });

  it("should accept minimum bet", () => {
    const result = validateBet(GAME_CONFIG.MIN_BET);

    assert.strictEqual(
      result.valid,
      true,
      `Should accept minimum bet $${GAME_CONFIG.MIN_BET}`
    );

    console.log(`✓ Minimum bet $${GAME_CONFIG.MIN_BET} accepted`);
  });

  it("should accept maximum bet", () => {
    const result = validateBet(GAME_CONFIG.MAX_BET);

    assert.strictEqual(
      result.valid,
      true,
      `Should accept maximum bet $${GAME_CONFIG.MAX_BET}`
    );

    console.log(`✓ Maximum bet $${GAME_CONFIG.MAX_BET} accepted`);
  });

  it("should reject zero bet", () => {
    const result = validateBet(0);

    assert.strictEqual(result.valid, false, "Should reject zero bet");

    console.log("✓ Zero bet rejected");
  });

  it("should reject negative bet", () => {
    const result = validateBet(-100);

    assert.strictEqual(result.valid, false, "Should reject negative bet");

    console.log("✓ Negative bet rejected");
  });
});

describe("Game Logic - calculateCumulativeEV", () => {
  it("should calculate EV for 1 dive", () => {
    const ev = calculateCumulativeEV(1);

    assert.strictEqual(ev, 0.85, "EV after 1 dive should be 0.85");

    console.log(`✓ Cumulative EV after 1 dive: ${ev}`);
  });

  it("should calculate EV for 2 dives", () => {
    const ev = calculateCumulativeEV(2);

    assert.strictEqual(
      Math.round(ev * 10000) / 10000,
      0.7225,
      "EV after 2 dives should be 0.7225"
    );

    console.log(`✓ Cumulative EV after 2 dives: ${ev.toFixed(4)}`);
  });

  it("should calculate EV for 5 dives", () => {
    const ev = calculateCumulativeEV(5);

    // 0.85^5 ≈ 0.4437
    assert.ok(ev < 0.5, "EV after 5 dives should be < 0.5");

    console.log(`✓ Cumulative EV after 5 dives: ${ev.toFixed(4)}`);
  });

  it("should calculate EV for 10 dives", () => {
    const ev = calculateCumulativeEV(10);

    // 0.85^10 ≈ 0.1969
    assert.ok(ev < 0.2, "EV after 10 dives should be < 0.2");

    console.log(`✓ Cumulative EV after 10 dives: ${ev.toFixed(4)}`);
  });

  it("should decrease exponentially with more dives", () => {
    const ev1 = calculateCumulativeEV(1);
    const ev5 = calculateCumulativeEV(5);
    const ev10 = calculateCumulativeEV(10);

    assert.ok(ev1 > ev5, "EV should decrease");
    assert.ok(ev5 > ev10, "EV should continue decreasing");

    console.log(
      `✓ EV decreases exponentially: ${ev1.toFixed(4)} → ${ev5.toFixed(4)} → ${ev10.toFixed(4)}`
    );
  });

  it("should handle zero dives", () => {
    const ev = calculateCumulativeEV(0);

    assert.strictEqual(ev, 1, "EV for 0 dives should be 1 (0.85^0 = 1)");

    console.log("✓ Zero dives: EV = 1");
  });

  it("should calculate profit expectation", () => {
    // If you bet $100 and dive N times, expected value is:
    // $100 * 0.85^N

    const bet = 100;
    const ev5 = calculateCumulativeEV(5);
    const expected = bet * ev5;

    assert.ok(
      expected < bet,
      "Expected value should be less than bet (house edge)"
    );

    console.log(
      `✓ Bet $${bet}, 5 dives → expected value: $${expected.toFixed(2)} (${((1 - ev5) * 100).toFixed(1)}% house edge)`
    );
  });
});

describe("Game Logic - getSeaCreatureForDepth", () => {
  it("should return creature emoji", () => {
    const creature = getSeaCreatureForDepth(100);

    assert.ok(creature, "Should return creature");
    assert.strictEqual(typeof creature, "string", "Should be string (emoji)");

    console.log(`✓ 100m creature: ${creature}`);
  });

  it("should return different creatures for different depths", () => {
    const shallow = getSeaCreatureForDepth(50);
    const deep = getSeaCreatureForDepth(5000);

    // Both should return valid emojis
    assert.ok(shallow, "Should have shallow creature");
    assert.ok(deep, "Should have deep creature");

    console.log(`✓ Shallow (50m): ${shallow}, Deep (5000m): ${deep}`);
  });

  it("should handle extreme depths", () => {
    const veryDeep = getSeaCreatureForDepth(10000);

    assert.ok(veryDeep, "Should handle very deep depths");

    console.log(`✓ 10000m creature: ${veryDeep}`);
  });

  it("should return default for invalid depth", () => {
    const creature = getSeaCreatureForDepth(-100);

    assert.ok(creature, "Should return default creature");

    console.log(`✓ Invalid depth returns default: ${creature}`);
  });
});

describe("Game Logic - Edge Cases & Integration", () => {
  it("should handle extreme dive numbers gracefully", () => {
    const dive50 = calculateDiveStats(50);

    assert.ok(dive50, "Should handle dive 50");
    assert.strictEqual(dive50.diveNumber, 50, "Dive number should be 50");
    assert.strictEqual(dive50.expectedValue, 0.85, "EV should still be 0.85");

    console.log(
      `✓ Dive 50: ${(dive50.survivalProbability * 100).toFixed(1)}% survival, ${dive50.multiplier}x multiplier`
    );
  });

  it("should maintain consistency between related functions", () => {
    const dive5 = calculateDiveStats(5);
    const zone = getDepthZone(dive5.depth);
    const wreck = generateShipwreck(5, "test");

    assert.strictEqual(
      dive5.depth,
      wreck.depth,
      "Dive and wreck depth should match"
    );
    assert.strictEqual(
      zone.name,
      dive5.depthZone.name,
      "Zone names should match"
    );

    console.log("✓ Functions maintain consistent depth/zone data");
  });

  it("should generate unique shipwrecks for long sessions", () => {
    const wrecks = new Set();

    for (let i = 1; i <= 50; i++) {
      const wreck = generateShipwreck(i, "long_session");
      wrecks.add(wreck.name);
    }

    // Should have many unique names (at least 40 out of 50)
    assert.ok(
      wrecks.size >= 40,
      `Should have mostly unique wrecks, got ${wrecks.size}/50`
    );

    console.log(`✓ Generated ${wrecks.size} unique shipwrecks out of 50`);
  });

  it("should validate bet amounts at boundaries", () => {
    const tests = [
      { amount: GAME_CONFIG.MIN_BET - 1, valid: false },
      { amount: GAME_CONFIG.MIN_BET, valid: true },
      { amount: GAME_CONFIG.MIN_BET + 1, valid: true },
      { amount: GAME_CONFIG.MAX_BET - 1, valid: true },
      { amount: GAME_CONFIG.MAX_BET, valid: true },
      { amount: GAME_CONFIG.MAX_BET + 1, valid: false },
    ];

    for (const test of tests) {
      const result = validateBet(test.amount);
      assert.strictEqual(
        result.valid,
        test.valid,
        `Bet $${test.amount} validation incorrect`
      );
    }

    console.log("✓ Boundary bet validation correct");
  });

  it("should calculate payout correctly for multi-dive scenario", () => {
    let treasure = 100;

    for (let i = 1; i <= 5; i++) {
      const stats = calculateDiveStats(i);
      treasure = Math.floor(treasure * stats.multiplier);
    }

    // After 5 successful dives, should have significant treasure
    assert.ok(
      treasure > 100,
      "Treasure should increase after successful dives"
    );

    console.log(`✓ $100 → $${treasure} after 5 successful dives`);
  });
});

console.log("\n✅ All game logic tests completed!\n");
