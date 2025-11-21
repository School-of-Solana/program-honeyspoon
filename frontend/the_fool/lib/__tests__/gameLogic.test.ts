import { describe, it, expect } from "vitest";
import {
  calculateDiveStats,
  getDepthZone,
  generateShipwreck,
  getTreasureVisual,
  validateBet,
  calculateCumulativeEV,
} from "../gameLogic";
import { GAME_CONFIG } from "../constants";

describe("gameLogic", () => {
  describe("calculateDiveStats", () => {
    it("should calculate stats for dive 1", () => {
      const stats = calculateDiveStats(1);
      expect(stats.diveNumber).toBe(1);
      expect(stats.survivalProbability).toBeGreaterThan(0);
      expect(stats.multiplier).toBeGreaterThan(1);
      expect(stats.depth).toBe(GAME_CONFIG.DEPTH_PER_DIVE);
      expect(stats.oxygenRemaining).toBeGreaterThan(0);
    });

    it("should have decreasing survival probability with dive number", () => {
      const dive1 = calculateDiveStats(1);
      const dive5 = calculateDiveStats(5);
      const dive10 = calculateDiveStats(10);

      expect(dive5.survivalProbability).toBeLessThan(
        dive1.survivalProbability
      );
      expect(dive10.survivalProbability).toBeLessThan(
        dive5.survivalProbability
      );
    });

    it("should have increasing multiplier with dive number", () => {
      const dive1 = calculateDiveStats(1);
      const dive5 = calculateDiveStats(5);
      const dive10 = calculateDiveStats(10);

      expect(dive5.multiplier).toBeGreaterThan(dive1.multiplier);
      expect(dive10.multiplier).toBeGreaterThan(dive5.multiplier);
    });

    it("should calculate depth correctly", () => {
      const dive3 = calculateDiveStats(3);
      expect(dive3.depth).toBe(GAME_CONFIG.DEPTH_PER_DIVE * 3);
    });

    it("should deplete oxygen over dives", () => {
      const dive1 = calculateDiveStats(1);
      const dive10 = calculateDiveStats(10);
      const dive20 = calculateDiveStats(20);

      expect(dive10.oxygenRemaining).toBeLessThan(dive1.oxygenRemaining);
      expect(dive20.oxygenRemaining).toBeLessThan(dive10.oxygenRemaining);
      expect(dive20.oxygenRemaining).toBeGreaterThanOrEqual(5); // Minimum
    });

    it("should include depth zone", () => {
      const dive1 = calculateDiveStats(1);
      expect(dive1.depthZone).toBeDefined();
      expect(dive1.depthZone.name).toBeDefined();
    });
  });

  describe("getDepthZone", () => {
    it("should return shallow zone for low depths", () => {
      const zone = getDepthZone(50);
      expect(zone.name).toBe("SUNLIGHT");
    });

    it("should return correct zone for mid depths", () => {
      const zone = getDepthZone(500);
      expect(["TWILIGHT", "MIDNIGHT"]).toContain(zone.name);
    });

    it("should return hadal zone for extreme depths", () => {
      const zone = getDepthZone(10000);
      expect(zone.name).toBe("HADAL");
    });

    it("should have consistent zone properties", () => {
      const zone = getDepthZone(100);
      expect(zone.name).toBeDefined();
      expect(zone.max).toBeDefined();
      expect(zone.color).toBeDefined();
      expect(zone.light).toBeDefined();
    });
  });

  describe("generateShipwreck", () => {
    it("should generate a shipwreck with all required properties", () => {
      const shipwreck = generateShipwreck(1, "test-seed");

      expect(shipwreck.id).toBeDefined();
      expect(shipwreck.name).toBeDefined();
      expect(shipwreck.depth).toBe(GAME_CONFIG.DEPTH_PER_DIVE);
      expect(shipwreck.era).toBeDefined();
      expect(shipwreck.shipType).toBeDefined();
      expect(shipwreck.treasureType).toBeDefined();
      expect(shipwreck.visual).toBeDefined();
      expect(shipwreck.discovered).toBe(false);
      expect(shipwreck.treasureValue).toBeGreaterThan(0);
    });

    it("should generate deterministic shipwrecks for same seed", () => {
      const ship1 = generateShipwreck(1, "same-seed");
      const ship2 = generateShipwreck(1, "same-seed");

      expect(ship1.name).toBe(ship2.name);
      expect(ship1.era).toBe(ship2.era);
      expect(ship1.shipType).toBe(ship2.shipType);
      expect(ship1.treasureType).toBe(ship2.treasureType);
      expect(ship1.treasureValue).toBe(ship2.treasureValue);
    });

    it("should generate different shipwrecks for different seeds", () => {
      const ship1 = generateShipwreck(1, "seed-1");
      const ship2 = generateShipwreck(1, "seed-2");

      // At least one property should differ
      const same =
        ship1.name === ship2.name &&
        ship1.era === ship2.era &&
        ship1.shipType === ship2.shipType;
      expect(same).toBe(false);
    });

    it("should increase treasure value with dive number", () => {
      const ship1 = generateShipwreck(1, "test");
      const ship5 = generateShipwreck(5, "test");
      const ship10 = generateShipwreck(10, "test");

      expect(ship5.treasureValue).toBeGreaterThan(ship1.treasureValue);
      expect(ship10.treasureValue).toBeGreaterThan(ship5.treasureValue);
    });

    it("should have proper depth calculation", () => {
      const ship3 = generateShipwreck(3, "test");
      expect(ship3.depth).toBe(GAME_CONFIG.DEPTH_PER_DIVE * 3);
    });
  });

  describe("getTreasureVisual", () => {
    it("should return minimal visual for zero value", () => {
      const visual = getTreasureVisual(0);
      expect(visual.size).toBe(20);
      expect(visual.glow).toBe(0.1);
      expect(visual.particles).toBe(0);
      expect(visual.color).toBe("#FFD700");
    });

    it("should return small visual for low value", () => {
      const visual = getTreasureVisual(50);
      expect(visual.size).toBe(30);
      expect(visual.particles).toBe(5);
    });

    it("should return medium visual for mid value", () => {
      const visual = getTreasureVisual(300);
      expect(visual.size).toBe(45);
      expect(visual.particles).toBe(15);
    });

    it("should return large visual for high value", () => {
      const visual = getTreasureVisual(750);
      expect(visual.size).toBe(60);
      expect(visual.particles).toBe(30);
    });

    it("should return epic visual for very high value", () => {
      const visual = getTreasureVisual(5000);
      expect(visual.size).toBeGreaterThanOrEqual(80);
      expect(visual.glow).toBe(1.0);
      expect(visual.particles).toBe(50);
      expect(visual.color).toBe("#FF00FF");
    });

    it("should scale size with extreme values", () => {
      const visual1 = getTreasureVisual(10000);
      const visual2 = getTreasureVisual(100000);
      expect(visual2.size).toBeGreaterThanOrEqual(visual1.size);
      expect(visual2.size).toBeLessThanOrEqual(120); // Max cap
    });
  });

  describe("validateBet", () => {
    it("should accept valid bets within range", () => {
      const result = validateBet(0.01);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should accept minimum bet", () => {
      const result = validateBet(GAME_CONFIG.MIN_BET);
      expect(result.valid).toBe(true);
    });

    it("should accept maximum bet", () => {
      const result = validateBet(GAME_CONFIG.MAX_BET);
      expect(result.valid).toBe(true);
    });

    it("should reject bets below minimum", () => {
      const result = validateBet(GAME_CONFIG.MIN_BET - 1);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Minimum bet");
    });

    it("should reject bets above maximum", () => {
      const result = validateBet(GAME_CONFIG.MAX_BET + 1);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Maximum bet");
    });

    it("should reject NaN", () => {
      const result = validateBet(NaN);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("valid number");
    });

    it("should reject Infinity", () => {
      const result = validateBet(Infinity);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("valid number");
    });

    it("should reject negative infinity", () => {
      const result = validateBet(-Infinity);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("valid number");
    });
  });

  describe("calculateCumulativeEV", () => {
    it("should return 1 for 0 dives", () => {
      const ev = calculateCumulativeEV(0);
      expect(ev).toBe(1);
    });

    it("should return TARGET_EV for 1 dive", () => {
      const ev = calculateCumulativeEV(1);
      expect(ev).toBeCloseTo(GAME_CONFIG.TARGET_EV);
    });

    it("should compound for multiple dives", () => {
      const ev2 = calculateCumulativeEV(2);
      const ev3 = calculateCumulativeEV(3);

      expect(ev2).toBeCloseTo(Math.pow(GAME_CONFIG.TARGET_EV, 2));
      expect(ev3).toBeCloseTo(Math.pow(GAME_CONFIG.TARGET_EV, 3));
    });

    it("should decrease with more dives (TARGET_EV < 1)", () => {
      const ev1 = calculateCumulativeEV(1);
      const ev5 = calculateCumulativeEV(5);
      const ev10 = calculateCumulativeEV(10);

      expect(ev5).toBeLessThan(ev1);
      expect(ev10).toBeLessThan(ev5);
    });
  });

  // Note: getSeaCreatureForDepth uses dynamic require() which doesn't work well in tests
  // It's tested indirectly through integration tests
});
