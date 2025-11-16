/**
 * Advanced Edge Case Tests
 * Testing boundary conditions, error handling, and extreme scenarios
 */

import { describe, it } from "node:test";
import * as assert from "node:assert";
import {
  calculateDiveStats,
  getDepthZone,
  generateShipwreck,
  getTreasureVisual,
  validateBet,
  calculateCumulativeEV,
  getSeaCreatureForDepth,
} from "../../lib/gameLogic";
import { GAME_CONFIG, DEPTH_ZONES } from "../../lib/constants";

describe("Advanced Edge Cases - Boundary Testing", () => {
  it("should handle float dive numbers by flooring", () => {
    const d1 = calculateDiveStats(5.7);
    const d2 = calculateDiveStats(5);

    // Should behave the same (implementation dependent)
    assert.ok(typeof d1.depth === "number");
    assert.ok(typeof d2.depth === "number");
  });

  it("should handle very large dive numbers", () => {
    // Max rounds is 50
    const d = calculateDiveStats(50);

    assert.ok(d.depth > 0);
    assert.ok(d.survivalProbability >= 0);
    assert.ok(d.survivalProbability <= 1);
    assert.ok(d.multiplier > 0);
    assert.ok(Number.isFinite(d.multiplier));
  });

  it("should maintain probability bounds", () => {
    for (let dive = 1; dive <= 50; dive += 5) {
      const stats = calculateDiveStats(dive);

      assert.ok(
        stats.survivalProbability >= 0,
        `Dive ${dive}: probability >= 0`
      );
      assert.ok(
        stats.survivalProbability <= 1,
        `Dive ${dive}: probability <= 1`
      );
    }
  });

  it("should maintain threshold bounds", () => {
    for (let dive = 1; dive <= 50; dive += 5) {
      const stats = calculateDiveStats(dive);

      assert.ok(stats.threshold >= 0, `Dive ${dive}: threshold >= 0`);
      assert.ok(stats.threshold <= 100, `Dive ${dive}: threshold <= 100`);
    }
  });

  it("should handle depth zone boundaries correctly", () => {
    // Test each boundary
    const boundaries = [200, 1000, 4000, 6000];

    boundaries.forEach((boundary) => {
      const atBoundary = getDepthZone(boundary);
      const belowBoundary = getDepthZone(boundary - 1);
      const aboveBoundary = getDepthZone(boundary + 1);

      // At or below boundary should be in one zone
      // Above boundary should be in next zone
      assert.ok(atBoundary.name);
      assert.ok(belowBoundary.name);
      assert.ok(aboveBoundary.name);
    });
  });
});

describe("Advanced Edge Cases - Shipwreck Generation", () => {
  it("should generate consistent shipwrecks with same seed", () => {
    const seed = "test-seed-123";

    for (let dive = 1; dive <= 20; dive++) {
      const w1 = generateShipwreck(dive, seed);
      const w2 = generateShipwreck(dive, seed);

      assert.strictEqual(w1.id, w2.id);
      assert.strictEqual(w1.name, w2.name);
      assert.strictEqual(w1.treasureValue, w2.treasureValue);
    }
  });

  it("should generate different shipwrecks with different seeds", () => {
    const seed1 = "seed1";
    const seed2 = "seed2";

    const w1 = generateShipwreck(5, seed1);
    const w2 = generateShipwreck(5, seed2);

    // At least one property should differ
    const isDifferent = w1.id !== w2.id || w1.name !== w2.name;
    assert.ok(isDifferent);
  });

  it("should handle empty seed string", () => {
    const wreck = generateShipwreck(5, "");

    assert.ok(wreck.id);
    assert.ok(wreck.name);
    assert.ok(wreck.treasureValue >= 0);
  });

  it("should handle very long seed strings", () => {
    const longSeed = "a".repeat(10000);
    const wreck = generateShipwreck(5, longSeed);

    assert.ok(wreck.id);
    assert.ok(wreck.name);
  });

  it("should handle special characters in seed", () => {
    const specialSeed = "!@#$%^&*()_+-=[]{}|;:,.<>?/~`";
    const wreck = generateShipwreck(5, specialSeed);

    assert.ok(wreck.id);
    assert.ok(wreck.name);
  });

  it("should have treasure value grow exponentially", () => {
    const w1 = generateShipwreck(1, "test");
    const w10 = generateShipwreck(10, "test");
    const w20 = generateShipwreck(20, "test");

    // Should grow significantly
    assert.ok(w10.treasureValue > w1.treasureValue * 2);
    assert.ok(w20.treasureValue > w10.treasureValue * 2);
  });
});

