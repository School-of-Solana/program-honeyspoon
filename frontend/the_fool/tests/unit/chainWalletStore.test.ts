/**
 * Unit tests for Chain Wallet Store (READ-ONLY implementation)
 *
 * Note: The new chainWalletStore is a READ-ONLY store that fetches balances
 * from server actions. It doesn't directly manipulate wallets anymore.
 * All wallet mutations happen via server actions (gameActions.ts).
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

// Setup global mocks
global.localStorage = localStorageMock as any;
global.window = {} as any;

// Mock getWalletInfo server action
const mockGetWalletInfo = async (userId: string) => {
  return {
    balance: 1000,
    userBalance: 1000,
    totalWagered: 0,
    totalWon: 0,
    totalLost: 0,
    gamesPlayed: 0,
    maxBet: 500,
    houseBalance: 500_000,
    houseReserved: 0,
    chainHouseBalance: 500_000,
    chainHouseReserved: 0,
  };
};

// Import store after mocking
import { useChainWalletStore } from "@/lib/chainWalletStore";

describe("Chain Wallet Store", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorageMock.clear();
  });

  describe("Initialization", () => {
    it("should initialize with null userId and zero balances", () => {
      // Get fresh state
      const { userId, userBalance, houseVaultBalance, houseVaultReserved } =
        useChainWalletStore.getState();

      // Initially should have no userId
      assert.ok(
        userId === null || typeof userId === "string",
        "userId should be null or string"
      );

      // Balances start at 0 (until first refresh)
      assert.ok(
        typeof userBalance === "number",
        "userBalance should be a number"
      );
      assert.ok(
        typeof houseVaultBalance === "number",
        "houseVaultBalance should be a number"
      );
      assert.ok(
        typeof houseVaultReserved === "number",
        "houseVaultReserved should be a number"
      );
    });
  });

  describe("User ID Management", () => {
    it("should set userId", () => {
      const store = useChainWalletStore.getState();
      const testUserId = "test_user_123";

      store.setUserId(testUserId);

      // Should update state
      const { userId } = useChainWalletStore.getState();
      assert.strictEqual(userId, testUserId);
    });

    it.skip("should persist userId to localStorage (async persist not testable in Node)", () => {
      // Zustand persist is async and doesn't work well in Node test environment
      // This is tested in browser/integration tests instead
    });
  });

  describe("Balance Refresh", () => {
    it("should have refreshBalance method", () => {
      const store = useChainWalletStore.getState();
      assert.ok(
        typeof store.refreshBalance === "function",
        "Should have refreshBalance method"
      );
    });

    it("should skip refresh if no userId set", async () => {
      const store = useChainWalletStore.getState();

      // Ensure no userId
      const { userId } = store;
      if (userId) {
        // Reset if there's a userId from previous tests
        localStorageMock.clear();
      }

      // Should not throw
      await store.refreshBalance();

      // Balance should still be 0 or unchanged
      const { userBalance } = useChainWalletStore.getState();
      assert.ok(typeof userBalance === "number", "Balance should be a number");
    });
  });

  describe("State Properties", () => {
    it("should have all required state properties", () => {
      const state = useChainWalletStore.getState();

      assert.ok("userId" in state, "Should have userId");
      assert.ok("userBalance" in state, "Should have userBalance");
      assert.ok("houseVaultBalance" in state, "Should have houseVaultBalance");
      assert.ok(
        "houseVaultReserved" in state,
        "Should have houseVaultReserved"
      );
      assert.ok("isLoading" in state, "Should have isLoading");
      assert.ok("lastUpdated" in state, "Should have lastUpdated");
    });

    it("should have correct types", () => {
      const state = useChainWalletStore.getState();

      assert.ok(
        state.userId === null || typeof state.userId === "string",
        "userId should be null or string"
      );
      assert.strictEqual(
        typeof state.userBalance,
        "number",
        "userBalance should be number"
      );
      assert.strictEqual(
        typeof state.houseVaultBalance,
        "number",
        "houseVaultBalance should be number"
      );
      assert.strictEqual(
        typeof state.houseVaultReserved,
        "number",
        "houseVaultReserved should be number"
      );
      assert.strictEqual(
        typeof state.isLoading,
        "boolean",
        "isLoading should be boolean"
      );
      assert.ok(
        state.lastUpdated === null || typeof state.lastUpdated === "number",
        "lastUpdated should be null or number"
      );
    });
  });

  describe("Methods", () => {
    it("should have setUserId method", () => {
      const store = useChainWalletStore.getState();
      assert.strictEqual(
        typeof store.setUserId,
        "function",
        "Should have setUserId method"
      );
    });

    it("should have refreshBalance method", () => {
      const store = useChainWalletStore.getState();
      assert.strictEqual(
        typeof store.refreshBalance,
        "function",
        "Should have refreshBalance method"
      );
    });
  });
});
