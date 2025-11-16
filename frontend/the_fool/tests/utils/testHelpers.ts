/**
 * Test Utilities Module
 * Reusable helper functions for testing the game engine
 */

import { expect } from "@playwright/test";
import type { UserWallet, HouseWallet, GameSession } from "@/lib/walletTypes";

/**
 * Create a mock user wallet with default values
 */
export function createMockUserWallet(
  overrides?: Partial<UserWallet>
): UserWallet {
  return {
    userId: "test-user-123",
    balance: 1000,
    totalWagered: 0,
    totalWon: 0,
    totalLost: 0,
    gamesPlayed: 0,
    lastUpdated: Date.now(),
    ...overrides,
  };
}

/**
 * Create a mock house wallet with default values
 */
export function createMockHouseWallet(
  overrides?: Partial<HouseWallet>
): HouseWallet {
  return {
    balance: 100000,
    reservedFunds: 0,
    totalPaidOut: 0,
    totalReceived: 0,
    lastUpdated: Date.now(),
    ...overrides,
  };
}

/**
 * Create a mock game session with default values
 */
export function createMockGameSession(
  overrides?: Partial<GameSession>
): GameSession {
  return {
    sessionId: "test-session-123",
    userId: "test-user-123",
    initialBet: 50,
    currentTreasure: 0,
    diveNumber: 1,
    isActive: true,
    status: "ACTIVE",
    reservedPayout: 1000,
    startTime: Date.now(),
    ...overrides,
  };
}

/**
 * Generate a random user ID for testing
 */
export function generateTestUserId(): string {
  return `test-user-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Generate a random session ID for testing
 */
export function generateTestSessionId(): string {
  return `test-session-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Assert that two numbers are approximately equal (for floating point comparisons)
 */
export function expectApproximately(
  actual: number,
  expected: number,
  tolerance: number = 0.01
) {
  const diff = Math.abs(actual - expected);
  expect(diff).toBeLessThanOrEqual(tolerance);
}

/**
 * Assert that a value is within a range
 */
export function expectInRange(
  value: number,
  min: number,
  max: number,
  inclusive: boolean = true
) {
  if (inclusive) {
    expect(value).toBeGreaterThanOrEqual(min);
    expect(value).toBeLessThanOrEqual(max);
  } else {
    expect(value).toBeGreaterThan(min);
    expect(value).toBeLessThan(max);
  }
}

/**
 * Simulate a complete game session
 */
export interface GameSimulationResult {
  userId: string;
  sessionId: string;
  initialBet: number;
  finalTreasure: number;
  diveCount: number;
  survived: boolean;
  profit: number;
}

/**
 * Wait for a specified amount of time (for async testing)
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run a function multiple times and collect results
 */
export async function runMultipleTimes<T>(
  fn: () => T | Promise<T>,
  count: number
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < count; i++) {
    results.push(await fn());
  }
  return results;
}

/**
 * Calculate statistics from an array of numbers
 */
export interface Statistics {
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  count: number;
}

export function calculateStatistics(values: number[]): Statistics {
  if (values.length === 0) {
    throw new Error("Cannot calculate statistics for empty array");
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / values.length;

  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(variance);

  const median =
    values.length % 2 === 0
      ? (sorted[values.length / 2 - 1] + sorted[values.length / 2]) / 2
      : sorted[Math.floor(values.length / 2)];

  return {
    mean,
    median,
    stdDev,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    count: values.length,
  };
}

/**
 * Assert probability distribution matches expected
 */
export function expectProbabilityDistribution(
  samples: boolean[],
  expectedProbability: number,
  tolerance: number = 0.05
) {
  const trueCount = samples.filter((x) => x).length;
  const actualProbability = trueCount / samples.length;
  expectApproximately(actualProbability, expectedProbability, tolerance);
}

/**
 * Create a deterministic random number generator for testing
 */
export class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  nextBoolean(): boolean {
    return this.next() < 0.5;
  }
}

/**
 * Validate wallet state consistency
 */
export function validateWalletConsistency(wallet: UserWallet | HouseWallet) {
  expect(wallet.balance).toBeGreaterThanOrEqual(0);
  expect(wallet.lastUpdated).toBeGreaterThan(0);

  if ("reservedFunds" in wallet) {
    // House wallet
    expect(wallet.reservedFunds).toBeGreaterThanOrEqual(0);
    expect(wallet.totalPaidOut).toBeGreaterThanOrEqual(0);
    expect(wallet.totalReceived).toBeGreaterThanOrEqual(0);
  } else {
    // User wallet
    expect(wallet.totalWagered).toBeGreaterThanOrEqual(0);
    expect(wallet.totalWon).toBeGreaterThanOrEqual(0);
    expect(wallet.totalLost).toBeGreaterThanOrEqual(0);
    expect(wallet.gamesPlayed).toBeGreaterThanOrEqual(0);
  }
}

/**
 * Validate game session consistency
 */
export function validateGameSessionConsistency(session: GameSession) {
  expect(session.sessionId).toBeTruthy();
  expect(session.userId).toBeTruthy();
  expect(session.initialBet).toBeGreaterThan(0);
  expect(session.currentTreasure).toBeGreaterThanOrEqual(0);
  expect(session.diveNumber).toBeGreaterThanOrEqual(1);
  expect(session.reservedPayout).toBeGreaterThan(0);
  expect(session.startTime).toBeGreaterThan(0);

  if (!session.isActive && session.endTime) {
    expect(session.endTime).toBeGreaterThan(session.startTime);
  }
}

/**
 * Assert money conservation (no money created or destroyed)
 */
export function assertMoneyConservation(
  before: {
    userBalance: number;
    houseBalance: number;
    houseReserved: number;
  },
  after: {
    userBalance: number;
    houseBalance: number;
    houseReserved: number;
  }
) {
  const totalBefore = before.userBalance + before.houseBalance;
  const totalAfter = after.userBalance + after.houseBalance;

  // Reserved funds are already counted in house balance, don't double-count
  expectApproximately(totalBefore, totalAfter, 0.01);
}

/**
 * Retry a test function multiple times if it fails
 */
export async function retryTest<T>(
  fn: () => T | Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 100
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await wait(delayMs);
      }
    }
  }

  throw lastError;
}

/**
 * Mock console methods for testing
 */
export function mockConsole() {
  const original = {
    log: console.log,
    error: console.error,
    warn: console.warn,
  };

  const logs: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log = (...args: unknown[]) => logs.push(args.join(" "));
  console.error = (...args: unknown[]) => errors.push(args.join(" "));
  console.warn = (...args: unknown[]) => warnings.push(args.join(" "));

  return {
    getLogs: () => logs,
    getErrors: () => errors,
    getWarnings: () => warnings,
    restore: () => {
      console.log = original.log;
      console.error = original.error;
      console.warn = original.warn;
    },
  };
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Format percentage for display
 */
export function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

/**
 * Clean up all test wallets and sessions
 */
export function cleanupTestData() {
  // In a real implementation, this would clear test data from stores
  // For now, it's a placeholder for future implementation
}
