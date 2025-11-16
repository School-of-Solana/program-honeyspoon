/**
 * House Reservation Horizon Tests
 * 
 * Tests whether the house reserves enough funds for maximum potential payouts.
 * This is critical to prevent the house from paying out more than it reserved.
 * 
 * Run with: npm test
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { 
  startGameSession, 
  executeRound,
  cashOut
} from "../../app/actions/gameEngine";
import { 
  getGameSession,
  getHouseWallet 
} from "../../lib/walletStore";
import { calculateMaxPotentialPayout, DEFAULT_CONFIG } from "../../lib/gameEngine";

const GAME_CONFIG = {
  ...DEFAULT_CONFIG,
  houseEdge: 0.15,
  baseWinProbability: 0.95,
  decayConstant: 0.15,
  minWinProbability: 0.01,
  maxBet: 500,
  maxPotentialWin: 100000,
  maxRounds: 50,
};

describe("Blindspot #3: House Reservation Horizon", () => {
  it("should calculate max potential payouts for different round counts", () => {
    const bet = 100;
    
    console.log('\n📊 Reservation Analysis:');
    console.log('='.repeat(60));
    
    const roundCounts = [5, 10, 15, 20, 30, 50];
    const payouts: number[] = [];
    
    for (const rounds of roundCounts) {
      const payout = calculateMaxPotentialPayout(bet, rounds, GAME_CONFIG);
      payouts.push(payout);
      console.log(`  ${rounds} rounds: $${payout.toLocaleString()}`);
    }
    
    console.log('='.repeat(60));
    console.log(`  Max win cap: $${GAME_CONFIG.maxPotentialWin.toLocaleString()}`);
    console.log('');
    
    // Check if 10-round reservation hits the cap
    const tenRoundPayout = payouts[1]; // Index 1 = 10 rounds
    const maxWin = GAME_CONFIG.maxPotentialWin;
    
    if (tenRoundPayout >= maxWin) {
      console.log('✅ SAFE: 10-round reservation hits the cap');
      console.log(`   Reserved: $${tenRoundPayout.toLocaleString()}`);
      console.log(`   Cap: $${maxWin.toLocaleString()}`);
    } else {
      console.log('⚠️  RISK: 10-round reservation does NOT hit the cap');
      console.log(`   Reserved: $${tenRoundPayout.toLocaleString()}`);
      console.log(`   Cap: $${maxWin.toLocaleString()}`);
      console.log(`   Gap: $${(maxWin - tenRoundPayout).toLocaleString()}`);
    }
    console.log('');
    
    // Document that 10 rounds is NOT sufficient (this is expected to show the gap)
    // The actual game now reserves for maxRounds, not 10
    console.log('📝 This test documents why we MUST reserve for maxRounds');
    console.log('   The gap shows the financial risk of only reserving for 10 rounds');
    console.log('');
  });

  it("should never pay out more than reserved funds on long winning streak", async () => {
    const userId = "user-long-streak";
    const sessionId = "session-long-streak";
    const bet = 100;

    const start = await startGameSession(bet, userId, sessionId);
    assert.equal(start.success, true);

    const houseBeforeGame = getHouseWallet();
    const sessionAfterStart = getGameSession(sessionId)!;
    const reservedFunds = sessionAfterStart.reservedPayout;

    console.log('\n🎰 Long Winning Streak Test:');
    console.log('='.repeat(60));
    console.log(`  Initial bet: $${bet}`);
    console.log(`  Reserved funds: $${reservedFunds.toLocaleString()}`);
    console.log('');

    // Simulate a very long winning streak (20 rounds with guaranteed wins)
    let currentValue = bet;
    let round = 1;
    const maxRounds = 20;
    
    console.log('  Simulating winning streak:');
    while (round <= maxRounds) {
      const result = await executeRound(round, currentValue, sessionId, userId, "50"); // Seed 50 = win
      
      if (!result.survived) {
        console.log(`  Round ${round}: LOST (unexpected with seed 50)`);
        break;
      }
      
      currentValue = result.totalValue;
      
      if (round % 5 === 0 || round === maxRounds) {
        console.log(`  Round ${round}: $${currentValue.toLocaleString()}`);
      }
      
        // Check if we hit the max win cap (capped by cashOut, not by multiplier)
      if (currentValue >= GAME_CONFIG.maxPotentialWin) {
        console.log(`  🎯 Hit max win cap at round ${round}: $${currentValue.toLocaleString()}`);
        // Note: The cap is enforced at cashOut time
        break;
      }
      
      round++;
    }

    console.log('');
    console.log('  Cashing out...');
    
    // Cash out
    const cashOutResult = await cashOut(currentValue, sessionId, userId);
    assert.equal(cashOutResult.success, true);

    const houseAfterGame = getHouseWallet();
    const housePaidOut = houseBeforeGame.balance - houseAfterGame.balance;

    console.log(`  Final value: $${currentValue.toLocaleString()}`);
    console.log(`  House paid out: $${housePaidOut.toLocaleString()}`);
    console.log(`  Reserved funds: $${reservedFunds.toLocaleString()}`);
    console.log('');

    // CRITICAL: House should never pay more than it reserved
    if (housePaidOut <= reservedFunds) {
      console.log('✅ SAFE: House paid out ≤ reserved funds');
      const margin = reservedFunds - housePaidOut;
      console.log(`   Margin: $${margin.toLocaleString()}`);
    } else {
      console.log('❌ DANGER: House paid out MORE than reserved!');
      const overage = housePaidOut - reservedFunds;
      console.log(`   Overage: $${overage.toLocaleString()}`);
    }
    console.log('='.repeat(60));

    assert.ok(
      housePaidOut <= reservedFunds,
      `House payout ($${housePaidOut}) exceeded reserved funds ($${reservedFunds})`
    );
  });

  it("should handle the absolute maximum theoretical payout", async () => {
    const userId = "user-max-payout";
    const sessionId = "session-max-payout";
    const bet = 500; // Max bet

    const start = await startGameSession(bet, userId, sessionId);
    assert.equal(start.success, true);

    const session = getGameSession(sessionId)!;
    const reservedFunds = session.reservedPayout;

    console.log('\n💰 Maximum Payout Scenario:');
    console.log('='.repeat(60));
    console.log(`  Max bet: $${bet}`);
    console.log(`  Reserved: $${reservedFunds.toLocaleString()}`);
    console.log(`  Max win cap: $${GAME_CONFIG.maxPotentialWin.toLocaleString()}`);
    
    // The reserved amount should be capped by maxPotentialWin
    assert.ok(
      reservedFunds <= GAME_CONFIG.maxPotentialWin,
      `Reserved funds should not exceed max potential win`
    );
    
    console.log('✅ Reservation is properly capped');
    console.log('='.repeat(60));
  });

  it("should verify game now reserves for maxRounds (not just 10)", async () => {
    const userId = "user-verify-reserve";
    const sessionId = "session-verify-reserve";
    const bet = 100;
    
    const reserveFor10 = calculateMaxPotentialPayout(bet, 10, GAME_CONFIG);
    const reserveFor50 = calculateMaxPotentialPayout(bet, 50, GAME_CONFIG);

    console.log('\n🔢 Reservation Fix Verification:');
    console.log('='.repeat(60));
    console.log(`  Bet: $${bet}`);
    console.log(`  10 rounds reserve: $${reserveFor10.toLocaleString()}`);
    console.log(`  50 rounds reserve: $${reserveFor50.toLocaleString()}`);
    console.log(`  Max win cap: $${GAME_CONFIG.maxPotentialWin.toLocaleString()}`);
    console.log('');

    // Start a game and check what it actually reserved
    const start = await startGameSession(bet, userId, sessionId);
    assert.equal(start.success, true);
    
    const session = getGameSession(sessionId)!;
    const actualReserved = session.reservedPayout;
    
    console.log(`  Game actually reserved: $${actualReserved.toLocaleString()}`);
    console.log('');

    if (actualReserved === reserveFor50) {
      console.log('✅ FIXED: Game now reserves for maxRounds (50)');
      console.log('   → Safe against long winning streaks');
    } else if (actualReserved === reserveFor10) {
      console.log('❌ NOT FIXED: Game still reserves for only 10 rounds');
      console.log('   → Vulnerable to overpayment');
    } else {
      console.log(`⚠️  Unexpected reservation: $${actualReserved.toLocaleString()}`);
    }
    console.log('='.repeat(60));

    // The game should now reserve for maxRounds (50)
    assert.equal(actualReserved, reserveFor50, 
      'Game should reserve for maxRounds, not just 10');
  });
});
