"use server";

/**
 * Wallet Actions - Read-only server actions for querying wallet balances
 *
 * These actions provide secure, read-only access to wallet balances.
 * Balances can ONLY be modified through game actions (startGame, performDive, surfaceWithTreasure).
 *
 * Architecture:
 * - Client: Zustand store polls these actions every 2s
 * - Server: Uses in-memory wallet store (legacy) for now
 * - Future: Will use chain state when LocalGameChain persistence is fixed
 *
 * NOTE: We use the existing gameEngine.getWalletInfo instead of querying
 * LocalGameChain directly because server-side can't access browser localStorage.
 */

import { getWalletInfo as getEngineWalletInfo } from "./gameEngine";

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
