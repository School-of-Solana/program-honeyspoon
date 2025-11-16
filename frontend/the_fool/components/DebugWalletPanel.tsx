"use client";

/**
 * Debug Wallet Panel - Development Tool
 * 
 * Shows wallet balances and allows topping up house/user wallets
 * Only visible in development mode with ?debug=true
 */

import { useState, useEffect } from "react";
import { dollarsToLamports, lamportsToDollars } from "@/lib/utils/lamports";

interface WalletInfo {
  address: string;
  balance: number; // in dollars
  lamports: string;
}

export default function DebugWalletPanel() {
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [topUpAmount, setTopUpAmount] = useState(1000); // Default $1000
  const [isOpen, setIsOpen] = useState(false);

  // Load wallets from localStorage
  const loadWallets = () => {
    if (typeof window === 'undefined') return;

    try {
      const walletsStr = localStorage.getItem('local_chain_wallets');
      if (!walletsStr) {
        setWallets([]);
        return;
      }

      const walletsData = JSON.parse(walletsStr);
      const walletList: WalletInfo[] = Object.entries(walletsData).map(([address, lamports]) => ({
        address,
        balance: lamportsToDollars(BigInt(lamports as string)),
        lamports: lamports as string,
      }));

      // Sort: house vault first, then users
      walletList.sort((a, b) => {
        if (a.address.includes('HOUSE_VAULT')) return -1;
        if (b.address.includes('HOUSE_VAULT')) return 1;
        return a.address.localeCompare(b.address);
      });

      setWallets(walletList);
    } catch (error) {
      console.error('[DEBUG] Failed to load wallets:', error);
      setWallets([]);
    }
  };

  // Top up a wallet
  const topUpWallet = (address: string) => {
    if (typeof window === 'undefined') return;

    try {
      const walletsStr = localStorage.getItem('local_chain_wallets');
      const walletsData = walletsStr ? JSON.parse(walletsStr) : {};
      
      const currentBalance = BigInt(walletsData[address] || '0');
      const topUpLamports = dollarsToLamports(topUpAmount);
      const newBalance = currentBalance + topUpLamports;
      
      walletsData[address] = newBalance.toString();
      localStorage.setItem('local_chain_wallets', JSON.stringify(walletsData));
      
      console.log(`[DEBUG] 💵 Topped up ${address.substring(0, 20)}...: +$${topUpAmount}`);
      loadWallets(); // Refresh display
    } catch (error) {
      console.error('[DEBUG] Failed to top up wallet:', error);
    }
  };

  // Clear all wallets
  const clearAllWallets = () => {
    if (typeof window === 'undefined') return;
    
    if (confirm('Clear all wallets and reset state? This cannot be undone.')) {
      localStorage.removeItem('local_chain_wallets');
      localStorage.removeItem('local_chain_vaults');
      localStorage.removeItem('local_chain_sessions');
      localStorage.removeItem('local_chain_session_counter');
      console.log('[DEBUG] 🔄 Cleared all chain state');
      loadWallets();
      alert('All wallets cleared! Refresh the page to start fresh.');
    }
  };

  // Get wallet type label
  const getWalletLabel = (address: string): string => {
    if (address.includes('HOUSE_VAULT')) return '🏦 House Vault';
    if (address.includes('user_')) return '👤 User';
    return '💼 Wallet';
  };

  // Format address for display
  const formatAddress = (address: string): string => {
    if (address.length <= 30) return address;
    return `${address.substring(0, 20)}...${address.substring(address.length - 8)}`;
  };

  useEffect(() => {
    loadWallets();
    
    // Refresh every 2 seconds
    const interval = setInterval(loadWallets, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
        >
          <span>💰</span>
          <span className="font-mono text-sm">DEBUG WALLETS</span>
        </button>
      )}

      {/* Panel */}
      {isOpen && (
        <div className="bg-gray-900 text-white rounded-lg shadow-2xl border-2 border-purple-500 w-[500px] max-h-[600px] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="bg-purple-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">💰</span>
              <h3 className="font-mono font-bold">DEBUG: Chain Wallets</h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:text-gray-300 text-xl"
            >
              ×
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Top-up controls */}
            <div className="bg-gray-800 rounded-lg p-3 space-y-2">
              <label className="block text-sm font-mono text-gray-400">
                Top-up Amount (USD)
              </label>
              <input
                type="number"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(Number(e.target.value))}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded font-mono"
                min="1"
                step="100"
              />
            </div>

            {/* Wallets List */}
            {wallets.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                <p className="font-mono text-sm">No wallets yet</p>
                <p className="text-xs mt-2">Start a game to create wallets</p>
              </div>
            ) : (
              <div className="space-y-3">
                {wallets.map((wallet) => (
                  <div
                    key={wallet.address}
                    className="bg-gray-800 rounded-lg p-3 space-y-2"
                  >
                    {/* Wallet Type & Address */}
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm text-purple-400">
                        {getWalletLabel(wallet.address)}
                      </span>
                    </div>
                    <div className="font-mono text-xs text-gray-400 break-all">
                      {formatAddress(wallet.address)}
                    </div>

                    {/* Balance */}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold text-green-400">
                          ${wallet.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-gray-500 font-mono">
                          {BigInt(wallet.lamports).toLocaleString()} lamports
                        </div>
                      </div>

                      {/* Top-up Button */}
                      <button
                        onClick={() => topUpWallet(wallet.address)}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm font-mono transition-colors"
                      >
                        +${topUpAmount}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="border-t border-gray-700 p-4 space-y-2">
            <button
              onClick={loadWallets}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-mono text-sm transition-colors"
            >
              🔄 Refresh Wallets
            </button>
            <button
              onClick={clearAllWallets}
              className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-mono text-sm transition-colors"
            >
              🗑️ Clear All Wallets
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
