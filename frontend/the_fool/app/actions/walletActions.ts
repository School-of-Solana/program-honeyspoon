"use server";

/**
 * Wallet Actions - Read-only server actions for querying wallet balances
 *
 * These actions provide secure, read-only access to wallet balances.
 * Balances can ONLY be modified through game actions (startGame, performDive, surfaceWithTreasure).
 *
 * Architecture:
 * - Client: Zustand store polls these actions every 5s
 * - Server: Uses serverSideCache (for LocalGameChain) or blockchain (for SolanaGameChain)
 *
 * DEBUG ACTIONS: For development only, protected by NODE_ENV check
 */

import { getWalletInfo as getEngineWalletInfo } from "./gameEngine";
import { getGameChain } from "@/lib/ports";
import { solToLamports, lamportsToSol } from "@/lib/utils/lamports";

/**
 * Get comprehensive wallet info for a user
 * Wraps gameEngine's getWalletInfo for client consumption
 *
 * @param userId - User wallet address
 * @returns Complete wallet information
 */
export async function getWalletInfo(userId: string): Promise<{
  userBalance: number;
  houseBalance: number;
  houseReserved: number;
  houseAvailable: number;
}> {
  try {
    // Use existing gameEngine wallet info (in-memory for now)
    const walletInfo = await getEngineWalletInfo(userId);

    return {
      userBalance: walletInfo.balance,
      houseBalance: walletInfo.houseBalance,
      houseReserved: walletInfo.houseReserved,
      houseAvailable: walletInfo.houseBalance - walletInfo.houseReserved,
    };
  } catch (error) {
    console.error("[WALLET ACTIONS] Failed to get wallet info:", error);
    // Return safe defaults
    return {
      userBalance: 0,
      houseBalance: 0,
      houseReserved: 0,
      houseAvailable: 0,
    };
  }
}

/**
 * DEBUG ONLY: Top up user wallet
 *
 * This action is ONLY available in development mode (NODE_ENV !== 'production').
 * It allows adding funds to a user wallet for testing purposes.
 *
 * @param userId - User wallet address
 * @param amount - Amount in SOL (will be converted to lamports)
 * @returns New balance in SOL, or error
 */
export async function debugTopUpUserWallet(
  userId: string,
  amount: number
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  // Security check: only allow in development
  if (process.env.NODE_ENV === "production") {
    console.error("[WALLET ACTIONS] ❌ Debug action called in production!");
    return {
      success: false,
      error: "Debug actions are not available in production",
    };
  }

  try {
    console.log(
      `[WALLET ACTIONS] 🔧 DEBUG: Topping up user ${userId.substring(0, 12)}... with ${amount} SOL`
    );

    // Get chain instance
    const chain = getGameChain();

    // Check if chain has topUpUserBalance method (LocalGameChain does)
    if ("topUpUserBalance" in chain) {
      const amountLamports = solToLamports(amount);
      const newBalanceLamports = await (chain as any).topUpUserBalance(
        userId,
        amountLamports
      );
      const newBalance = lamportsToSol(newBalanceLamports);

      console.log(
        `[WALLET ACTIONS] ✅ DEBUG: User wallet topped up. New balance: ${newBalance} SOL`
      );

      return {
        success: true,
        newBalance,
      };
    } else {
      return {
        success: false,
        error: "Chain implementation does not support debug top-up",
      };
    }
  } catch (error) {
    console.error("[WALLET ACTIONS] ❌ Failed to top up wallet:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * DEBUG ONLY: Top up house vault
 *
 * This action is ONLY available in development mode (NODE_ENV !== 'production').
 * It allows adding funds to the house vault for testing purposes.
 *
 * @param vaultPda - House vault PDA
 * @param amount - Amount in SOL (will be converted to lamports)
 * @returns New balance in SOL, or error
 */
export async function debugTopUpHouseVault(
  vaultPda: string,
  amount: number
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  // Security check: only allow in development
  if (process.env.NODE_ENV === "production") {
    console.error("[WALLET ACTIONS] ❌ Debug action called in production!");
    return {
      success: false,
      error: "Debug actions are not available in production",
    };
  }

  try {
    console.log(
      `[WALLET ACTIONS] 🔧 DEBUG: Topping up house vault ${vaultPda.substring(0, 12)}... with ${amount} SOL`
    );

    // Get chain instance
    const chain = getGameChain();

    // Check if chain has topUpVaultBalance method (LocalGameChain does)
    if ("topUpVaultBalance" in chain) {
      const amountLamports = solToLamports(amount);
      const newBalanceLamports = await (chain as any).topUpVaultBalance(
        vaultPda,
        amountLamports
      );
      const newBalance = lamportsToSol(newBalanceLamports);

      console.log(
        `[WALLET ACTIONS] ✅ DEBUG: House vault topped up. New balance: ${newBalance} SOL`
      );

      return {
        success: true,
        newBalance,
      };
    } else {
      return {
        success: false,
        error: "Chain implementation does not support debug top-up",
      };
    }
  } catch (error) {
    console.error("[WALLET ACTIONS] ❌ Failed to top up vault:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
