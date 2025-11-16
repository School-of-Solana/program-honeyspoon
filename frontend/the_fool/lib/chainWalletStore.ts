/**
 * Chain Wallet Store (Zustand + localStorage)
 *
 * Single source of truth for all wallet state.
 * Syncs with localStorage automatically.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WalletInfo {
  address: string;
  balance: number; // in SOL
  lamports: string;
}

interface ChainWalletState {
  // Current user
  userId: string | null;
  userBalance: number; // in SOL

  // House vault
  houseVaultBalance: number; // in SOL
  houseVaultReserved: number; // in SOL

  // All wallets (for debug panel)
  wallets: WalletInfo[];

  // Actions
  setUserId: (userId: string) => void;
  loadWalletsFromLocalStorage: () => void;
  initHouseVault: () => void;
  topUpHouseVault: (amount: number) => void;
  createUserWallet: () => string;
  topUpUserWallet: (address: string, amount: number) => void;
  clearAll: () => void;
}

const STORAGE_KEYS = {
  WALLETS: "local_chain_wallets",
  VAULTS: "local_chain_vaults",
  SESSIONS: "local_chain_sessions",
  COUNTER: "local_chain_session_counter",
};

const LAMPORTS_PER_SOL = BigInt(1_000_000_000);

export const useChainWalletStore = create<ChainWalletState>()(
  persist(
    (set, get) => ({
      // Initial state
      userId: null,
      userBalance: 0,
      houseVaultBalance: 0,
      houseVaultReserved: 0,
      wallets: [],

      // Set current user ID
      setUserId: (userId: string) => {
        console.log(
          "[WALLET STORE] 👤 Setting userId:",
          userId.substring(0, 30) + "..."
        );
        set({ userId });
        // Load user balance
        get().loadWalletsFromLocalStorage();
      },

      // Load wallets from localStorage
      loadWalletsFromLocalStorage: () => {
        if (typeof window === "undefined") return;

        try {
          console.log("[WALLET STORE] 🔄 Loading wallets from localStorage...");

          const walletsStr = localStorage.getItem(STORAGE_KEYS.WALLETS);
          const vaultsStr = localStorage.getItem(STORAGE_KEYS.VAULTS);

          if (!walletsStr) {
            console.log("[WALLET STORE] ⚠️ No wallets found");
            set({ wallets: [], userBalance: 0, houseVaultBalance: 0 });
            return;
          }

          const walletsData = JSON.parse(walletsStr);
          const walletList: WalletInfo[] = Object.entries(walletsData).map(
            ([address, lamports]) => ({
              address,
              balance: Number(BigInt(lamports as string) / LAMPORTS_PER_SOL),
              lamports: lamports as string,
            })
          );

          // Sort: house vault first, then users
          walletList.sort((a, b) => {
            if (a.address.includes("HOUSE_VAULT")) return -1;
            if (b.address.includes("HOUSE_VAULT")) return 1;
            return a.address.localeCompare(b.address);
          });

          // Get house vault balance
          const vaultAddress = "HOUSE_VAULT_house_authority_main";
          const houseVaultBalance = walletsData[vaultAddress]
            ? Number(BigInt(walletsData[vaultAddress]) / LAMPORTS_PER_SOL)
            : 0;

          // Get house vault reserved funds
          let houseVaultReserved = 0;
          if (vaultsStr) {
            try {
              const vaultsData = JSON.parse(vaultsStr);
              const vaultState = vaultsData[vaultAddress];
              if (vaultState?.totalReserved) {
                houseVaultReserved = Number(
                  BigInt(vaultState.totalReserved) / LAMPORTS_PER_SOL
                );
              }
            } catch (e) {
              console.warn("[WALLET STORE] Failed to parse vault state");
            }
          }

          // Get current user balance
          const currentUserId = get().userId;
          const userBalance =
            currentUserId && walletsData[currentUserId]
              ? Number(BigInt(walletsData[currentUserId]) / LAMPORTS_PER_SOL)
              : 0;

          console.log("[WALLET STORE] ✅ Loaded:", {
            wallets: walletList.length,
            houseVaultBalance,
            houseVaultReserved,
            userBalance,
          });

          set({
            wallets: walletList,
            houseVaultBalance,
            houseVaultReserved,
            userBalance,
          });
        } catch (error) {
          console.error("[WALLET STORE] ❌ Failed to load wallets:", error);
          set({ wallets: [], userBalance: 0, houseVaultBalance: 0 });
        }
      },

      // Initialize house vault
      initHouseVault: () => {
        if (typeof window === "undefined") return;

        console.log("[WALLET STORE] 🏦 Initializing house vault...");

        const wallets = JSON.parse(
          localStorage.getItem(STORAGE_KEYS.WALLETS) || "{}"
        );
        const vaultAddress = "HOUSE_VAULT_house_authority_main";
        const initialBalance = (BigInt(500_000) * LAMPORTS_PER_SOL).toString();

        wallets[vaultAddress] = initialBalance;
        localStorage.setItem(STORAGE_KEYS.WALLETS, JSON.stringify(wallets));

        // Also create vault state
        const vaults = JSON.parse(
          localStorage.getItem(STORAGE_KEYS.VAULTS) || "{}"
        );
        vaults[vaultAddress] = {
          vaultPda: vaultAddress,
          houseAuthority: "house_authority_main",
          locked: false,
          totalReserved: "0",
          bump: 255,
        };
        localStorage.setItem(STORAGE_KEYS.VAULTS, JSON.stringify(vaults));

        console.log("[WALLET STORE] ✅ House vault created: 500,000 SOL");
        get().loadWalletsFromLocalStorage();
      },

      // Top up house vault
      topUpHouseVault: (amountSOL: number) => {
        if (typeof window === "undefined") return;

        console.log(
          "[WALLET STORE] 💰 Topping up house vault:",
          amountSOL,
          "SOL"
        );

        const wallets = JSON.parse(
          localStorage.getItem(STORAGE_KEYS.WALLETS) || "{}"
        );
        const vaultAddress = "HOUSE_VAULT_house_authority_main";

        if (!wallets[vaultAddress]) {
          console.error("[WALLET STORE] ❌ House vault does not exist!");
          return;
        }

        const currentBalance = BigInt(wallets[vaultAddress]);
        const topUpAmount = BigInt(amountSOL) * LAMPORTS_PER_SOL;
        const newBalance = currentBalance + topUpAmount;

        wallets[vaultAddress] = newBalance.toString();
        localStorage.setItem(STORAGE_KEYS.WALLETS, JSON.stringify(wallets));

        console.log("[WALLET STORE] ✅ House vault topped up");
        get().loadWalletsFromLocalStorage();
      },

      // Create user wallet
      createUserWallet: () => {
        if (typeof window === "undefined") return "";

        const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        console.log(
          "[WALLET STORE] 👤 Creating user wallet:",
          userId.substring(0, 30) + "..."
        );

        const wallets = JSON.parse(
          localStorage.getItem(STORAGE_KEYS.WALLETS) || "{}"
        );
        const initialBalance = (BigInt(1_000) * LAMPORTS_PER_SOL).toString();

        wallets[userId] = initialBalance;
        localStorage.setItem(STORAGE_KEYS.WALLETS, JSON.stringify(wallets));

        console.log("[WALLET STORE] ✅ User wallet created: 1,000 SOL");

        // Set as current user
        set({ userId });
        get().loadWalletsFromLocalStorage();

        return userId;
      },

      // Top up user wallet
      topUpUserWallet: (address: string, amountSOL: number) => {
        if (typeof window === "undefined") return;

        console.log(
          "[WALLET STORE] 💵 Topping up user wallet:",
          address.substring(0, 20) + "...",
          amountSOL,
          "SOL"
        );

        const wallets = JSON.parse(
          localStorage.getItem(STORAGE_KEYS.WALLETS) || "{}"
        );

        if (!wallets[address]) {
          console.error("[WALLET STORE] ❌ Wallet does not exist!");
          return;
        }

        const currentBalance = BigInt(wallets[address]);
        const topUpAmount = BigInt(amountSOL) * LAMPORTS_PER_SOL;
        const newBalance = currentBalance + topUpAmount;

        wallets[address] = newBalance.toString();
        localStorage.setItem(STORAGE_KEYS.WALLETS, JSON.stringify(wallets));

        console.log("[WALLET STORE] ✅ User wallet topped up");
        get().loadWalletsFromLocalStorage();
      },

      // Clear all
      clearAll: () => {
        if (typeof window === "undefined") return;

        console.log("[WALLET STORE] 🗑️ Clearing all wallets...");

        localStorage.removeItem(STORAGE_KEYS.WALLETS);
        localStorage.removeItem(STORAGE_KEYS.VAULTS);
        localStorage.removeItem(STORAGE_KEYS.SESSIONS);
        localStorage.removeItem(STORAGE_KEYS.COUNTER);

        set({
          userId: null,
          userBalance: 0,
          houseVaultBalance: 0,
          houseVaultReserved: 0,
          wallets: [],
        });

        console.log("[WALLET STORE] ✅ All cleared");
      },
    }),
    {
      name: "chain-wallet-store",
      partialize: (state) => ({
        userId: state.userId,
      }),
    }
  )
);

// Auto-sync every 2 seconds
if (typeof window !== "undefined") {
  setInterval(() => {
    useChainWalletStore.getState().loadWalletsFromLocalStorage();
  }, 2000);
}
