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
    
    // The reservation should either hit the cap or be very close
    assert.ok(
      tenRoundPayout >= maxWin * 0.9, 
      `10-round reservation (${tenRoundPayout}) should be at least 90% of max win (${maxWin})`
    );
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
      
      // Check if we hit the max win cap
      if (currentValue >= GAME_CONFIG.maxPotentialWin) {
        console.log(`  🎯 Hit max win cap at round ${round}: $${currentValue.toLocaleString()}`);
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

  it("should verify 10-round horizon is mathematically sufficient", () => {
    const bet = 100;
    const reserveFor10 = calculateMaxPotentialPayout(bet, 10, GAME_CONFIG);
    const reserveFor50 = calculateMaxPotentialPayout(bet, 50, GAME_CONFIG);

    console.log('\n🔢 Mathematical Analysis:');
    console.log('='.repeat(60));
    console.log(`  Bet: $${bet}`);
    console.log(`  10 rounds reserve: $${reserveFor10.toLocaleString()}`);
    console.log(`  50 rounds reserve: $${reserveFor50.toLocaleString()}`);
    console.log(`  Max win cap: $${GAME_CONFIG.maxPotentialWin.toLocaleString()}`);
    console.log('');

    if (reserveFor10 === reserveFor50) {
      console.log('✅ SAFE: Both hit the max win cap');
      console.log('   → 10-round horizon is sufficient');
      console.log('   → Multipliers flatten out before round 10');
    } else if (reserveFor10 === GAME_CONFIG.maxPotentialWin) {
      console.log('✅ SAFE: 10-round reservation hits cap');
      console.log('   → 50-round scenario is also capped');
      console.log('   → No additional risk beyond 10 rounds');
    } else {
      console.log('⚠️  WARNING: 10 rounds may not be sufficient');
      console.log(`   Gap: $${(reserveFor50 - reserveFor10).toLocaleString()}`);
      console.log('   → Consider increasing reservation horizon');
    }
    console.log('='.repeat(60));

    // Both should equal maxPotentialWin (they're both capped)
    assert.equal(reserveFor10, GAME_CONFIG.maxPotentialWin, 
      'If this fails, we need to reserve for more than 10 rounds');
    assert.equal(reserveFor50, GAME_CONFIG.maxPotentialWin,
      '50-round payout should also be capped');
  });
});
