/**
 * Chain Wallet Store (Zustand - READ-ONLY)
 *
 * This store provides READ-ONLY access to wallet balances.
 * It fetches data from server actions (which query blockchain/localStorage).
 *
 * SECURITY: Client CANNOT modify balances - only server can update them.
 *
 * Architecture:
 * - Client: Zustand store polls server every 2s
 * - Server: gameEngine.ts modifies balances through blockchain operations
 * - Source of truth: LocalGameChain (dev) or SolanaGameChain (prod)
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getWalletInfo } from "@/app/actions/walletActions";

interface ChainWalletState {
  // Current user
  userId: string | null;

  // Balances (READ-ONLY - fetched from server)
  userBalance: number; // in SOL
  houseVaultBalance: number; // in SOL
  houseVaultReserved: number; // in SOL

  // Loading state
  isLoading: boolean;
  lastUpdated: number | null;

  // Actions
  setUserId: (userId: string) => void;
  refreshBalance: () => Promise<void>; // Fetch from server
}

export const useChainWalletStore = create<ChainWalletState>()(
  persist(
    (set, get) => ({
      // Initial state
      userId: null,
      userBalance: 0,
      houseVaultBalance: 0,
      houseVaultReserved: 0,
      isLoading: false,
      lastUpdated: null,

      // Set current user ID
      setUserId: (userId: string) => {
        console.log(
          "[WALLET STORE] 👤 Setting userId:",
          userId.substring(0, 30) + "...",
          "Current balance:",
          get().userBalance
        );
        set({ userId });
        // Trigger initial balance fetch
        get().refreshBalance();
      },

      // Refresh balance from server (READ-ONLY)
      refreshBalance: async () => {
        const { userId } = get();

        if (!userId) {
          console.log("[WALLET STORE] ⚠️ No userId set, skipping refresh");
          return;
        }

        set({ isLoading: true });

        try {
          console.log("[WALLET STORE] 🔄 Fetching balance from server...");

          // Server Action: Fetches from blockchain/localStorage
          const data = await getWalletInfo(userId);

          console.log("[WALLET STORE] ✅ Balance refreshed:", {
            userBalance: data.userBalance,
            houseBalance: data.houseBalance,
            houseReserved: data.houseReserved,
          });

          const newState = {
            userBalance: data.userBalance,
            houseVaultBalance: data.houseBalance,
            houseVaultReserved: data.houseReserved,
            isLoading: false,
            lastUpdated: Date.now(),
          };

          console.log("[WALLET STORE] 📊 Setting new state:", newState);
          set(newState);
        } catch (error) {
          console.error("[WALLET STORE] ❌ Failed to refresh balance:", error);
          set({ isLoading: false });
        }
      },
    }),
    {
      name: "chain-wallet-store",
      // Only persist userId - balances come from server
      partialize: (state) => ({
        userId: state.userId,
      }),
    }
  )
);

// Auto-refresh balance every 5 seconds (reduced from 2s to minimize server load)
// Note: This runs once on module load and persists for the lifetime of the app
// In a typical Next.js app, this is fine as the module stays loaded
if (typeof window !== "undefined") {
  const refreshInterval = setInterval(() => {
    const store = useChainWalletStore.getState();
    if (store.userId && !store.isLoading) {
      store.refreshBalance();
    }
  }, 5000);

  // Store interval ID for potential cleanup (though Next.js modules typically don't unmount)
  (window as any).__walletRefreshInterval = refreshInterval;

  console.log("[WALLET STORE] ⏰ Auto-refresh interval started (5s)");
}
