"use client";

import { useEffect } from "react";
import { useGameChain } from "./useGameChain";
import { useChainWalletStore } from "../chainWalletStore";

/**
 * Hook that manages userId based on mode (LocalGameChain vs SolanaGameChain)
 *
 * - In LocalGameChain mode: Uses generated userId (user_xxxxx)
 * - In SolanaGameChain mode: Uses connected wallet public key
 *
 * This ensures the app works seamlessly in both modes.
 */
export function useWalletOrUserId() {
  const { publicKey, connected } = useGameChain();
  const userId = useChainWalletStore((state) => state.userId);
  const setUserId = useChainWalletStore((state) => state.setUserId);

  // Check if using Solana mode
  const useSolana = process.env.NEXT_PUBLIC_USE_SOLANA === "true";

  useEffect(() => {
    if (useSolana) {
      // Solana mode: use wallet public key
      if (connected && publicKey) {
        const walletAddress = publicKey.toBase58();
        if (userId !== walletAddress) {
          console.log(
            "[useWalletOrUserId] Switching to wallet address:",
            walletAddress
          );
          setUserId(walletAddress);
        }
      } else if (!connected && userId) {
        // Wallet disconnected but we have a userId - this is likely a LocalGameChain userId
        // Don't clear it, as we might be in transition
        console.log(
          "[useWalletOrUserId] Wallet not connected, keeping existing userId"
        );
      }
    }
    // In LocalGameChain mode, don't override the generated userId
  }, [useSolana, connected, publicKey, userId, setUserId]);

  return {
    userId: userId || "",
    isWalletMode: useSolana,
    walletConnected: connected,
    publicKey,
  };
}
