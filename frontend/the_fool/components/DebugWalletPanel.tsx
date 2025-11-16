"use client";

/**
 * Unified Debug Panel - Development Tool
 *
 * Uses Zustand store for all wallet state management
 * No direct localStorage access - everything goes through the store
 */

import { useState, useEffect } from "react";
import { useGameStore } from "@/lib/gameStore";
import { useChainWalletStore } from "@/lib/chainWalletStore";

type DebugTab = "wallets" | "house" | "canvas" | "gameState";

export default function DebugPanel() {
  const [topUpAmount, setTopUpAmount] = useState(1000); // Default $1000
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DebugTab>("wallets");

  // Zustand stores
  const {
    wallets,
    userId,
    userBalance,
    houseVaultBalance,
    houseVaultReserved,
    loadWalletsFromLocalStorage,
    initHouseVault,
    topUpHouseVault,
    createUserWallet,
    topUpUserWallet,
    clearAll,
  } = useChainWalletStore();

  const kaplayDebug = useGameStore((state) => state.kaplayDebug);
  const toggleKaplayDebug = useGameStore((state) => state.toggleKaplayDebug);
  const isDiving = useGameStore((state) => state.isDiving);
  const isInOcean = useGameStore((state) => state.isInOcean);
  const shouldSurface = useGameStore((state) => state.shouldSurface);
  const survived = useGameStore((state) => state.survived);
  const depth = useGameStore((state) => state.depth);
  const treasureValue = useGameStore((state) => state.treasureValue);
  const animationMessage = useGameStore((state) => state.animationMessage);
  const isPlaying = useGameStore((state) => state.isPlaying);
  const diveNumber = useGameStore((state) => state.diveNumber);
  const currentTreasure = useGameStore((state) => state.currentTreasure);
  const walletBalance_game = useGameStore((state) => state.walletBalance);

  // Load wallets on mount
  useEffect(() => {
    loadWalletsFromLocalStorage();
  }, [loadWalletsFromLocalStorage]);

  // Top up wallet handler
  const handleTopUp = (address: string) => {
    if (address.includes("HOUSE_VAULT")) {
      topUpHouseVault(topUpAmount);
    } else {
      topUpUserWallet(address, topUpAmount);
    }
  };

  // Clear all with confirmation
  const handleClearAll = async () => {
    if (confirm("Clear all wallets and reset state? This cannot be undone.")) {
      const { resetGameChain } = await import("@/lib/ports");
      resetGameChain();
      clearAll();
      alert("All wallets cleared! The page will reload.");
      setTimeout(() => window.location.reload(), 1000);
    }
  };

  // Helper functions
  const getWalletLabel = (address: string): string => {
    if (address.includes("HOUSE_VAULT")) return "🏦 House Vault";
    if (address.includes("user_")) return "👤 User";
    return "💼 Wallet";
  };

  const formatAddress = (address: string): string => {
    if (address.length <= 30) return address;
    return `${address.substring(0, 20)}...${address.substring(address.length - 8)}`;
  };

  const houseAvailableFunds = houseVaultBalance - houseVaultReserved;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-mono text-sm z-50 shadow-lg transition-colors"
      >
        🔧 DEBUG PANEL
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 max-h-[80vh] bg-gray-900 border-2 border-purple-500 rounded-lg shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="bg-purple-600 p-3 flex justify-between items-center rounded-t-lg">
        <h3 className="font-mono text-sm font-bold text-white">DEBUG PANEL</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-white hover:text-gray-200 font-bold text-lg leading-none"
        >
          ×
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        {(["wallets", "house", "canvas", "gameState"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 px-3 font-mono text-xs transition-colors ${
              activeTab === tab
                ? "bg-purple-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* WALLETS TAB */}
        {activeTab === "wallets" && (
          <div className="space-y-3">
            {wallets.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400 text-sm font-mono mb-4">
                  No wallets yet
                </p>
                <p className="text-gray-500 text-xs font-mono">
                  Start a game to create wallets
                </p>
              </div>
            ) : (
              wallets.map((wallet) => (
                <div
                  key={wallet.address}
                  className="bg-gray-800 rounded-lg p-3 space-y-2"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono text-purple-400 mb-1">
                        {getWalletLabel(wallet.address)}
                      </div>
                      <div className="text-xs font-mono text-gray-400 break-all">
                        {formatAddress(wallet.address)}
                      </div>
                    </div>
                    <div className="text-right ml-2">
                      <div className="text-lg font-bold text-green-400">
                        {wallet.balance.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">SOL</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleTopUp(wallet.address)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-mono transition-colors"
                  >
                    + ${topUpAmount}
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* HOUSE TAB */}
        {activeTab === "house" && (
          <div className="space-y-3">
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="font-mono text-sm text-purple-400 mb-3">
                House Vault Status
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">Balance</span>
                  <span className="text-lg font-bold text-green-400">
                    {houseVaultBalance.toLocaleString()} SOL
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">Reserved</span>
                  <span className="text-lg font-bold text-orange-400">
                    {houseVaultReserved.toLocaleString()} SOL
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">Available</span>
                  <span className="text-lg font-bold text-blue-400">
                    {houseAvailableFunds.toLocaleString()} SOL
                  </span>
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-500 text-center font-mono">
              Auto-syncs from localStorage every 2s
            </div>
          </div>
        )}

        {/* CANVAS TAB */}
        {activeTab === "canvas" && (
          <div className="space-y-3">
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="font-mono text-sm text-purple-400 mb-3">
                Canvas State
              </h4>
              <div className="space-y-2 text-sm font-mono">
                <div className="flex justify-between">
                  <span className="text-gray-400">Diving:</span>
                  <span
                    className={isDiving ? "text-yellow-400" : "text-gray-500"}
                  >
                    {isDiving ? "YES" : "NO"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">In Ocean:</span>
                  <span
                    className={isInOcean ? "text-blue-400" : "text-gray-500"}
                  >
                    {isInOcean ? "YES" : "NO"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Surfacing:</span>
                  <span
                    className={
                      shouldSurface ? "text-cyan-400" : "text-gray-500"
                    }
                  >
                    {shouldSurface ? "YES" : "NO"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Survived:</span>
                  <span
                    className={
                      survived === undefined
                        ? "text-gray-500"
                        : survived
                          ? "text-green-400"
                          : "text-red-400"
                    }
                  >
                    {survived === undefined ? "N/A" : survived ? "YES" : "NO"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Depth:</span>
                  <span className="text-cyan-400">{depth}m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Treasure:</span>
                  <span className="text-yellow-400">${treasureValue}</span>
                </div>
                {animationMessage && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Message:</span>
                    <span className="text-purple-400">{animationMessage}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="font-mono text-sm text-purple-400 mb-3">
                Kaplay Debug
              </h4>
              <button
                onClick={toggleKaplayDebug}
                className={`w-full px-4 py-2 rounded font-mono text-sm transition-colors ${
                  kaplayDebug
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                }`}
              >
                {kaplayDebug ? "✅ DEBUG ON" : "DEBUG OFF"}
              </button>
            </div>
          </div>
        )}

        {/* GAME STATE TAB */}
        {activeTab === "gameState" && (
          <div className="space-y-3">
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="font-mono text-sm text-purple-400 mb-3">
                Game Logic State
              </h4>
              <div className="space-y-2 text-sm font-mono">
                <div className="flex justify-between">
                  <span className="text-gray-400">Playing:</span>
                  <span
                    className={isPlaying ? "text-green-400" : "text-gray-500"}
                  >
                    {isPlaying ? "YES" : "NO"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Dive Number:</span>
                  <span className="text-blue-400">#{diveNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Current Treasure:</span>
                  <span className="text-yellow-400">${currentTreasure}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Wallet Balance (Game):</span>
                  <span className="text-green-400">${walletBalance_game}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Wallet Balance (Store):</span>
                  <span className="text-green-400">{userBalance} SOL</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">User ID:</span>
                  <span className="text-purple-400 text-xs break-all">
                    {userId ? userId.substring(0, 20) + "..." : "Not set"}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-500 text-center font-mono">
              Read-only view of Zustand store state
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="border-t border-gray-700 p-4 space-y-2">
        {activeTab === "wallets" && (
          <>
            {wallets.length > 0 && (
              <div className="bg-yellow-900/50 border border-yellow-600 rounded p-2 text-xs text-yellow-200 font-mono mb-2">
                ⚠️ After changes, restart dev server:
                <br />
                <code className="text-yellow-100">Ctrl+C → npm run dev</code>
              </div>
            )}

            <div className="mb-2">
              <label className="text-xs text-gray-400 font-mono block mb-1">
                Top-up Amount ($)
              </label>
              <input
                type="number"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 rounded font-mono text-sm"
                min="1"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => initHouseVault()}
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded font-mono text-xs transition-colors"
              >
                🏦 Init Vault
              </button>
              <button
                onClick={() => topUpHouseVault(100000)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded font-mono text-xs transition-colors"
              >
                💰 +100k SOL
              </button>
            </div>

            <button
              onClick={() => createUserWallet()}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded font-mono text-sm transition-colors"
            >
              👤 Create User Wallet
            </button>

            <button
              onClick={() => loadWalletsFromLocalStorage()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-mono text-sm transition-colors"
            >
              🔄 Refresh Wallets
            </button>

            <button
              onClick={handleClearAll}
              className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-mono text-sm transition-colors"
            >
              🗑️ Clear All & Reload
            </button>
          </>
        )}

        {activeTab !== "wallets" && (
          <div className="text-center text-gray-500 text-xs font-mono py-2">
            Switch to Wallets tab for controls
          </div>
        )}
      </div>
    </div>
  );
}
