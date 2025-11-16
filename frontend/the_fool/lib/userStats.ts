/**
 * User Statistics Tracking (Separate from Wallet Balance)
 *
 * This tracks game statistics (wins, losses, wagered) WITHOUT managing balances.
 * Actual wallet balances are managed by LocalGameChain/SolanaGameChain.
 *
 * This separation allows:
 * - Blockchain to be source of truth for money
 * - In-memory tracking of game statistics
 */

interface UserStats {
  userId: string;
  totalWagered: number;
  totalWon: number;
  totalLost: number;
  gamesPlayed: number;
  lastUpdated: number;
}

// In-memory statistics storage (NOT wallet balances!)
const userStats = new Map<string, UserStats>();

/**
 * Get or initialize user statistics
 */
export function getUserStats(userId: string): UserStats {
  if (!userStats.has(userId)) {
    const newStats: UserStats = {
      userId,
      totalWagered: 0,
      totalWon: 0,
      totalLost: 0,
      gamesPlayed: 0,
      lastUpdated: Date.now(),
    };
    userStats.set(userId, newStats);
  }
  return userStats.get(userId)!;
}

/**
 * Record a bet placed
 */
export function recordBet(userId: string, amount: number): void {
  const stats = getUserStats(userId);
  stats.totalWagered += amount;
  stats.gamesPlayed += 1;
  stats.lastUpdated = Date.now();
}

/**
 * Record a win
 */
export function recordWin(userId: string, amount: number): void {
  const stats = getUserStats(userId);
  stats.totalWon += amount;
  stats.lastUpdated = Date.now();
}

/**
 * Record a loss
 */
export function recordLoss(userId: string, amount: number): void {
  const stats = getUserStats(userId);
  stats.totalLost += amount;
  stats.lastUpdated = Date.now();
}

/**
 * Clear all statistics (for testing)
 */
export function clearAllStats(): void {
  userStats.clear();
}
