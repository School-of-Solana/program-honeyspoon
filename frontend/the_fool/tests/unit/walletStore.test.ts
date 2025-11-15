/**
 * Unit Tests for Wallet Store
 * Run with: node --import tsx --test tests/unit/walletStore.test.ts
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  getUserWallet,
  updateUserWallet,
  getHouseWallet,
  updateHouseWallet,
  addTransaction,
  getUserTransactions,
  setGameSession,
  getGameSession,
  deleteGameSession,
  getUserActiveSessions,
  resetWalletStore,
  addUserBalance,
  getWalletStats,
} from '../../lib/walletStore';
import type { Transaction, GameSession } from '../../lib/walletTypes';

describe('Wallet Store - User Wallets', () => {
  beforeEach(() => {
    resetWalletStore();
  });

  it('should create new user wallet with $1000', () => {
    const wallet = getUserWallet('user1');
    
    assert.strictEqual(wallet.userId, 'user1', 'User ID should match');
    assert.strictEqual(wallet.balance, 1000, 'Starting balance should be $1000');
    assert.strictEqual(wallet.totalWagered, 0, 'Total wagered should be 0');
    assert.strictEqual(wallet.gamesPlayed, 0, 'Games played should be 0');
    
    console.log('✓ New user wallet created with $1000');
  });

  it('should return same wallet on multiple calls', () => {
    const wallet1 = getUserWallet('user1');
    const wallet2 = getUserWallet('user1');
    
    assert.deepStrictEqual(wallet1, wallet2, 'Should return same wallet');
    
    console.log('✓ Same wallet returned on multiple calls');
  });

  it('should create different wallets for different users', () => {
    const wallet1 = getUserWallet('user1');
    const wallet2 = getUserWallet('user2');
    
    assert.notStrictEqual(wallet1.userId, wallet2.userId, 'User IDs should differ');
    
    console.log('✓ Different wallets for different users');
  });

  it('should update user wallet', () => {
    const wallet = getUserWallet('user1');
    wallet.balance = 500;
    wallet.totalWagered = 100;
    
    updateUserWallet(wallet);
    
    const updated = getUserWallet('user1');
    assert.strictEqual(updated.balance, 500, 'Balance should be updated');
    assert.strictEqual(updated.totalWagered, 100, 'Total wagered should be updated');
    
    console.log('✓ User wallet updated successfully');
  });

  it('should add balance to user', () => {
    const wallet1 = getUserWallet('user1');
    const initialBalance = wallet1.balance;
    
    const updated = addUserBalance('user1', 500);
    
    assert.strictEqual(updated.balance, initialBalance + 500, 'Should add $500');
    
    const wallet2 = getUserWallet('user1');
    assert.strictEqual(wallet2.balance, initialBalance + 500, 'Change should persist');
    
    console.log('✓ Balance added to user wallet');
  });

  it('should handle negative balance addition', () => {
    getUserWallet('user1'); // Initialize
    
    const updated = addUserBalance('user1', -100);
    
    assert.strictEqual(updated.balance, 900, 'Should subtract $100 from $1000');
    
    console.log('✓ Negative balance addition handled');
  });
});

describe('Wallet Store - House Wallet', () => {
  beforeEach(() => {
    resetWalletStore();
  });

  it('should initialize house wallet with $50,000', () => {
    const house = getHouseWallet();
    
    assert.strictEqual(house.balance, 50000, 'Starting balance should be $50k');
    assert.strictEqual(house.reservedFunds, 0, 'Reserved funds should be 0');
    assert.strictEqual(house.totalPaidOut, 0, 'Total paid out should be 0');
    assert.strictEqual(house.totalReceived, 0, 'Total received should be 0');
    
    console.log('✓ House wallet initialized with $50k');
  });

  it('should update house wallet', () => {
    let house = getHouseWallet();
    house.balance = 45000;
    house.reservedFunds = 5000;
    
    updateHouseWallet(house);
    
    house = getHouseWallet();
    assert.strictEqual(house.balance, 45000, 'Balance should be updated');
    assert.strictEqual(house.reservedFunds, 5000, 'Reserved funds should be updated');
    
    console.log('✓ House wallet updated successfully');
  });

  it('should return copy of house wallet', () => {
    const house1 = getHouseWallet();
    house1.balance = 99999; // Modify returned object
    
    const house2 = getHouseWallet();
    assert.notStrictEqual(house2.balance, 99999, 'Should not affect actual wallet');
    
    console.log('✓ House wallet returns copy (immutable)');
  });

  it('should persist changes after update', () => {
    let house = getHouseWallet();
    house.balance = 40000;
    updateHouseWallet(house);
    
    house = getHouseWallet();
    assert.strictEqual(house.balance, 40000, 'Changes should persist');
    
    console.log('✓ House wallet changes persist');
  });
});

describe('Wallet Store - Transactions', () => {
  beforeEach(() => {
    resetWalletStore();
  });

  it('should add transaction', () => {
    const transaction: Transaction = {
      id: 'tx1',
      userId: 'user1',
      type: 'bet',
      amount: 100,
      balanceBefore: 1000,
      balanceAfter: 900,
      gameSessionId: 'session1',
      timestamp: Date.now(),
    };
    
    addTransaction(transaction);
    
    const txs = getUserTransactions('user1');
    assert.strictEqual(txs.length, 1, 'Should have 1 transaction');
    assert.strictEqual(txs[0].id, 'tx1', 'Transaction ID should match');
    
    console.log('✓ Transaction added successfully');
  });

  it('should retrieve transactions for specific user', () => {
    addTransaction({
      id: 'tx1',
      userId: 'user1',
      type: 'bet',
      amount: 100,
      balanceBefore: 1000,
      balanceAfter: 900,
      gameSessionId: 'session1',
      timestamp: Date.now(),
    });
    
    addTransaction({
      id: 'tx2',
      userId: 'user2',
      type: 'bet',
      amount: 50,
      balanceBefore: 1000,
      balanceAfter: 950,
      gameSessionId: 'session2',
      timestamp: Date.now(),
    });
    
    const user1Txs = getUserTransactions('user1');
    const user2Txs = getUserTransactions('user2');
    
    assert.strictEqual(user1Txs.length, 1, 'User1 should have 1 transaction');
    assert.strictEqual(user2Txs.length, 1, 'User2 should have 1 transaction');
    assert.strictEqual(user1Txs[0].userId, 'user1', 'Transaction should be for user1');
    
    console.log('✓ Transactions filtered by user');
  });

  it('should sort transactions by timestamp (newest first)', () => {
    const now = Date.now();
    
    addTransaction({
      id: 'tx1',
      userId: 'user1',
      type: 'bet',
      amount: 100,
      balanceBefore: 1000,
      balanceAfter: 900,
      gameSessionId: 'session1',
      timestamp: now - 2000,
    });
    
    addTransaction({
      id: 'tx2',
      userId: 'user1',
      type: 'win',
      amount: 200,
      balanceBefore: 900,
      balanceAfter: 1100,
      gameSessionId: 'session1',
      timestamp: now,
    });
    
    const txs = getUserTransactions('user1');
    
    assert.strictEqual(txs[0].id, 'tx2', 'Newest transaction should be first');
    assert.strictEqual(txs[1].id, 'tx1', 'Oldest transaction should be second');
    
    console.log('✓ Transactions sorted by timestamp');
  });

  it('should limit transaction results', () => {
    for (let i = 0; i < 20; i++) {
      addTransaction({
        id: `tx${i}`,
        userId: 'user1',
        type: 'bet',
        amount: 10,
        balanceBefore: 1000,
        balanceAfter: 990,
        gameSessionId: `session${i}`,
        timestamp: Date.now() + i,
      });
    }
    
    const txs = getUserTransactions('user1', 5);
    
    assert.strictEqual(txs.length, 5, 'Should limit to 5 transactions');
    
    console.log('✓ Transaction results limited');
  });

  it('should handle different transaction types', () => {
    const types: Array<Transaction['type']> = ['bet', 'win', 'loss', 'surface', 'deposit', 'withdrawal'];
    
    types.forEach((type, i) => {
      addTransaction({
        id: `tx${i}`,
        userId: 'user1',
        type,
        amount: 100,
        balanceBefore: 1000,
        balanceAfter: 1000,
        gameSessionId: 'session1',
        timestamp: Date.now(),
      });
    });
    
    const txs = getUserTransactions('user1', 10);
    assert.strictEqual(txs.length, 6, 'Should have all transaction types');
    
    console.log('✓ All transaction types supported');
  });
});

describe('Wallet Store - Game Sessions', () => {
  beforeEach(() => {
    resetWalletStore();
  });

  it('should create and retrieve game session', () => {
    const session: GameSession = {
      sessionId: 'session1',
      userId: 'user1',
      initialBet: 100,
      currentTreasure: 100,
      diveNumber: 1,
      isActive: true,
      reservedPayout: 5000,
      startTime: Date.now(),
    };
    
    setGameSession(session);
    
    const retrieved = getGameSession('session1');
    assert.ok(retrieved, 'Session should exist');
    assert.strictEqual(retrieved?.sessionId, 'session1', 'Session ID should match');
    assert.strictEqual(retrieved?.initialBet, 100, 'Initial bet should match');
    
    console.log('✓ Game session created and retrieved');
  });

  it('should update existing game session', () => {
    const session: GameSession = {
      sessionId: 'session1',
      userId: 'user1',
      initialBet: 100,
      currentTreasure: 100,
      diveNumber: 1,
      isActive: true,
      reservedPayout: 5000,
      startTime: Date.now(),
    };
    
    setGameSession(session);
    
    session.currentTreasure = 200;
    session.diveNumber = 2;
    setGameSession(session);
    
    const retrieved = getGameSession('session1');
    assert.strictEqual(retrieved?.currentTreasure, 200, 'Treasure should be updated');
    assert.strictEqual(retrieved?.diveNumber, 2, 'Dive number should be updated');
    
    console.log('✓ Game session updated');
  });

  it('should delete game session', () => {
    const session: GameSession = {
      sessionId: 'session1',
      userId: 'user1',
      initialBet: 100,
      currentTreasure: 100,
      diveNumber: 1,
      isActive: true,
      reservedPayout: 5000,
      startTime: Date.now(),
    };
    
    setGameSession(session);
    deleteGameSession('session1');
    
    const retrieved = getGameSession('session1');
    assert.strictEqual(retrieved, undefined, 'Session should be deleted');
    
    console.log('✓ Game session deleted');
  });

  it('should return undefined for non-existent session', () => {
    const session = getGameSession('nonexistent');
    
    assert.strictEqual(session, undefined, 'Should return undefined');
    
    console.log('✓ Non-existent session returns undefined');
  });

  it('should retrieve active sessions for user', () => {
    const session1: GameSession = {
      sessionId: 'session1',
      userId: 'user1',
      initialBet: 100,
      currentTreasure: 100,
      diveNumber: 1,
      isActive: true,
      reservedPayout: 5000,
      startTime: Date.now(),
    };
    
    const session2: GameSession = {
      sessionId: 'session2',
      userId: 'user1',
      initialBet: 50,
      currentTreasure: 50,
      diveNumber: 1,
      isActive: false,
      reservedPayout: 2500,
      startTime: Date.now(),
    };
    
    const session3: GameSession = {
      sessionId: 'session3',
      userId: 'user2',
      initialBet: 200,
      currentTreasure: 200,
      diveNumber: 1,
      isActive: true,
      reservedPayout: 10000,
      startTime: Date.now(),
    };
    
    setGameSession(session1);
    setGameSession(session2);
    setGameSession(session3);
    
    const activeSessions = getUserActiveSessions('user1');
    
    assert.strictEqual(activeSessions.length, 1, 'Should have 1 active session');
    assert.strictEqual(activeSessions[0].sessionId, 'session1', 'Should be session1');
    
    console.log('✓ Active sessions retrieved for user');
  });

  it('should handle multiple sessions per user', () => {
    for (let i = 0; i < 3; i++) {
      setGameSession({
        sessionId: `session${i}`,
        userId: 'user1',
        initialBet: 100,
        currentTreasure: 100,
        diveNumber: 1,
        isActive: true,
        reservedPayout: 5000,
        startTime: Date.now(),
      });
    }
    
    const sessions = getUserActiveSessions('user1');
    assert.strictEqual(sessions.length, 3, 'Should have 3 sessions');
    
    console.log('✓ Multiple sessions per user supported');
  });
});

describe('Wallet Store - Statistics', () => {
  beforeEach(() => {
    resetWalletStore();
  });

  it('should return wallet statistics', () => {
    getUserWallet('user1');
    getUserWallet('user2');
    
    const stats = getWalletStats();
    
    assert.strictEqual(stats.totalUsers, 2, 'Should have 2 users');
    assert.strictEqual(stats.totalUserBalance, 2000, 'Total balance should be $2000');
    assert.strictEqual(stats.houseBalance, 50000, 'House balance should be $50k');
    
    console.log('✓ Wallet statistics retrieved');
  });

  it('should track active sessions in stats', () => {
    setGameSession({
      sessionId: 'session1',
      userId: 'user1',
      initialBet: 100,
      currentTreasure: 100,
      diveNumber: 1,
      isActive: true,
      reservedPayout: 5000,
      startTime: Date.now(),
    });
    
    const stats = getWalletStats();
    assert.strictEqual(stats.activeSessions, 1, 'Should have 1 active session');
    
    console.log('✓ Active sessions tracked in stats');
  });

  it('should track transaction count in stats', () => {
    addTransaction({
      id: 'tx1',
      userId: 'user1',
      type: 'bet',
      amount: 100,
      balanceBefore: 1000,
      balanceAfter: 900,
      gameSessionId: 'session1',
      timestamp: Date.now(),
    });
    
    addTransaction({
      id: 'tx2',
      userId: 'user1',
      type: 'win',
      amount: 200,
      balanceBefore: 900,
      balanceAfter: 1100,
      gameSessionId: 'session1',
      timestamp: Date.now(),
    });
    
    const stats = getWalletStats();
    assert.strictEqual(stats.totalTransactions, 2, 'Should have 2 transactions');
    
    console.log('✓ Transaction count tracked in stats');
  });

  it('should update stats after wallet changes', () => {
    const user = getUserWallet('user1');
    user.balance = 500;
    updateUserWallet(user);
    
    const house = getHouseWallet();
    house.balance = 60000;
    updateHouseWallet(house);
    
    const stats = getWalletStats();
    assert.strictEqual(stats.totalUserBalance, 500, 'User balance should update');
    assert.strictEqual(stats.houseBalance, 60000, 'House balance should update');
    
    console.log('✓ Stats reflect wallet changes');
  });
});

describe('Wallet Store - Reset', () => {
  it('should reset all wallet data', () => {
    // Create some data
    getUserWallet('user1');
    getUserWallet('user2');
    addTransaction({
      id: 'tx1',
      userId: 'user1',
      type: 'bet',
      amount: 100,
      balanceBefore: 1000,
      balanceAfter: 900,
      gameSessionId: 'session1',
      timestamp: Date.now(),
    });
    setGameSession({
      sessionId: 'session1',
      userId: 'user1',
      initialBet: 100,
      currentTreasure: 100,
      diveNumber: 1,
      isActive: true,
      reservedPayout: 5000,
      startTime: Date.now(),
    });
    
    // Reset
    resetWalletStore();
    
    // Check everything is reset
    const stats = getWalletStats();
    assert.strictEqual(stats.totalUsers, 0, 'Users should be cleared');
    assert.strictEqual(stats.totalTransactions, 0, 'Transactions should be cleared');
    assert.strictEqual(stats.activeSessions, 0, 'Sessions should be cleared');
    assert.strictEqual(stats.houseBalance, 50000, 'House should be reset to $50k');
    
    console.log('✓ Wallet store reset successfully');
  });

  it('should allow new data after reset', () => {
    resetWalletStore();
    
    const wallet = getUserWallet('user1');
    assert.strictEqual(wallet.balance, 1000, 'New wallet should have $1000');
    
    console.log('✓ New data can be created after reset');
  });
});

describe('Wallet Store - Edge Cases', () => {
  beforeEach(() => {
    resetWalletStore();
  });

  it('should handle empty transaction history', () => {
    const txs = getUserTransactions('nonexistent');
    
    assert.strictEqual(txs.length, 0, 'Should return empty array');
    
    console.log('✓ Empty transaction history handled');
  });

  it('should handle empty active sessions', () => {
    const sessions = getUserActiveSessions('nonexistent');
    
    assert.strictEqual(sessions.length, 0, 'Should return empty array');
    
    console.log('✓ Empty active sessions handled');
  });

  it('should handle deleting non-existent session', () => {
    // Should not throw error
    deleteGameSession('nonexistent');
    
    console.log('✓ Deleting non-existent session handled');
  });

  it('should handle very long user IDs', () => {
    const longId = 'x'.repeat(1000);
    const wallet = getUserWallet(longId);
    
    assert.strictEqual(wallet.userId, longId, 'Should handle long user IDs');
    
    console.log('✓ Long user IDs handled');
  });

  it('should handle special characters in user IDs', () => {
    const specialId = 'user!@#$%^&*()_+-={}[]|:";\'<>?,./';
    const wallet = getUserWallet(specialId);
    
    assert.strictEqual(wallet.userId, specialId, 'Should handle special characters');
    
    console.log('✓ Special characters in user IDs handled');
  });

  it('should maintain separate state for multiple users', () => {
    const wallet1 = getUserWallet('user1');
    wallet1.balance = 500;
    updateUserWallet(wallet1);
    
    const wallet2 = getUserWallet('user2');
    
    assert.strictEqual(wallet2.balance, 1000, 'User2 should have default balance');
    assert.notStrictEqual(wallet1.balance, wallet2.balance, 'Balances should be independent');
    
    console.log('✓ Multiple users maintain separate state');
  });
});

console.log('\n✅ All wallet store tests completed!\n');
