/**
 * Chain Wallet Store (Zustand - READ-ONLY)
 *
 * This store provides READ-ONLY access to wallet balances.
 * It receives real-time updates via SSE (Server-Sent Events) with polling fallback.
 *
 * SECURITY: Client CANNOT modify balances - only server can update them.
 *
 * Architecture:
 * - Primary: SSE push updates from server (real-time)
 * - Fallback: Polling every 5s if SSE fails
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

  // Connection state
  isLoading: boolean;
  isSSEConnected: boolean; // SSE connection status
  lastUpdated: number | null;

  // Actions
  setUserId: (userId: string) => void;
  refreshBalance: () => Promise<void>; // Fetch from server (fallback)
  updateFromSSE: (data: {
    userBalance: number;
    houseVaultBalance: number;
    houseVaultReserved: number;
    timestamp: number;
  }) => void;
  setSSEConnected: (connected: boolean) => void;
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
      isSSEConnected: false,
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
          console.log("[WALLET STORE] WARNING: No userId set, skipping refresh");
          return;
        }

        set({ isLoading: true });

        try {
          console.log("[WALLET STORE] 🔄 Fetching balance from server...");

          // Server Action: Fetches from blockchain/localStorage
          const data = await getWalletInfo(userId);

          console.log("[WALLET STORE] OK: Balance refreshed:", {
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

          console.log("[WALLET STORE] Info: Setting new state:", newState);
          set(newState);
        } catch (error) {
          console.error("[WALLET STORE] ERROR: Failed to refresh balance:", error);
          set({ isLoading: false });
        }
      },

      // Update from SSE push notification
      updateFromSSE: (data) => {
        console.log("[WALLET STORE] 📨 SSE update received:", data);
        set({
          userBalance: data.userBalance,
          houseVaultBalance: data.houseVaultBalance,
          houseVaultReserved: data.houseVaultReserved,
          lastUpdated: data.timestamp,
          isLoading: false,
        });
      },

      // Update SSE connection status
      setSSEConnected: (connected) => {
        console.log("[WALLET STORE] 🔌 SSE connection status:", connected);
        set({ isSSEConnected: connected });
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

// Auto-refresh balance every 5 seconds as FALLBACK if SSE is not connected
// SSE is the primary method for updates
if (typeof window !== "undefined") {
  const refreshInterval = setInterval(() => {
    const store = useChainWalletStore.getState();
    // Only poll if SSE is NOT connected (fallback mode)
    if (store.userId && !store.isLoading && !store.isSSEConnected) {
      console.log("[WALLET STORE] 🔄 Polling fallback (SSE disconnected)");
      store.refreshBalance();
    }
  }, 5000);

  // Store interval ID for potential cleanup (though Next.js modules typically don't unmount)
  (window as any).__walletRefreshInterval = refreshInterval;

  console.log(
    "[WALLET STORE] ⏰ Auto-refresh fallback polling started (5s, only when SSE down)"
  );
}
