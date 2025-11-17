'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useMemo, useState } from 'react';
import { getGameChain, SolanaGameChain, WalletAdapter } from '@/lib/ports';
import type { PublicKey } from '@solana/web3.js';

/**
 * Hook to access game chain with wallet integration
 * 
 * Automatically updates SolanaGameChain with wallet adapter
 * when wallet connects/disconnects.
 * 
 * Returns:
 * - chain: GameChainPort instance (LocalGameChain or SolanaGameChain)
 * - wallet: Full wallet adapter object
 * - connected: Boolean indicating wallet connection
 * - publicKey: User's public key (if connected)
 * 
 * Usage:
 * ```tsx
 * function GameComponent() {
 *   const { chain, connected, publicKey } = useGameChain();
 * 
 *   async function startGame() {
 *     if (!connected || !publicKey) {
 *       alert('Please connect your wallet');
 *       return;
 *     }
 * 
 *     const result = await chain.startSession({
 *       userPubkey: publicKey.toBase58(),
 *       betAmountLamports: BigInt(0.1 * 1e9),
 *       maxPayoutLamports: BigInt(10 * 1e9),
 *       houseVaultPda: process.env.NEXT_PUBLIC_VAULT_PDA!,
 *     });
 *   }
 * }
 * ```
 */
export function useGameChain() {
  const wallet = useWallet();
  
  // Get singleton game chain instance
  const chain = useMemo(() => getGameChain(), []);
  
  // Update wallet in SolanaGameChain when wallet changes
  useEffect(() => {
    if (chain instanceof SolanaGameChain) {
      if (wallet.publicKey && wallet.signTransaction && wallet.signAllTransactions) {
        // Create adapter matching our interface
        const adapter: WalletAdapter = {
          publicKey: wallet.publicKey,
          signTransaction: wallet.signTransaction.bind(wallet),
          signAllTransactions: wallet.signAllTransactions.bind(wallet),
        };
        chain.setWallet(adapter);
        console.log('[useGameChain] Wallet connected:', wallet.publicKey.toBase58());
      } else {
        chain.setWallet(undefined);
        console.log('[useGameChain] Wallet disconnected');
      }
    }
  }, [chain, wallet.publicKey, wallet.signTransaction, wallet.signAllTransactions]);
  
  return {
    chain,
    wallet,
    connected: wallet.connected,
    publicKey: wallet.publicKey,
    connecting: wallet.connecting,
    disconnecting: wallet.disconnecting,
  };
}

/**
 * Hook to get user's SOL balance
 * 
 * Automatically refreshes when publicKey changes
 */
export function useUserBalance() {
  const { chain, publicKey } = useGameChain();
  const [balance, setBalance] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (!publicKey) {
      setBalance(null);
      return;
    }
    
    let mounted = true;
    
    async function fetchBalance() {
      setLoading(true);
      try {
        const bal = await chain.getUserBalance(publicKey.toBase58());
        if (mounted) {
          setBalance(bal);
        }
      } catch (error) {
        console.error('[useUserBalance] Error fetching balance:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }
    
    fetchBalance();
    
    // Refresh every 5 seconds
    const interval = setInterval(fetchBalance, 5000);
    
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [chain, publicKey]);
  
  return { balance, loading };
}
