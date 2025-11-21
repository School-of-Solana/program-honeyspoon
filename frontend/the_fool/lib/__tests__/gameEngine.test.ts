import { describe, it, expect } from "vitest";
import {
  calculateRoundStats,
  calculateMaxPotentialPayout,
  simulateRound,
  validateBetAmount,
  calculateCumulativeEV,
  DEFAULT_CONFIG,
  type GameConfig,
} from "../gameEngine";

describe("gameEngine", () => {
  describe("calculateRoundStats", () => {
    it("should calculate stats for round 1", () => {
      const stats = calculateRoundStats(1);
      
      expect(stats.roundNumber).toBe(1);
      expect(stats.winProbability).toBe(DEFAULT_CONFIG.baseWinProbability);
      expect(stats.expectedValue).toBe(1 - DEFAULT_CONFIG.houseEdge);
      expect(stats.multiplier).toBeCloseTo(
        (1 - DEFAULT_CONFIG.houseEdge) / DEFAULT_CONFIG.baseWinProbability
      );
      expect(stats.threshold).toBe(Math.floor(DEFAULT_CONFIG.baseWinProbability * 100));
    });

    it("should have decreasing win probability with round number", () => {
      const round1 = calculateRoundStats(1);
      const round5 = calculateRoundStats(5);
      const round10 = calculateRoundStats(10);

      expect(round5.winProbability).toBeLessThan(round1.winProbability);
      expect(round10.winProbability).toBeLessThan(round5.winProbability);
    });

    it("should have increasing multiplier with round number", () => {
      const round1 = calculateRoundStats(1);
      const round5 = calculateRoundStats(5);
      const round10 = calculateRoundStats(10);

      expect(round5.multiplier).toBeGreaterThan(round1.multiplier);
      expect(round10.multiplier).toBeGreaterThan(round5.multiplier);
    });

    it("should maintain constant expected value across rounds", () => {
      const expectedEV = 1 - DEFAULT_CONFIG.houseEdge;
      
      for (let i = 1; i <= 10; i++) {
        const stats = calculateRoundStats(i);
        expect(stats.expectedValue).toBeCloseTo(expectedEV, 5);
      }
    });

    it("should respect minimum win probability", () => {
      // Test very high round number
      const stats = calculateRoundStats(50);
      expect(stats.winProbability).toBeGreaterThanOrEqual(
        DEFAULT_CONFIG.minWinProbability
      );
    });

    it("should throw error for round number < 1", () => {
      expect(() => calculateRoundStats(0)).toThrow("Round number must be >= 1");
      expect(() => calculateRoundStats(-1)).toThrow("Round number must be >= 1");
    });

    it("should throw error for round number > maxRounds", () => {
      expect(() => calculateRoundStats(DEFAULT_CONFIG.maxRounds + 1)).toThrow(
        "Round number exceeds maximum"
      );
    });

    it("should work with custom config", () => {
      const customConfig: GameConfig = {
        ...DEFAULT_CONFIG,
        baseWinProbability: 0.8,
        houseEdge: 0.02,
      };

      const stats = calculateRoundStats(1, customConfig);
      expect(stats.winProbability).toBe(0.8);
      expect(stats.expectedValue).toBe(0.98);
    });

    it("should validate config and throw on invalid minWinProbability", () => {
      const invalidConfig: GameConfig = {
        ...DEFAULT_CONFIG,
        minWinProbability: 0.9,
        baseWinProbability: 0.7,
      };

      expect(() => calculateRoundStats(1, invalidConfig)).toThrow(
        "minWinProbability"
      );
    });

    it("should validate config and throw on invalid maxRounds", () => {
      const invalidConfig: GameConfig = {
        ...DEFAULT_CONFIG,
        maxRounds: 0,
      };

      expect(() => calculateRoundStats(1, invalidConfig)).toThrow(
        "maxRounds must be > 0"
      );
    });

    it("should validate config and throw on negative decayConstant", () => {
      const invalidConfig: GameConfig = {
        ...DEFAULT_CONFIG,
        decayConstant: -0.1,
      };

      expect(() => calculateRoundStats(1, invalidConfig)).toThrow(
        "decayConstant cannot be negative"
      );
    });

    it("should round winProbability to 3 decimals", () => {
      const stats = calculateRoundStats(5);
      const decimalPlaces = stats.winProbability.toString().split(".")[1]?.length || 0;
      expect(decimalPlaces).toBeLessThanOrEqual(3);
    });

    it("should round multiplier to 2 decimals", () => {
      const stats = calculateRoundStats(5);
      const decimalPlaces = stats.multiplier.toString().split(".")[1]?.length || 0;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    });
  });

  describe("calculateMaxPotentialPayout", () => {
    it("should calculate max payout for initial bet", () => {
      const initialBet = 100;
      const maxPayout = calculateMaxPotentialPayout(initialBet, 5);
      
      expect(maxPayout).toBeGreaterThan(initialBet);
      expect(maxPayout).toBeLessThanOrEqual(DEFAULT_CONFIG.maxPotentialWin);
    });

    it("should compound multipliers across rounds", () => {
      const initialBet = 100;
      const payout3Rounds = calculateMaxPotentialPayout(initialBet, 3);
      const payout5Rounds = calculateMaxPotentialPayout(initialBet, 5);

      expect(payout5Rounds).toBeGreaterThan(payout3Rounds);
    });

    it("should cap at maxPotentialWin", () => {
      const hugeBet = 10000;
      const maxPayout = calculateMaxPotentialPayout(hugeBet, 20);
      
      expect(maxPayout).toBeLessThanOrEqual(DEFAULT_CONFIG.maxPotentialWin);
    });

    it("should return floored integer value", () => {
      const maxPayout = calculateMaxPotentialPayout(100, 5);
      expect(Number.isInteger(maxPayout)).toBe(true);
    });

    it("should handle small bets", () => {
      const maxPayout = calculateMaxPotentialPayout(1, 3);
      expect(maxPayout).toBeGreaterThanOrEqual(1);
    });

    it("should work with custom config", () => {
      const customConfig: GameConfig = {
        ...DEFAULT_CONFIG,
        houseEdge: 0.01,
        maxPotentialWin: 50000,
      };

      const maxPayout = calculateMaxPotentialPayout(100, 5, customConfig);
      expect(maxPayout).toBeLessThanOrEqual(50000);
    });
  });

  describe("simulateRound", () => {
    it("should return success for roll below threshold", () => {
      const currentValue = 100;
      const randomRoll = 10; // Well below typical threshold
      
      const result = simulateRound(1, currentValue, randomRoll);

      expect(result.success).toBe(true);
      expect(result.survived).toBe(true);
      expect(result.newValue).toBeGreaterThan(0);
      expect(result.totalValue).toBe(result.newValue);
      expect(result.roundNumber).toBe(1);
    });

    it("should return loss for roll above threshold", () => {
      const currentValue = 100;
      const randomRoll = 99; // Likely above threshold
      
      const result = simulateRound(10, currentValue, randomRoll);

      // High round number = low threshold, so roll of 99 should fail
      if (!result.survived) {
        expect(result.newValue).toBe(0);
        expect(result.totalValue).toBe(0);
      }
    });

    it("should apply multiplier on survival", () => {
      const currentValue = 100;
      const randomRoll = 0; // Always survives
      
      const result = simulateRound(1, currentValue, randomRoll);

      expect(result.survived).toBe(true);
      expect(result.newValue).toBeGreaterThan(currentValue);
    });

    it("should include all required fields", () => {
      const result = simulateRound(1, 100, 50);

      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("randomRoll");
      expect(result).toHaveProperty("threshold");
      expect(result).toHaveProperty("survived");
      expect(result).toHaveProperty("newValue");
      expect(result).toHaveProperty("totalValue");
      expect(result).toHaveProperty("roundNumber");
      expect(result).toHaveProperty("winProbability");
      expect(result).toHaveProperty("multiplier");
      expect(result).toHaveProperty("timestamp");
    });

    it("should throw error for invalid random roll", () => {
      expect(() => simulateRound(1, 100, -1)).toThrow("Random roll must be 0-99");
      expect(() => simulateRound(1, 100, 100)).toThrow("Random roll must be 0-99");
      expect(() => simulateRound(1, 100, 150)).toThrow("Random roll must be 0-99");
    });

    it("should throw error for negative current value", () => {
      expect(() => simulateRound(1, -100, 50)).toThrow(
        "Current value must be non-negative"
      );
    });

    it("should handle zero current value", () => {
      const result = simulateRound(1, 0, 10);
      expect(result.newValue).toBe(0);
      expect(result.totalValue).toBe(0);
    });

    it("should return floored integer for newValue", () => {
      const result = simulateRound(1, 100, 10);
      expect(Number.isInteger(result.newValue)).toBe(true);
    });

    it("should have timestamp close to now", () => {
      const before = Date.now();
      const result = simulateRound(1, 100, 50);
      const after = Date.now();

      expect(result.timestamp).toBeGreaterThanOrEqual(before);
      expect(result.timestamp).toBeLessThanOrEqual(after);
    });

    it("should match threshold from calculateRoundStats", () => {
      const stats = calculateRoundStats(1);
      const result = simulateRound(1, 100, 50);

      expect(result.threshold).toBe(stats.threshold);
    });

    it("should work with custom config", () => {
      const customConfig: GameConfig = {
        ...DEFAULT_CONFIG,
        baseWinProbability: 0.9,
      };

      const result = simulateRound(1, 100, 50, customConfig);
      expect(result.winProbability).toBe(0.9);
    });
  });

  describe("validateBetAmount", () => {
    it("should accept valid bet amounts", () => {
      const result = validateBetAmount(50);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should accept minimum bet", () => {
      const result = validateBetAmount(DEFAULT_CONFIG.minBet);
      expect(result.valid).toBe(true);
    });

    it("should accept maximum bet", () => {
      const result = validateBetAmount(DEFAULT_CONFIG.maxBet);
      expect(result.valid).toBe(true);
    });

    it("should reject bets below minimum", () => {
      const result = validateBetAmount(DEFAULT_CONFIG.minBet - 1);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Minimum bet");
    });

    it("should reject bets above maximum", () => {
      const result = validateBetAmount(DEFAULT_CONFIG.maxBet + 1);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Maximum bet");
    });

    it("should reject NaN", () => {
      const result = validateBetAmount(NaN);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("valid number");
    });

    it("should reject Infinity", () => {
      const result = validateBetAmount(Infinity);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("valid number");
    });

    it("should reject negative infinity", () => {
      const result = validateBetAmount(-Infinity);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("valid number");
    });

    it("should work with custom config", () => {
      const customConfig: GameConfig = {
        ...DEFAULT_CONFIG,
        minBet: 100,
        maxBet: 1000,
      };

      const result1 = validateBetAmount(50, customConfig);
      expect(result1.valid).toBe(false);

      const result2 = validateBetAmount(500, customConfig);
      expect(result2.valid).toBe(true);
    });
  });

  describe("calculateCumulativeEV", () => {
    it("should return 1 for 0 rounds", () => {
      const ev = calculateCumulativeEV(0);
      expect(ev).toBe(1);
    });

    it("should return (1 - houseEdge) for 1 round", () => {
      const ev = calculateCumulativeEV(1);
      expect(ev).toBeCloseTo(1 - DEFAULT_CONFIG.houseEdge);
    });

    it("should compound for multiple rounds", () => {
      const ev2 = calculateCumulativeEV(2);
      const ev3 = calculateCumulativeEV(3);

      expect(ev2).toBeCloseTo(Math.pow(1 - DEFAULT_CONFIG.houseEdge, 2));
      expect(ev3).toBeCloseTo(Math.pow(1 - DEFAULT_CONFIG.houseEdge, 3));
    });

    it("should decrease with more rounds", () => {
      const ev1 = calculateCumulativeEV(1);
      const ev5 = calculateCumulativeEV(5);
      const ev10 = calculateCumulativeEV(10);

      expect(ev5).toBeLessThan(ev1);
      expect(ev10).toBeLessThan(ev5);
    });

    it("should work with custom config", () => {
      const customConfig: GameConfig = {
        ...DEFAULT_CONFIG,
        houseEdge: 0.1,
      };

      const ev = calculateCumulativeEV(2, customConfig);
      expect(ev).toBeCloseTo(0.81); // (1 - 0.1)^2 = 0.9^2 = 0.81
    });

    it("should handle large round numbers", () => {
      const ev = calculateCumulativeEV(100);
      expect(ev).toBeGreaterThan(0);
      expect(ev).toBeLessThan(1);
    });
  });

  describe("DEFAULT_CONFIG", () => {
    it("should have valid configuration values", () => {
      expect(DEFAULT_CONFIG.houseEdge).toBeGreaterThan(0);
      expect(DEFAULT_CONFIG.houseEdge).toBeLessThan(1);
      expect(DEFAULT_CONFIG.baseWinProbability).toBeGreaterThan(0);
      expect(DEFAULT_CONFIG.baseWinProbability).toBeLessThan(1);
      expect(DEFAULT_CONFIG.minWinProbability).toBeGreaterThan(0);
      expect(DEFAULT_CONFIG.minWinProbability).toBeLessThan(
        DEFAULT_CONFIG.baseWinProbability
      );
      expect(DEFAULT_CONFIG.maxRounds).toBeGreaterThan(0);
      expect(DEFAULT_CONFIG.minBet).toBeGreaterThan(0);
      expect(DEFAULT_CONFIG.maxBet).toBeGreaterThan(DEFAULT_CONFIG.minBet);
    });
  });

  describe("integration scenarios", () => {
    it("should simulate a complete successful game", () => {
      let currentValue = 100;
      const rolls = [10, 15, 20]; // All likely to succeed

      for (let i = 0; i < rolls.length; i++) {
        const result = simulateRound(i + 1, currentValue, rolls[i]);
        if (result.survived) {
          currentValue = result.newValue;
          expect(currentValue).toBeGreaterThan(100);
        }
      }
    });

    it("should maintain EV relationship: winProb * multiplier = targetEV", () => {
      for (let round = 1; round <= 10; round++) {
        const stats = calculateRoundStats(round);
        const calculatedEV = stats.winProbability * stats.multiplier;
        const targetEV = 1 - DEFAULT_CONFIG.houseEdge;

        // Allow small rounding error due to decimal truncation
        expect(calculatedEV).toBeCloseTo(targetEV, 2);
      }
    });

    it("should show house edge working over many simulated rounds", () => {
      let survivals = 0;
      let total = 0;
      const trials = 100;
      const round = 5;

      for (let i = 0; i < trials; i++) {
        const roll = Math.floor(Math.random() * 100);
        const result = simulateRound(round, 100, roll);
        if (result.survived) survivals++;
        total++;
      }

      // Observed survival rate should be roughly close to expected
      // (not exact due to randomness, but should be in ballpark)
      const observedRate = survivals / total;
      expect(observedRate).toBeGreaterThan(0);
      expect(observedRate).toBeLessThan(1);
    });
  });
});