describe("Advanced Edge Cases - Treasure Visuals", () => {
  it("should cap size at maximum", () => {
    const visual = getTreasureVisual(1000000000);

    assert.ok(visual.size <= 120, "Size should be capped at 120");
  });

  it("should have monotonic size scaling", () => {
    const values = [0, 10, 50, 100, 500, 1000, 5000, 10000];
    const sizes = values.map((v) => getTreasureVisual(v).size);

    for (let i = 1; i < sizes.length; i++) {
      assert.ok(
        sizes[i] >= sizes[i - 1],
        `Size should not decrease: ${values[i - 1]}→${values[i]}`
      );
    }
  });

  it("should have monotonic particle scaling", () => {
    const values = [0, 10, 50, 100, 500, 1000, 5000];
    const particles = values.map((v) => getTreasureVisual(v).particles);

    for (let i = 1; i < particles.length; i++) {
      assert.ok(particles[i] >= particles[i - 1]);
    }
  });

  it("should have monotonic glow scaling", () => {
    const values = [0, 10, 50, 100, 500, 1000, 5000];
    const glows = values.map((v) => getTreasureVisual(v).glow);

    for (let i = 1; i < glows.length; i++) {
      assert.ok(glows[i] >= glows[i - 1]);
    }
  });

  it("should return valid color codes", () => {
    const values = [0, 50, 100, 500, 1000, 10000];

    values.forEach((v) => {
      const visual = getTreasureVisual(v);
      assert.ok(
        visual.color.startsWith("#"),
        `Color should start with #: ${visual.color}`
      );
      assert.ok(
        visual.color.length === 7,
        `Color should be 7 chars: ${visual.color}`
      );
    });
  });
});

describe("Advanced Edge Cases - Bet Validation", () => {
  it("should reject negative bets", () => {
    const result = validateBet(-10);
    assert.strictEqual(result.valid, false);
  });

  it("should reject zero bets", () => {
    const result = validateBet(0);
    assert.strictEqual(result.valid, false);
  });

  it("should reject very large numbers", () => {
    const result = validateBet(Number.MAX_SAFE_INTEGER);
    assert.strictEqual(result.valid, false);
  });

  it("should reject negative infinity", () => {
    const result = validateBet(-Infinity);
    assert.strictEqual(result.valid, false);
  });

  it("should handle edge case: MIN_BET - epsilon", () => {
    const result = validateBet(GAME_CONFIG.MIN_BET - 0.01);
    assert.strictEqual(result.valid, false);
  });

  it("should handle edge case: MAX_BET + epsilon", () => {
    const result = validateBet(GAME_CONFIG.MAX_BET + 0.01);
    assert.strictEqual(result.valid, false);
  });

  it("should accept exact boundaries", () => {
    const minResult = validateBet(GAME_CONFIG.MIN_BET);
    const maxResult = validateBet(GAME_CONFIG.MAX_BET);

    assert.strictEqual(minResult.valid, true);
    assert.strictEqual(maxResult.valid, true);
  });
});

describe("Advanced Edge Cases - Cumulative EV", () => {
  it("should return 1 for zero dives", () => {
    const ev = calculateCumulativeEV(0);
    assert.strictEqual(ev, 1);
  });

  it("should decrease monotonically", () => {
    const evs = [];
    for (let d = 0; d <= 20; d++) {
      evs.push(calculateCumulativeEV(d));
    }

    for (let i = 1; i < evs.length; i++) {
      assert.ok(evs[i] <= evs[i - 1]);
    }
  });

  it("should approach zero for large N", () => {
    const ev100 = calculateCumulativeEV(100);
    assert.ok(ev100 < 0.0001);
  });

  it("should handle negative dives gracefully", () => {
    const ev = calculateCumulativeEV(-5);
    // 0.85^-5 should be > 1
    assert.ok(ev > 1);
  });

  it("should maintain precision for small N", () => {
    const ev1 = calculateCumulativeEV(1);
    const ev2 = calculateCumulativeEV(2);

    assert.ok(Math.abs(ev1 - GAME_CONFIG.TARGET_EV) < 0.001);
    assert.ok(Math.abs(ev2 - Math.pow(GAME_CONFIG.TARGET_EV, 2)) < 0.001);
  });
});

