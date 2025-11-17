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
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { detectSolanaNetwork, canAirdrop, SolanaNetwork } from "@/lib/utils/networkDetection";

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

/**
 * Airdrop SOL to a wallet (Localhost/Devnet only)
 * 
 * This action requests an airdrop from the Solana faucet.
 * Only works on localhost and devnet networks.
 * 
 * @param walletAddress - Wallet public key to airdrop to
 * @param amount - Amount in SOL (default: 2 SOL)
 * @returns Success status, signature, and new balance
 */
export async function airdropSol(
  walletAddress: string,
  amount: number = 2
): Promise<{ 
  success: boolean; 
  signature?: string; 
  newBalance?: number;
  error?: string;
  network?: string;
}> {
  try {
    // Detect network
    const network = detectSolanaNetwork();
    const networkName = network === SolanaNetwork.LOCALHOST ? 'Localhost' : 
                       network === SolanaNetwork.DEVNET ? 'Devnet' : 
                       network === SolanaNetwork.TESTNET ? 'Testnet' : 
                       network === SolanaNetwork.MAINNET ? 'Mainnet' : 'Unknown';
    
    console.log(`[WALLET ACTIONS] 💧 Airdrop request on ${networkName}`, {
      walletAddress: walletAddress.substring(0, 12) + '...',
      amount,
      network,
    });

    // Security check: only allow airdrops on localhost and devnet
    if (!canAirdrop(network)) {
      return {
        success: false,
        error: `Airdrops are not available on ${networkName}. Only Localhost and Devnet support airdrops.`,
        network: networkName,
      };
    }

    // Get RPC connection
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:8899';
    const connection = new Connection(rpcUrl, 'confirmed');

    // Validate wallet address
    let publicKey: PublicKey;
    try {
      publicKey = new PublicKey(walletAddress);
    } catch (err) {
      return {
        success: false,
        error: 'Invalid wallet address',
        network: networkName,
      };
    }

    // Validate amount (max 5 SOL per airdrop for safety)
    if (amount <= 0 || amount > 5) {
      return {
        success: false,
        error: 'Amount must be between 0.1 and 5 SOL',
        network: networkName,
      };
    }

    // Request airdrop
    const amountLamports = amount * LAMPORTS_PER_SOL;
    console.log(`[WALLET ACTIONS] 💧 Requesting ${amount} SOL airdrop...`);
    
    const signature = await connection.requestAirdrop(
      publicKey,
      amountLamports
    );

    console.log(`[WALLET ACTIONS] 💧 Airdrop requested, confirming...`, {
      signature,
    });

    // Wait for confirmation (with timeout)
    await connection.confirmTransaction(signature, 'confirmed');

    // Get new balance
    const balance = await connection.getBalance(publicKey);
    const newBalance = balance / LAMPORTS_PER_SOL;

    console.log(`[WALLET ACTIONS] ✅ Airdrop confirmed!`, {
      signature,
      newBalance,
    });

    return {
      success: true,
      signature,
      newBalance,
      network: networkName,
    };
  } catch (error) {
    console.error("[WALLET ACTIONS] ❌ Airdrop failed:", error);
    
    let errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Handle common airdrop errors
    if (errorMessage.includes('airdrop limit')) {
      errorMessage = 'Airdrop limit reached. Please try again in a few minutes.';
    } else if (errorMessage.includes('429')) {
      errorMessage = 'Too many requests. Please wait a moment and try again.';
    }
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}
