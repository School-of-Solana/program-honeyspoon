/**
 * Unit tests for Chain Wallet Store
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

// Import store after mocking
import { useChainWalletStore } from "@/lib/chainWalletStore";

describe("Chain Wallet Store", () => {
  beforeEach(() => {
    // Clear store and localStorage before each test
    useChainWalletStore.getState().clearAll();
    localStorageMock.clear();
  });

  describe("Initialization", () => {
    it("should initialize with null userId and zero balances", () => {
      const state = useChainWalletStore.getState();
      assert.strictEqual(state.userId, null);
      assert.strictEqual(state.userBalance, 0);
      assert.strictEqual(state.houseVaultBalance, 0);
      assert.strictEqual(state.houseVaultReserved, 0);
      assert.deepStrictEqual(state.wallets, []);
    });
  });

  describe("House Vault Management", () => {
    it("should initialize house vault with 500k SOL", () => {
      const state = useChainWalletStore.getState();
      state.initHouseVault();

      const wallets = JSON.parse(
        localStorage.getItem("local_chain_wallets") || "{}"
      );
      const vaultAddress = "HOUSE_VAULT_house_authority_main";

      assert.strictEqual(
        wallets[vaultAddress],
        (BigInt(500_000) * BigInt(1_000_000_000)).toString()
      );
    });

    it("should top up house vault correctly", () => {
      const state = useChainWalletStore.getState();
      state.initHouseVault();
      state.topUpHouseVault(100_000); // Add 100k SOL

      const wallets = JSON.parse(
        localStorage.getItem("local_chain_wallets") || "{}"
      );
      const vaultAddress = "HOUSE_VAULT_house_authority_main";

      assert.strictEqual(
        wallets[vaultAddress],
        (BigInt(600_000) * BigInt(1_000_000_000)).toString()
      );
    });
  });

  describe("User Wallet Management", () => {
    it("should create user wallet with 1k SOL", () => {
      const state = useChainWalletStore.getState();
      const userId = state.createUserWallet();

      assert.ok(userId.match(/^user_\d+_[a-z0-9]+$/));

      const wallets = JSON.parse(
        localStorage.getItem("local_chain_wallets") || "{}"
      );

      assert.strictEqual(
        wallets[userId],
        (BigInt(1_000) * BigInt(1_000_000_000)).toString()
      );
    });

    it("should set userId when creating user wallet", () => {
      const userId = useChainWalletStore.getState().createUserWallet();
      // Get fresh state after creation
      const state = useChainWalletStore.getState();

      assert.strictEqual(state.userId, userId);
    });

    it("should top up user wallet correctly", () => {
      const state = useChainWalletStore.getState();
      const userId = state.createUserWallet();
      state.topUpUserWallet(userId, 500); // Add 500 SOL

      const wallets = JSON.parse(
        localStorage.getItem("local_chain_wallets") || "{}"
      );

      assert.strictEqual(
        wallets[userId],
        (BigInt(1_500) * BigInt(1_000_000_000)).toString()
      );
    });
  });

  describe("Loading from localStorage", () => {
    it("should load wallets from localStorage", () => {
      // Create some wallets manually in localStorage
      const wallets = {
        HOUSE_VAULT_house_authority_main: (
          BigInt(500_000) * BigInt(1_000_000_000)
        ).toString(),
        user_test_123: (BigInt(1_000) * BigInt(1_000_000_000)).toString(),
      };
      localStorage.setItem("local_chain_wallets", JSON.stringify(wallets));

      // Set userId and load
      useChainWalletStore.getState().setUserId("user_test_123");

      // Get fresh state after setting userId
      const state = useChainWalletStore.getState();

      assert.strictEqual(state.userBalance, 1_000);
      assert.strictEqual(state.houseVaultBalance, 500_000);
      assert.strictEqual(state.wallets.length, 2);
    });

    it("should handle missing localStorage gracefully", () => {
      const state = useChainWalletStore.getState();
      state.loadWalletsFromLocalStorage();

      assert.deepStrictEqual(state.wallets, []);
      assert.strictEqual(state.userBalance, 0);
      assert.strictEqual(state.houseVaultBalance, 0);
    });

    it("should handle corrupted localStorage gracefully", () => {
      localStorage.setItem("local_chain_wallets", "not valid json");

      const state = useChainWalletStore.getState();
      state.loadWalletsFromLocalStorage();

      assert.deepStrictEqual(state.wallets, []);
      assert.strictEqual(state.userBalance, 0);
      assert.strictEqual(state.houseVaultBalance, 0);
    });

    it("should load reserved funds from vault state", () => {
      // Create wallet and vault state
      const vaultAddress = "HOUSE_VAULT_house_authority_main";
      const wallets = {
        [vaultAddress]: (BigInt(500_000) * BigInt(1_000_000_000)).toString(),
      };
      const vaults = {
        [vaultAddress]: {
          vaultPda: vaultAddress,
          houseAuthority: "house_authority_main",
          locked: false,
          totalReserved: (BigInt(50_000) * BigInt(1_000_000_000)).toString(),
          bump: 255,
        },
      };

      localStorage.setItem("local_chain_wallets", JSON.stringify(wallets));
      localStorage.setItem("local_chain_vaults", JSON.stringify(vaults));

      useChainWalletStore.getState().loadWalletsFromLocalStorage();

      // Get fresh state after loading
      const state = useChainWalletStore.getState();

      assert.strictEqual(state.houseVaultReserved, 50_000);
    });
  });

  describe("Clear All", () => {
    it("should clear all wallets and reset state", () => {
      // Create some data
      useChainWalletStore.getState().initHouseVault();
      const userId = useChainWalletStore.getState().createUserWallet();

      // Verify data exists (get fresh state)
      let state = useChainWalletStore.getState();
      assert.notStrictEqual(localStorage.getItem("local_chain_wallets"), null);
      assert.strictEqual(state.userId, userId);

      // Clear all
      useChainWalletStore.getState().clearAll();

      // Verify everything is cleared (get fresh state)
      state = useChainWalletStore.getState();
      assert.strictEqual(localStorage.getItem("local_chain_wallets"), null);
      assert.strictEqual(state.userId, null);
      assert.strictEqual(state.userBalance, 0);
      assert.strictEqual(state.houseVaultBalance, 0);
      assert.deepStrictEqual(state.wallets, []);
    });
  });

  describe("Wallet Sorting", () => {
    it("should sort wallets with house vault first", () => {
      // Create wallets in reverse order
      const wallets = {
        user_test_2: (BigInt(1_000) * BigInt(1_000_000_000)).toString(),
        user_test_1: (BigInt(1_000) * BigInt(1_000_000_000)).toString(),
        HOUSE_VAULT_house_authority_main: (
          BigInt(500_000) * BigInt(1_000_000_000)
        ).toString(),
      };
      localStorage.setItem("local_chain_wallets", JSON.stringify(wallets));

      useChainWalletStore.getState().loadWalletsFromLocalStorage();

      // Get fresh state after loading
      const state = useChainWalletStore.getState();

      // House vault should be first
      assert.ok(state.wallets.length >= 1, "Should have at least 1 wallet");
      assert.ok(state.wallets[0].address.includes("HOUSE_VAULT"));
      // User wallets should be sorted alphabetically
      assert.strictEqual(state.wallets[1].address, "user_test_1");
      assert.strictEqual(state.wallets[2].address, "user_test_2");
    });
  });
});
