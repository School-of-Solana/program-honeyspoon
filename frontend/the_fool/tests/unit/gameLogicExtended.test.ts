/**
 * Extended Game Logic Tests
 * Comprehensive tests for edge cases, boundaries, and game mechanics
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  calculateDiveStats,
  getDepthZone,
  generateShipwreck,
  getTreasureVisual,
  validateBet,
  calculateCumulativeEV,
  getSeaCreatureForDepth,
} from '../../lib/gameLogic';
import { GAME_CONFIG } from '../../lib/constants';

describe('Game Logic - Depth Zone Boundaries', () => {
  it('should handle exact zone boundaries', () => {
    const sunlightMax = getDepthZone(200);
    const twilightStart = getDepthZone(201);
    const twilightMax = getDepthZone(1000);
    const midnightStart = getDepthZone(1001);

    assert.strictEqual(sunlightMax.name, 'SUNLIGHT');
    assert.strictEqual(twilightStart.name, 'TWILIGHT');
    assert.strictEqual(twilightMax.name, 'TWILIGHT');
    assert.strictEqual(midnightStart.name, 'MIDNIGHT');
  });

  it('should handle zone transitions correctly', () => {
    const boundaries = [200, 1000, 4000];
    
    boundaries.forEach(boundary => {
      const before = getDepthZone(boundary - 1);
      const at = getDepthZone(boundary);
      const after = getDepthZone(boundary + 1);
      
      assert.ok(before.name === at.name || at.name === after.name);
    });
  });

  it('should have decreasing light with depth', () => {
    const depths = [50, 150, 500, 2000, 5000];
    const zones = depths.map(d => getDepthZone(d));
    
    for (let i = 1; i < zones.length; i++) {
      assert.ok(zones[i].light <= zones[i - 1].light,
        `Light should decrease at depth ${depths[i]}`);
    }
  });

  it('should handle negative depths', () => {
    const zone = getDepthZone(-100);
    assert.ok(zone.name === 'SUNLIGHT');
  });

  it('should handle extreme depths', () => {
    const zone = getDepthZone(20000);
    assert.strictEqual(zone.name, 'HADAL');
    assert.ok(zone.light >= 0);
  });
});

describe('Game Logic - Shipwreck Generation', () => {
  it('should generate unique IDs for sequential dives', () => {
    const session = 'test';
    const ids = new Set();
    
    for (let dive = 1; dive <= 10; dive++) {
      const wreck = generateShipwreck(dive, session);
      ids.add(wreck.id);
    }
    
    assert.strictEqual(ids.size, 10);
  });

  it('should be deterministic with same inputs', () => {
    const w1 = generateShipwreck(5, 's1');
    const w2 = generateShipwreck(5, 's1');
    
    assert.strictEqual(w1.id, w2.id);
    assert.strictEqual(w1.name, w2.name);
    assert.strictEqual(w1.treasureValue, w2.treasureValue);
  });

  it('should scale treasure with dive number', () => {
    const d1 = generateShipwreck(1, 'test');
    const d5 = generateShipwreck(5, 'test');
    const d10 = generateShipwreck(10, 'test');
    
    assert.ok(d5.treasureValue > d1.treasureValue);
    assert.ok(d10.treasureValue > d5.treasureValue);
  });

  it('should handle extreme dive numbers', () => {
    const wreck = generateShipwreck(100, 'test');
    
    assert.ok(wreck.treasureValue > 0);
    assert.ok(Number.isFinite(wreck.treasureValue));
    assert.ok(wreck.name.length > 0);
  });

  it('should assign valid eras', () => {
    const wreck = generateShipwreck(5, 'test');
    const validEras = ['Ancient', 'Medieval', 'Age of Sail', 'Industrial', 'Modern Era'];
    
    assert.ok(validEras.some(era => wreck.era.includes(era)));
  });
});

describe('Game Logic - Treasure Visual Scaling', () => {
  it('should increase size with value', () => {
    const small = getTreasureVisual(50);
    const large = getTreasureVisual(500);
    
    assert.ok(large.size >= small.size);
  });

  it('should handle zero treasure', () => {
    const visual = getTreasureVisual(0);
    assert.strictEqual(visual.size, 20);
  });

  it('should handle huge treasure values', () => {
    const visual = getTreasureVisual(1000000);
    assert.ok(Number.isFinite(visual.size));
    assert.ok(visual.size >= 20);
    assert.ok(visual.size <= 120);
  });

  it('should have particles scale with value', () => {
    const small = getTreasureVisual(50);
    const large = getTreasureVisual(500);
    
    assert.ok(large.particles >= small.particles);
  });

  it('should have glow scale with value', () => {
    const small = getTreasureVisual(100);
    const large = getTreasureVisual(2000);
    
    assert.ok(large.glow >= small.glow);
  });
});

describe('Game Logic - EV Calculations', () => {
  it('should verify EV formula correctness', () => {
    for (let dive = 1; dive <= 20; dive++) {
      const stats = calculateDiveStats(dive);
      const ev = stats.survivalProbability * stats.multiplier;
      
      assert.ok(Math.abs(ev - GAME_CONFIG.TARGET_EV) < 0.001,
        `Dive ${dive}: EV should be ~${GAME_CONFIG.TARGET_EV}`);
    }
  });

  it('should have cumulative EV decrease', () => {
    const ev1 = calculateCumulativeEV(1);
    const ev5 = calculateCumulativeEV(5);
    const ev10 = calculateCumulativeEV(10);
    
    assert.ok(ev5 < ev1);
    assert.ok(ev10 < ev5);
  });

  it('should handle zero dives', () => {
    const ev = calculateCumulativeEV(0);
    assert.strictEqual(ev, 1);
  });

  it('should approach zero for many dives', () => {
    const ev50 = calculateCumulativeEV(50);
    assert.ok(ev50 < 0.01);
  });

  it('should show house edge exists', () => {
    const bet = 100;
    const ev = calculateCumulativeEV(5);
    const expected = bet * ev;
    
    assert.ok(expected < bet, 'House has edge');
  });
});

describe('Game Logic - Probability Distribution', () => {
  it('should have survival decrease monotonically', () => {
    const probs = [];
    
    for (let dive = 1; dive <= 20; dive++) {
      probs.push(calculateDiveStats(dive).survivalProbability);
    }
    
    for (let i = 1; i < probs.length; i++) {
      assert.ok(probs[i] <= probs[i - 1]);
    }
  });

  it('should have multiplier increase monotonically', () => {
    const mults = [];
    
    for (let dive = 1; dive <= 20; dive++) {
      mults.push(calculateDiveStats(dive).multiplier);
    }
    
    for (let i = 1; i < mults.length; i++) {
      assert.ok(mults[i] >= mults[i - 1]);
    }
  });

  it('should have realistic probabilities', () => {
    const d1 = calculateDiveStats(1);
    const d10 = calculateDiveStats(10);
    const d20 = calculateDiveStats(20);
    
    assert.ok(d1.survivalProbability > 0.9);
    assert.ok(d10.survivalProbability > 0.1);
    assert.ok(d20.survivalProbability > 0.01);
  });

  it('should respect minimum survival', () => {
    const extreme = calculateDiveStats(50);
    assert.ok(extreme.survivalProbability >= GAME_CONFIG.MIN_WIN_PROB);
  });

  it('should have threshold match probability', () => {
    const stats = calculateDiveStats(5);
    const expected = Math.floor(stats.survivalProbability * 100);
    
    assert.strictEqual(stats.threshold, expected);
  });
});

describe('Game Logic - Multiplier Chains', () => {
  it('should grow value over multiple dives', () => {
    let value = 100;
    
    for (let dive = 1; dive <= 5; dive++) {
      value *= calculateDiveStats(dive).multiplier;
    }
    
    assert.ok(value > 100);
    assert.ok(Number.isFinite(value));
  });

  it('should handle long chains', () => {
    let value = 50;
    
    for (let dive = 1; dive <= 30; dive++) {
      value *= calculateDiveStats(dive).multiplier;
    }
    
    assert.ok(Number.isFinite(value));
  });

  it('should verify multiplier growth', () => {
    const m1 = calculateDiveStats(1).multiplier;
    const m5 = calculateDiveStats(5).multiplier;
    const m10 = calculateDiveStats(10).multiplier;
    
    assert.ok(m5 > m1);
    assert.ok(m10 > m5);
    assert.ok(m10 > m1 * 2);
  });

  it('should have first dive multiplier < 1', () => {
    const m = calculateDiveStats(1).multiplier;
    assert.ok(m < 1);
    assert.ok(m > 0.8);
  });
});

describe('Game Logic - Oxygen Depletion', () => {
  it('should deplete oxygen over dives', () => {
    const oxygen = [];
    
    for (let dive = 1; dive <= 10; dive++) {
      oxygen.push(calculateDiveStats(dive).oxygenRemaining);
    }
    
    for (let i = 1; i < oxygen.length; i++) {
      assert.ok(oxygen[i] <= oxygen[i - 1]);
    }
  });

  it('should respect minimum oxygen', () => {
    const extreme = calculateDiveStats(50);
    assert.ok(extreme.oxygenRemaining >= 5);
  });

  it('should start with high oxygen', () => {
    const d1 = calculateDiveStats(1);
    assert.ok(d1.oxygenRemaining >= 95);
  });

  it('should reach low oxygen at deep dives', () => {
    const d20 = calculateDiveStats(20);
    assert.ok(d20.oxygenRemaining < 30);
  });
});

describe('Game Logic - Bet Validation', () => {
  it('should accept valid bets', () => {
    [10, 20, 50, 100, 250, 500].forEach(bet => {
      const result = validateBet(bet);
      assert.strictEqual(result.valid, true);
    });
  });

  it('should reject out of range bets', () => {
    [9.99, 500.01, 1000].forEach(bet => {
      const result = validateBet(bet);
      assert.strictEqual(result.valid, false);
    });
  });

  it('should handle decimal bets', () => {
    const result = validateBet(50.50);
    assert.strictEqual(result.valid, true);
  });

  it('should reject NaN', () => {
    const result = validateBet(NaN);
    assert.strictEqual(result.valid, false);
  });

  it('should reject Infinity', () => {
    const result = validateBet(Infinity);
    assert.strictEqual(result.valid, false);
  });

  it('should handle boundary values', () => {
    const min = validateBet(GAME_CONFIG.MIN_BET);
    const max = validateBet(GAME_CONFIG.MAX_BET);
    
    assert.strictEqual(min.valid, true);
    assert.strictEqual(max.valid, true);
  });
});

describe('Game Logic - Sea Creatures', () => {
  it('should return creatures for all zones', () => {
    const depths = [50, 500, 2000, 5000, 8000];
    
    depths.forEach(depth => {
      const creature = getSeaCreatureForDepth(depth);
      assert.ok(typeof creature === 'string');
      assert.ok(creature.length > 0);
    });
  });

  it('should handle boundary depths', () => {
    [200, 1000, 4000, 6000].forEach(depth => {
      const creature = getSeaCreatureForDepth(depth);
      assert.ok(creature.length > 0);
    });
  });

  it('should handle zero depth', () => {
    const creature = getSeaCreatureForDepth(0);
    assert.ok(creature.length > 0);
  });

  it('should handle negative depth', () => {
    const creature = getSeaCreatureForDepth(-100);
    assert.ok(creature.length > 0);
  });
});

describe('Game Logic - Depth Calculations', () => {
  it('should calculate correct depth per dive', () => {
    const d1 = calculateDiveStats(1);
    const d2 = calculateDiveStats(2);
    
    const depthDiff = d2.depth - d1.depth;
    assert.strictEqual(depthDiff, GAME_CONFIG.DEPTH_PER_DIVE);
  });

  it('should start at correct initial depth', () => {
    const d1 = calculateDiveStats(1);
    assert.strictEqual(d1.depth, GAME_CONFIG.STARTING_DEPTH + GAME_CONFIG.DEPTH_PER_DIVE);
  });

  it('should scale linearly with dive number', () => {
    const d5 = calculateDiveStats(5);
    const d10 = calculateDiveStats(10);
    
    assert.strictEqual(d10.depth, d5.depth + (5 * GAME_CONFIG.DEPTH_PER_DIVE));
  });
});

console.log('\n✅ All extended game logic tests completed!\n');
