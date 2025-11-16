/**
 * Mock Wallet Storage (In-Memory)
 * In production, this would be replaced with database/blockchain integration
 */

import type {
  GameSession,
  HouseWallet,
  Transaction,
  UserWallet,
} from "./walletTypes";

// In-memory storage
const userWallets = new Map<string, UserWallet>();
const transactions: Transaction[] = [];
const activeSessions = new Map<string, GameSession>();
let houseWallet: HouseWallet = {
  balance: 500000, // $500,000 house bankroll (increased for better coverage)
  totalPaidOut: 0,
  totalReceived: 0,
  reservedFunds: 0,
  lastUpdated: Date.now(),
};

/**
 * Initialize or get user wallet
 */
export function getUserWallet(userId: string): UserWallet {
  if (!userWallets.has(userId)) {
    // Create new wallet with starting balance
    const newWallet: UserWallet = {
      userId,
      balance: 1000, // $1000 starting balance
      totalWagered: 0,
      totalWon: 0,
      totalLost: 0,
      gamesPlayed: 0,
      lastUpdated: Date.now(),
    };
    userWallets.set(userId, newWallet);
  }
  return userWallets.get(userId)!;
}

/**
 * Update user wallet
 */
export function updateUserWallet(wallet: UserWallet): void {
  userWallets.set(wallet.userId, wallet);
}

/**
 * Get house wallet
 */
export function getHouseWallet(): HouseWallet {
  return { ...houseWallet };
}

/**
 * Update house wallet
 */
export function updateHouseWallet(updated: HouseWallet): void {
  houseWallet = updated;
}

/**
 * Add transaction record
 */
export function addTransaction(transaction: Transaction): void {
  transactions.push(transaction);
}

/**
 * Get user transaction history
 */
export function getUserTransactions(
  userId: string,
  limit: number = 10
): Transaction[] {
  return transactions
    .filter((t) => t.userId === userId)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

/**
 * Create or update game session
 */
export function setGameSession(session: GameSession): void {
  activeSessions.set(session.sessionId, session);
}

/**
 * Get active game session
 */
export function getGameSession(sessionId: string): GameSession | undefined {
  return activeSessions.get(sessionId);
}

/**
 * Delete game session (when game ends)
 */
export function deleteGameSession(sessionId: string): void {
  activeSessions.delete(sessionId);
}

/**
 * Get all active sessions for user
 */
export function getUserActiveSessions(userId: string): GameSession[] {
  return Array.from(activeSessions.values()).filter(
    (s) => s.userId === userId && s.status === "ACTIVE"
  );
}

/**
 * Reset wallet store (for testing)
 */
export function resetWalletStore(): void {
  userWallets.clear();
  transactions.length = 0;
  activeSessions.clear();
  houseWallet = {
    balance: 500000, // $500,000 house bankroll (matches initial value)
    totalPaidOut: 0,
    totalReceived: 0,
    reservedFunds: 0,
    lastUpdated: Date.now(),
  };
}

/**
 * Add balance to user wallet (for testing/admin)
 */
export function addUserBalance(userId: string, amount: number): UserWallet {
  const wallet = getUserWallet(userId);
  wallet.balance += amount;
  wallet.lastUpdated = Date.now();
  updateUserWallet(wallet);
  return wallet;
}

/**
 * Get wallet stats
 */
export function getWalletStats() {
  return {
    totalUsers: userWallets.size,
    totalUserBalance: Array.from(userWallets.values()).reduce(
      (sum, w) => sum + w.balance,
      0
    ),
    houseBalance: houseWallet.balance,
    houseReserved: houseWallet.reservedFunds,
    activeSessions: activeSessions.size,
    totalTransactions: transactions.length,
  };
}
