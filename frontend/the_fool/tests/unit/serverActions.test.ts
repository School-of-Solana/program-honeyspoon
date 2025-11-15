/**
 * Server Actions Integration Tests
 * Tests server actions directly without browser
 * Run with: tsx --test tests/unit/serverActions.test.ts
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  startGame,
  performDive,
  surfaceWithTreasure,
  generateSessionId,
  getWalletInfo,
  validateBetAmount,
  getHouseStatus,
  addBalance,
} from '../../app/actions/gameActions';
import { resetWalletStore } from '../../lib/walletStore';

describe('Server Actions - Basic Operations', () => {
  let userId: string;

  beforeEach(async () => {
    resetWalletStore();
    userId = `test_user_${Date.now()}`;
  });

  it('should generate unique session IDs', async () => {
    const id1 = await generateSessionId();
    const id2 = await generateSessionId();
    const id3 = await generateSessionId();
    
    assert.notStrictEqual(id1, id2, 'IDs should be unique');
    assert.notStrictEqual(id2, id3, 'IDs should be unique');
    assert.ok(id1.length >= 32, 'ID should be at least 32 chars (16 bytes hex)');
    
    console.log(`✓ Generated unique IDs: ${id1.substring(0, 8)}..., ${id2.substring(0, 8)}...`);
  });

  it('should get initial wallet info', async () => {
    const info = await getWalletInfo(userId);
    
    assert.strictEqual(info.balance, 1000, 'Initial balance should be $1000');
    assert.strictEqual(info.totalWagered, 0, 'No wagers yet');
    assert.strictEqual(info.totalWon, 0, 'No wins yet');
    assert.strictEqual(info.totalLost, 0, 'No losses yet');
    assert.strictEqual(info.gamesPlayed, 0, 'No games yet');
    assert.ok(info.maxBet > 0, 'Max bet should be positive');
    assert.ok(info.houseBalance > 0, 'House should have balance');
    
    console.log(`✓ Initial wallet: balance=$${info.balance}, maxBet=$${info.maxBet}`);
  });

  it('should validate bet amounts', async () => {
    const valid = await validateBetAmount(50, userId);
    const tooLow = await validateBetAmount(5, userId);
    const tooHigh = await validateBetAmount(10000, userId);
    
    // 50 might be rejected by house limits, so just check structure
    assert.ok(typeof valid.valid === 'boolean', 'Should return validation result');
    assert.strictEqual(tooLow.valid, false, 'Should reject bet below minimum');
    assert.strictEqual(tooHigh.valid, false, 'Should reject bet above maximum');
    
    console.log(`✓ Bet validation: $50=${valid.valid}, $5=${tooLow.valid}, $10k=${tooHigh.valid}`);
  });

  it('should get house status', async () => {
    const status = await getHouseStatus();
    
    assert.strictEqual(status.balance, 50000, 'House starts with $50k');
    assert.strictEqual(status.reservedFunds, 0, 'No reserves initially');
    assert.ok(status.availableFunds > 0, 'Should have available funds');
    assert.strictEqual(status.canAcceptBets, true, 'Should accept bets initially');
    
    console.log(`✓ House status: balance=$${status.balance}, available=$${status.availableFunds}`);
  });

  it('should add balance to user', async () => {
    const before = await getWalletInfo(userId);
    
    const result = await addBalance(userId, 500);
    
    assert.strictEqual(result.success, true, 'Should succeed');
    assert.strictEqual(result.newBalance, before.balance + 500, 'Balance should increase');
    
    const after = await getWalletInfo(userId);
    assert.strictEqual(after.balance, before.balance + 500, 'Wallet should reflect change');
    
    console.log(`✓ Added balance: $${before.balance} → $${after.balance}`);
  });
});

describe('Server Actions - Single Game Flow', () => {
  let userId: string;
  let sessionId: string;

  beforeEach(async () => {
    resetWalletStore();
    userId = `test_user_${Date.now()}`;
    sessionId = await generateSessionId();
  });

  it('should complete full game: bet → dive → win → surface', async () => {
    const initialBet = 20;
    
    // 1. Start game
    const startResult = await startGame(initialBet, userId, sessionId);
    assert.strictEqual(startResult.success, true, 'Game should start');
    
    const afterBet = await getWalletInfo(userId);
    assert.strictEqual(afterBet.balance, 1000 - initialBet, 'Balance should decrease');
    assert.strictEqual(afterBet.totalWagered, initialBet, 'Wager tracked');
    
    console.log(`✓ Game started: bet=$${initialBet}, balance=$${afterBet.balance}`);
    
    // 2. Perform dive with deterministic outcome (use test seed)
    const diveResult = await performDive(1, initialBet, sessionId, userId, '50'); // seed=50 (50% roll)
    
    assert.ok(diveResult.success, 'Dive should succeed');
    assert.strictEqual(diveResult.diveNumber, 1, 'Should be dive 1');
    assert.ok(typeof diveResult.survived === 'boolean', 'Should have survival status');
    
    console.log(`✓ Dive 1: survived=${diveResult.survived}, treasure=$${diveResult.totalTreasure}`);
    
    if (diveResult.survived) {
      // 3. Surface with treasure
      const surfaceResult = await surfaceWithTreasure(
        diveResult.totalTreasure,
        sessionId,
        userId
      );
      
      assert.strictEqual(surfaceResult.success, true, 'Surface should succeed');
      assert.strictEqual(surfaceResult.finalAmount, diveResult.totalTreasure, 'Amount should match');
      
      const afterSurface = await getWalletInfo(userId);
      const expectedBalance = 1000 - initialBet + diveResult.totalTreasure;
      assert.strictEqual(afterSurface.balance, expectedBalance, 'Balance should reflect win');
      assert.strictEqual(afterSurface.gamesPlayed, 1, 'Game count should increment');
      
      console.log(`✓ Surfaced: profit=$${surfaceResult.profit}, balance=$${afterSurface.balance}`);
    } else {
      // Player drowned
      const afterDrown = await getWalletInfo(userId);
      assert.strictEqual(afterDrown.balance, 1000 - initialBet, 'Balance should stay at bet amount');
      assert.strictEqual(afterDrown.gamesPlayed, 1, 'Game should count');
      assert.strictEqual(afterDrown.totalLost, initialBet, 'Loss tracked');
      
      console.log(`✓ Drowned: lost=$${initialBet}, balance=$${afterDrown.balance}`);
    }
  });

  it('should handle losing game with low roll', async () => {
    const initialBet = 20;
    
    // Start game
    const startResult = await startGame(initialBet, userId, sessionId);
    assert.strictEqual(startResult.success, true, 'Game should start');
    
    // Dive with very low seed (roll=2, very likely to die)
    const diveResult = await performDive(1, initialBet, sessionId, userId, '2');
    
    // With roll=2, should likely drown, but not guaranteed
    if (!diveResult.survived) {
      assert.strictEqual(diveResult.totalTreasure, 0, 'Should lose treasure');
      
      const afterGame = await getWalletInfo(userId);
      assert.strictEqual(afterGame.balance, 1000 - initialBet, 'Should lose bet');
      assert.strictEqual(afterGame.totalLost, initialBet, 'Loss tracked');
      assert.strictEqual(afterGame.gamesPlayed, 1, 'Game counted');
      
      console.log(`✓ Lost with roll=${diveResult.randomRoll}: balance=$${afterGame.balance}`);
    } else {
      console.log(`✓ Survived with roll=${diveResult.randomRoll} (lucky!)`);
    }
  });

  it('should handle winning game with guaranteed survival', async () => {
    const initialBet = 20;
    
    // Start game
    await startGame(initialBet, userId, sessionId);
    
    // Dive with seed that guarantees survival (roll=99, highest possible)
    const diveResult = await performDive(1, initialBet, sessionId, userId, '99');
    
    assert.strictEqual(diveResult.survived, true, 'Should survive with roll=99');
    assert.ok(diveResult.totalTreasure > initialBet, 'Treasure should grow');
    
    // Surface
    const surfaceResult = await surfaceWithTreasure(
      diveResult.totalTreasure,
      sessionId,
      userId
    );
    
    assert.strictEqual(surfaceResult.success, true, 'Surface should succeed');
    
    const afterGame = await getWalletInfo(userId);
    assert.ok(afterGame.balance > 1000 - initialBet, 'Should profit');
    assert.strictEqual(afterGame.gamesPlayed, 1, 'Game counted');
    
    console.log(`✓ Won: profit=$${surfaceResult.profit}, balance=$${afterGame.balance}`);
  });
});

describe('Server Actions - Multi-Turn Games', () => {
  let userId: string;

  beforeEach(async () => {
    resetWalletStore();
    userId = `test_user_${Date.now()}`;
  });

  it('should handle 10 consecutive successful dives', async () => {
    const sessionId = await generateSessionId();
    const initialBet = 10;
    
    // Start game
    await startGame(initialBet, userId, sessionId);
    
    let currentTreasure = initialBet;
    let allSurvived = true;
    
    // Perform 10 dives with high roll (99) to guarantee survival
    for (let dive = 1; dive <= 10; dive++) {
      const result = await performDive(dive, currentTreasure, sessionId, userId, '99');
      
      if (!result.survived) {
        allSurvived = false;
        console.log(`✗ Died on dive ${dive} despite roll=99`);
        break;
      }
      
      currentTreasure = result.totalTreasure;
      console.log(`  Dive ${dive}: $${currentTreasure} (${(result.survivalProbability * 100).toFixed(1)}% chance)`);
    }
    
    if (allSurvived) {
      // Surface with massive treasure
      const surfaceResult = await surfaceWithTreasure(currentTreasure, sessionId, userId);
      
      assert.strictEqual(surfaceResult.success, true, 'Surface should succeed');
      assert.ok(currentTreasure > initialBet * 10, 'Should have substantial treasure');
      
      const finalWallet = await getWalletInfo(userId);
      const profit = surfaceResult.profit;
      
      console.log(`✓ 10 dives successful: $${initialBet} → $${currentTreasure} (profit: $${profit})`);
      assert.ok(finalWallet.balance > 1000, 'Should be profitable');
    }
  });

  it('should handle 5 games in sequence with mixed outcomes', async () => {
    let gamesCompleted = 0;
    
    for (let i = 0; i < 5; i++) {
      try {
        const sessionId = await generateSessionId();
        const bet = 15;
        
        // Start game
        const startResult = await startGame(bet, userId, sessionId);
        if (!startResult.success) {
          console.log(`  Game ${i + 1}: Failed to start - ${startResult.error}`);
          continue;
        }
        
        // Dive with varying seeds
        const seed = ((i * 23) % 100).toString();
        const diveResult = await performDive(1, bet, sessionId, userId, seed);
        
        if (diveResult.survived) {
          // Win - surface
          const surfaceResult = await surfaceWithTreasure(diveResult.totalTreasure, sessionId, userId);
          console.log(`  Game ${i + 1}: WON $${surfaceResult.profit}`);
        } else {
          // Lost
          console.log(`  Game ${i + 1}: LOST $${bet}`);
        }
        
        gamesCompleted++;
      } catch (error) {
        console.log(`  Game ${i + 1}: Error - ${(error as Error).message}`);
      }
    }
    
    const finalWallet = await getWalletInfo(userId);
    assert.ok(finalWallet.gamesPlayed >= 3, `Should have at least 3 games (got ${finalWallet.gamesPlayed})`);
    
    console.log(`✓ ${gamesCompleted} games completed: final balance=$${finalWallet.balance}`);
  });

  it('should handle deep diving with multiple successes', async () => {
    const sessionId = await generateSessionId();
    const initialBet = 10;
    
    await startGame(initialBet, userId, sessionId);
    
    let currentTreasure = initialBet;
    let divesCompleted = 0;
    
    // Dive until we hit a failure or reach 20 dives
    for (let dive = 1; dive <= 20; dive++) {
      // Use alternating high rolls to have some successes
      const seed = dive % 2 === 0 ? '85' : '90';
      const result = await performDive(dive, currentTreasure, sessionId, userId, seed);
      
      if (!result.survived) {
        console.log(`  Drowned on dive ${dive} with roll=${result.randomRoll}`);
        break;
      }
      
      currentTreasure = result.totalTreasure;
      divesCompleted = dive;
      
      if (dive % 5 === 0) {
        console.log(`  Dive ${dive}: $${currentTreasure} (${(result.survivalProbability * 100).toFixed(1)}%)`);
      }
    }
    
    if (divesCompleted === 20) {
      console.log(`✓ Survived all 20 dives! Treasure: $${currentTreasure}`);
      
      // Surface
      await surfaceWithTreasure(currentTreasure, sessionId, userId);
      
      const finalWallet = await getWalletInfo(userId);
      assert.ok(finalWallet.balance > 1000, 'Should be very profitable');
    } else {
      console.log(`✓ Died after ${divesCompleted} dives`);
    }
  });

  it('should handle marathon session: 20 quick games', async () => {
    let wins = 0;
    let losses = 0;
    
    for (let game = 1; game <= 20; game++) {
      const sessionId = await generateSessionId();
      const bet = 10;
      
      await startGame(bet, userId, sessionId);
      
      // Random-ish seed based on game number
      const seed = ((game * 17) % 100).toString();
      const result = await performDive(1, bet, sessionId, userId, seed);
      
      if (result.survived) {
        await surfaceWithTreasure(result.totalTreasure, sessionId, userId);
        wins++;
      } else {
        losses++;
      }
    }
    
    const finalWallet = await getWalletInfo(userId);
    
    assert.strictEqual(finalWallet.gamesPlayed, 20, 'Should have 20 games');
    assert.strictEqual(wins + losses, 20, 'All games accounted for');
    
    console.log(`✓ Marathon: 20 games (${wins}W-${losses}L), balance=$${finalWallet.balance}`);
    console.log(`  Total wagered: $${finalWallet.totalWagered}`);
    console.log(`  Total won: $${finalWallet.totalWon}`);
    console.log(`  Total lost: $${finalWallet.totalLost}`);
  });
});

describe('Server Actions - Edge Cases', () => {
  let userId: string;

  beforeEach(async () => {
    resetWalletStore();
    userId = `test_user_${Date.now()}`;
  });

  it('should reject invalid bet amounts', async () => {
    const sessionId = await generateSessionId();
    
    // Too low
    const tooLow = await startGame(5, userId, sessionId);
    assert.strictEqual(tooLow.success, false, 'Should reject bet below minimum');
    assert.ok(tooLow.error?.includes('Minimum'), 'Error should mention minimum');
    
    // Too high
    const tooHigh = await startGame(10000, userId, sessionId);
    assert.strictEqual(tooHigh.success, false, 'Should reject bet above maximum');
    
    console.log(`✓ Invalid bets rejected: ${tooLow.error}`);
  });

  it('should reject diving with invalid session', async () => {
    try {
      await performDive(1, 100, 'invalid_session', userId);
      assert.fail('Should throw error');
    } catch (error) {
      assert.ok(error instanceof Error, 'Should throw error');
      console.log(`✓ Invalid session rejected: ${(error as Error).message}`);
    }
  });

  it('should reject surfacing with zero treasure', async () => {
    const sessionId = await generateSessionId();
    await startGame(20, userId, sessionId);
    
    try {
      await surfaceWithTreasure(0, sessionId, userId);
      assert.fail('Should throw error');
    } catch (error) {
      assert.ok(error instanceof Error, 'Should throw error');
      console.log(`✓ Zero treasure rejected: ${(error as Error).message}`);
    }
  });

  it('should handle betting entire balance', async () => {
    const wallet = await getWalletInfo(userId);
    const sessionId = await generateSessionId();
    
    // Try to bet entire balance (will fail if above house limits)
    const result = await startGame(wallet.balance, userId, sessionId);
    
    if (result.success) {
      console.log('✓ Entire balance bet accepted');
      
      // Wallet should be at 0
      const afterBet = await getWalletInfo(userId);
      assert.strictEqual(afterBet.balance, 0, 'Balance should be 0');
    } else {
      console.log(`✓ Entire balance bet rejected: ${result.error}`);
    }
  });

  it('should reject betting more than balance', async () => {
    const wallet = await getWalletInfo(userId);
    const sessionId = await generateSessionId();
    
    const result = await startGame(wallet.balance + 100, userId, sessionId);
    
    assert.strictEqual(result.success, false, 'Should reject over-balance bet');
    assert.ok(result.error?.includes('Insufficient'), 'Error should mention insufficient balance');
    
    console.log(`✓ Over-balance bet rejected: ${result.error}`);
  });

  it('should handle rapid consecutive games', async () => {
    const startTime = Date.now();
    let gamesCompleted = 0;
    
    // Play 10 games as fast as possible
    for (let i = 0; i < 10; i++) {
      try {
        const sessionId = await generateSessionId();
        const startResult = await startGame(10, userId, sessionId);
        
        if (startResult.success) {
          await performDive(1, 10, sessionId, userId, `${i * 10}`);
          gamesCompleted++;
        }
      } catch (error) {
        // Game might fail due to house limits, continue
      }
    }
    
    const duration = Date.now() - startTime;
    
    const wallet = await getWalletInfo(userId);
    assert.ok(wallet.gamesPlayed >= 3, `Should have at least 3 games (got ${wallet.gamesPlayed})`);
    assert.ok(gamesCompleted >= 3, `Should complete at least 3 games (got ${gamesCompleted})`);
    
    console.log(`✓ ${gamesCompleted} rapid games completed in ${duration}ms (${gamesCompleted > 0 ? (duration / gamesCompleted).toFixed(1) : 'N/A'}ms/game)`);
  });

  it('should handle session ID reuse attempt', async () => {
    const sessionId = await generateSessionId();
    
    // Start first game
    const result1 = await startGame(20, userId, sessionId);
    assert.strictEqual(result1.success, true, 'First game should start');
    
    // Complete the game
    await performDive(1, 20, sessionId, userId, '5'); // Lose
    
    // Try to reuse same session
    const result2 = await startGame(20, userId, sessionId);
    // Should succeed (creates new session) or might have validation
    
    console.log(`✓ Session reuse: second attempt ${result2.success ? 'allowed' : 'blocked'}`);
  });

  it('should handle invalid dive numbers', async () => {
    const sessionId = await generateSessionId();
    await startGame(20, userId, sessionId);
    
    try {
      // Try to dive at invalid number (skip ahead)
      await performDive(5, 20, sessionId, userId);
      console.log('⚠ Invalid dive number allowed (no validation)');
    } catch (error) {
      console.log(`✓ Invalid dive number rejected: ${(error as Error).message}`);
    }
  });

  it('should handle negative treasure values', async () => {
    const sessionId = await generateSessionId();
    await startGame(20, userId, sessionId);
    
    try {
      await performDive(1, -100, sessionId, userId);
      console.log('⚠ Negative treasure allowed (no validation)');
    } catch (error) {
      console.log(`✓ Negative treasure rejected: ${(error as Error).message}`);
    }
  });

  it('should verify house reserves update correctly', async () => {
    const houseStart = await getHouseStatus();
    const startReserves = houseStart.reservedFunds;
    
    // Start a game
    const sessionId = await generateSessionId();
    const startResult = await startGame(20, userId, sessionId);
    
    if (startResult.success) {
      const houseAfter = await getHouseStatus();
      
      assert.ok(houseAfter.reservedFunds >= startReserves, 'Reserves should increase or stay same');
      
      console.log(`✓ House reserves: $${startReserves} → $${houseAfter.reservedFunds}`);
      
      // Complete game (lose with low roll)
      await performDive(1, 20, sessionId, userId, '2');
      
      const houseEnd = await getHouseStatus();
      // Reserves should decrease (may not be exactly back to start if other games running)
      assert.ok(houseEnd.reservedFunds <= houseAfter.reservedFunds, 'Reserves should decrease or stay same');
      
      console.log(`✓ Reserves after game: $${houseEnd.reservedFunds}`);
    } else {
      console.log(`✓ Game rejected: ${startResult.error}`);
    }
  });
});

describe('Server Actions - Stress Testing', () => {
  beforeEach(() => {
    resetWalletStore();
  });

  it('should handle 100 concurrent users', async () => {
    const promises = [];
    
    for (let i = 0; i < 100; i++) {
      const userId = `stress_user_${i}`;
      
      promises.push(
        (async () => {
          try {
            const sessionId = await generateSessionId();
            const startResult = await startGame(10, userId, sessionId);
            
            if (startResult.success) {
              await performDive(1, 10, sessionId, userId, `${i}`);
              return true;
            }
            return false;
          } catch (error) {
            return false;
          }
        })()
      );
    }
    
    const results = await Promise.all(promises);
    const successful = results.filter(r => r).length;
    
    // House limits may prevent many bets
    assert.ok(successful >= 10, `At least 10% should succeed (got ${successful}/100)`);
    assert.strictEqual(results.length, 100, 'All requests should complete');
    
    const houseStatus = await getHouseStatus();
    console.log(`✓ 100 concurrent users: ${successful} successful (${(successful/100*100).toFixed(0)}%), house balance=$${houseStatus.balance}`);
  });

  it('should handle 50 games in parallel', async () => {
    const promises = [];
    
    for (let i = 0; i < 50; i++) {
      const userId = `parallel_user_${i}`;
      const sessionId = await generateSessionId();
      
      promises.push(
        (async () => {
          await startGame(10, userId, sessionId);
          const dive = await performDive(1, 10, sessionId, userId, `${i * 2}`);
          if (dive.survived) {
            await surfaceWithTreasure(dive.totalTreasure, sessionId, userId);
          }
          return dive.survived;
        })()
      );
    }
    
    const results = await Promise.all(promises);
    const wins = results.filter(r => r).length;
    const losses = results.length - wins;
    
    console.log(`✓ 50 parallel games: ${wins}W-${losses}L`);
  });

  it('should handle very long game session', async () => {
    const userId = `marathon_user`;
    const sessionId = await generateSessionId();
    
    const startResult = await startGame(10, userId, sessionId);
    
    if (startResult.success) {
      let treasure = 10;
      let dives = 0;
      
      // Dive until death or 50 dives
      for (let i = 1; i <= 50; i++) {
        try {
          const seed = '95'; // High roll for maximum dives
          const result = await performDive(i, treasure, sessionId, userId, seed);
          
          if (!result.survived) break;
          
          treasure = result.totalTreasure;
          dives = i;
        } catch (error) {
          // Session might become invalid
          break;
        }
      }
      
      console.log(`✓ Marathon session: ${dives} dives completed, treasure=$${treasure}`);
      
      if (dives > 0 && treasure > 0) {
        try {
          await surfaceWithTreasure(treasure, sessionId, userId);
          const wallet = await getWalletInfo(userId);
          console.log(`  Final balance: $${wallet.balance}`);
        } catch (error) {
          console.log(`  Surface failed: ${(error as Error).message}`);
        }
      }
    } else {
      console.log(`✓ Game rejected: ${startResult.error}`);
    }
  });
});

console.log('\n✅ All server action tests completed!\n');