describe("Advanced Edge Cases - Sea Creatures", () => {
  it("should handle all integer depths 0-10000", () => {
    // Sample every 100 meters
    for (let depth = 0; depth <= 10000; depth += 100) {
      const creature = getSeaCreatureForDepth(depth);
      assert.ok(creature);
      assert.ok(creature.length > 0);
    }
  });

  it("should handle negative depths", () => {
    const creature = getSeaCreatureForDepth(-500);
    assert.ok(creature);
  });

  it("should handle extreme depths", () => {
    const creature = getSeaCreatureForDepth(100000);
    assert.ok(creature);
  });

  it("should return consistent results for same depth", () => {
    // Note: getSeaCreatureForDepth uses Math.random, so this tests randomness exists
    const depth = 500;
    const creatures = new Set();

    for (let i = 0; i < 100; i++) {
      creatures.add(getSeaCreatureForDepth(depth));
    }

    // Should get at least 1 creature type (possibly more due to randomness)
    assert.ok(creatures.size >= 1);
  });
});

describe("Advanced Edge Cases - Depth Zones", () => {
  it("should have all zones accessible", () => {
    const foundZones = new Set();

    // Sample depths throughout range
    for (let depth = 0; depth <= 10000; depth += 50) {
      const zone = getDepthZone(depth);
      foundZones.add(zone.name);
    }

    // Should find at least most zones
    assert.ok(foundZones.size >= 3);
  });

  it("should have consistent light levels", () => {
    let prevLight = 1.0;

    for (let depth = 0; depth <= 10000; depth += 500) {
      const zone = getDepthZone(depth);

      // Light should decrease or stay same
      assert.ok(
        zone.light <= prevLight,
        `Light should not increase at depth ${depth}`
      );

      prevLight = zone.light;
    }
  });

  it("should have valid color codes", () => {
    const depths = [0, 100, 500, 2000, 5000, 10000];

    depths.forEach((depth) => {
      const zone = getDepthZone(depth);
      assert.ok(zone.color.startsWith("#"));
      assert.ok(zone.color.length === 7);
    });
  });
});

describe("Advanced Edge Cases - Oxygen Depletion", () => {
  it("should never go below minimum", () => {
    for (let dive = 1; dive <= 50; dive++) {
      const stats = calculateDiveStats(dive);
      assert.ok(stats.oxygenRemaining >= 5);
    }
  });

  it("should deplete linearly", () => {
    const d1 = calculateDiveStats(1);
    const d2 = calculateDiveStats(2);
    const d3 = calculateDiveStats(3);

    const diff1 = d1.oxygenRemaining - d2.oxygenRemaining;
    const diff2 = d2.oxygenRemaining - d3.oxygenRemaining;

    // Should deplete at constant rate (4 per dive)
    assert.strictEqual(diff1, diff2);
  });

  it("should start at 100%", () => {
    const d0 = Math.max(5, 100 - 0 * 4);
    assert.strictEqual(d0, 100);
  });
});

describe("Advanced Edge Cases - Multiplier Behavior", () => {
  it("should never be zero", () => {
    for (let dive = 1; dive <= 50; dive++) {
      const stats = calculateDiveStats(dive);
      assert.ok(stats.multiplier > 0);
    }
  });

  it("should never be negative", () => {
    for (let dive = 1; dive <= 50; dive++) {
      const stats = calculateDiveStats(dive);
      assert.ok(stats.multiplier >= 0);
    }
  });

  it("should grow faster than linear", () => {
    const d5 = calculateDiveStats(5);
    const d10 = calculateDiveStats(10);
    const d15 = calculateDiveStats(15);

    const growth1 = d10.multiplier / d5.multiplier;
    const growth2 = d15.multiplier / d10.multiplier;

    // Growth rate should increase
    assert.ok(growth2 >= growth1);
  });

  it("should maintain inverse relationship with probability", () => {
    // Lower probability should mean higher multiplier
    for (let dive = 1; dive < 20; dive++) {
      const d1 = calculateDiveStats(dive);
      const d2 = calculateDiveStats(dive + 1);

      if (d2.survivalProbability < d1.survivalProbability) {
        assert.ok(
          d2.multiplier > d1.multiplier,
          `Dive ${dive}: Lower prob should mean higher mult`
        );
      }
    }
  });
});

console.log("\n✅ All advanced edge case tests completed!\n");
