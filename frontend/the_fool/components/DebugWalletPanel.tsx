"use client";

/**
 * Unified Debug Panel - Development Tool
 *
 * Consolidates all debug interfaces:
 * - Wallet balances & top-ups
 * - House vault monitoring
 * - Canvas/Kaplay debug controls
 * - Game state inspection
 *
 * Only visible in development mode
 */

import { useState, useEffect } from "react";
import { dollarsToLamports, lamportsToDollars } from "@/lib/utils/lamports";
import { useGameStore } from "@/lib/gameStore";

interface WalletInfo {
  address: string;
  balance: number; // in dollars
  lamports: string;
}

interface HouseWalletInfo {
  balance: number;
  reservedFunds: number;
  availableFunds: number;
  totalPaidOut: number;
  totalReceived: number;
}

type DebugTab = "wallets" | "house" | "canvas" | "gameState";

interface DebugPanelProps {
  houseWalletInfo?: HouseWalletInfo;
}

export default function DebugPanel({ houseWalletInfo }: DebugPanelProps) {
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [topUpAmount, setTopUpAmount] = useState(1000); // Default $1000
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DebugTab>("wallets");
  const [localHouseInfo, setLocalHouseInfo] = useState<HouseWalletInfo>({
    balance: 0,
    reservedFunds: 0,
    availableFunds: 0,
    totalPaidOut: 0,
    totalReceived: 0,
  });

  // Get game state from store for debugging
  const kaplayDebug = useGameStore((state) => state.kaplayDebug);
  const toggleKaplayDebug = useGameStore((state) => state.toggleKaplayDebug);
  // Use individual selectors to avoid creating new objects on every render
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
  const walletBalance = useGameStore((state) => state.walletBalance);

  // Load wallets from localStorage
  const loadWallets = () => {
    if (typeof window === "undefined") return;

    try {
      console.log("[DEBUG] 🔄 Loading wallets from localStorage...");
      const walletsStr = localStorage.getItem("local_chain_wallets");
      const vaultsStr = localStorage.getItem("local_chain_vaults");
      const sessionsStr = localStorage.getItem("local_chain_sessions");

      console.log("[DEBUG] 📦 localStorage contents:", {
        walletsLength: walletsStr?.length || 0,
        vaultsLength: vaultsStr?.length || 0,
        sessionsLength: sessionsStr?.length || 0,
        walletsPreview: walletsStr?.substring(0, 100),
        vaultsPreview: vaultsStr?.substring(0, 100),
      });

      if (!walletsStr) {
        console.log("[DEBUG] ⚠️ No wallets found in localStorage");
        setWallets([]);
        return;
      }

      const walletsData = JSON.parse(walletsStr);
      console.log("[DEBUG] 📊 Parsed wallet data:", {
        walletCount: Object.keys(walletsData).length,
        addresses: Object.keys(walletsData).map(
          (addr) => addr.substring(0, 20) + "..."
        ),
      });

      const walletList: WalletInfo[] = Object.entries(walletsData).map(
        ([address, lamports]) => ({
          address,
          balance: lamportsToDollars(BigInt(lamports as string)),
          lamports: lamports as string,
        })
      );

      // Sort: house vault first, then users
      walletList.sort((a, b) => {
        if (a.address.includes("HOUSE_VAULT")) return -1;
        if (b.address.includes("HOUSE_VAULT")) return 1;
        return a.address.localeCompare(b.address);
      });

      console.log(
        "[DEBUG] ✅ Loaded wallets:",
        walletList.map((w) => ({
          type: getWalletLabel(w.address),
          address: w.address.substring(0, 20) + "...",
          balance: w.balance,
        }))
      );

      setWallets(walletList);

      // Update local house wallet info from localStorage
      const vaultAddress = "HOUSE_VAULT_house_authority_main";
      const vaultBalance = walletsData[vaultAddress]
        ? lamportsToDollars(BigInt(walletsData[vaultAddress]))
        : 0;

      // Parse vault state from local_chain_vaults if it exists
      let reservedFunds = 0;
      if (vaultsStr) {
        try {
          const vaultsData = JSON.parse(vaultsStr);
          const vaultState = vaultsData[vaultAddress];
          if (vaultState && vaultState.totalReserved) {
            reservedFunds = lamportsToDollars(BigInt(vaultState.totalReserved));
          }
        } catch (e) {
          console.warn("[DEBUG] Failed to parse vault state:", e);
        }
      }

      setLocalHouseInfo({
        balance: vaultBalance,
        reservedFunds: reservedFunds,
        availableFunds: vaultBalance - reservedFunds,
        totalPaidOut: 0, // Not tracked in localStorage
        totalReceived: 0, // Not tracked in localStorage
      });

      console.log("[DEBUG] 🏦 Updated house info:", {
        balance: vaultBalance,
        reservedFunds: reservedFunds,
        availableFunds: vaultBalance - reservedFunds,
      });
    } catch (error) {
      console.error("[DEBUG] ❌ Failed to load wallets:", error);
      setWallets([]);
    }
  };

  // Top up a wallet
  const topUpWallet = (address: string) => {
    if (typeof window === "undefined") return;

    try {
      console.log(
        `[DEBUG] 💵 Topping up wallet: ${address.substring(0, 20)}... with $${topUpAmount}`
      );

      const walletsStr = localStorage.getItem("local_chain_wallets");
      const walletsData = walletsStr ? JSON.parse(walletsStr) : {};

      const currentBalance = BigInt(walletsData[address] || "0");
      const topUpLamports = dollarsToLamports(topUpAmount);
      const newBalance = currentBalance + topUpLamports;

      console.log(`[DEBUG] 💰 Balance change:`, {
        address: address.substring(0, 20) + "...",
        oldBalance: currentBalance.toString(),
        topUpAmount: topUpLamports.toString(),
        newBalance: newBalance.toString(),
      });

      walletsData[address] = newBalance.toString();
      localStorage.setItem("local_chain_wallets", JSON.stringify(walletsData));

      console.log(
        `[DEBUG] ✅ Topped up ${address.substring(0, 20)}...: +$${topUpAmount}`
      );
      loadWallets(); // Refresh display
    } catch (error) {
      console.error("[DEBUG] ❌ Failed to top up wallet:", error);
    }
  };

  // Initialize house vault manually
  const initializeHouseVault = () => {
    if (typeof window === "undefined") return;

    console.log("[DEBUG] 🏦 Initializing house vault...");

    const wallets = JSON.parse(
      localStorage.getItem("local_chain_wallets") || "{}"
    );
    const vaultAddress = "HOUSE_VAULT_house_authority_main";
    const initialBalance = "500000000000000"; // 500k SOL in lamports

    wallets[vaultAddress] = initialBalance;
    localStorage.setItem("local_chain_wallets", JSON.stringify(wallets));

    // Also create the vault state entry
    const vaults = JSON.parse(
      localStorage.getItem("local_chain_vaults") || "{}"
    );
    vaults[vaultAddress] = {
      vaultPda: vaultAddress,
      houseAuthority: "house_authority_main",
      locked: false,
      totalReserved: "0",
      bump: 255,
    };
    localStorage.setItem("local_chain_vaults", JSON.stringify(vaults));

    console.log("[DEBUG] ✅ House vault created:", {
      address: vaultAddress,
      balance: initialBalance,
      balanceSOL: 500000,
    });

    loadWallets();
    alert(
      "House vault initialized with 500,000 SOL! IMPORTANT: Restart your dev server (Ctrl+C and npm run dev) for the server to see it."
    );
  };

  // Top up house vault
  const topUpHouseVault = () => {
    if (typeof window === "undefined") return;

    console.log("[DEBUG] 💰 Topping up house vault...");

    const wallets = JSON.parse(
      localStorage.getItem("local_chain_wallets") || "{}"
    );
    const vaultAddress = "HOUSE_VAULT_house_authority_main";

    if (!wallets[vaultAddress]) {
      alert("House vault doesn't exist! Please initialize it first.");
      return;
    }

    const currentBalance = BigInt(wallets[vaultAddress]);
    const addAmount = BigInt(100000) * BigInt(1_000_000_000); // Add 100k SOL in lamports
    const newBalance = currentBalance + addAmount;

    wallets[vaultAddress] = newBalance.toString();
    localStorage.setItem("local_chain_wallets", JSON.stringify(wallets));

    console.log("[DEBUG] ✅ House vault topped up:", {
      oldBalance: currentBalance.toString(),
      added: addAmount.toString(),
      newBalance: newBalance.toString(),
    });

    loadWallets();
    alert(`House vault topped up with 100,000 SOL!`);
  };

  // Create user wallet manually
  const createUserWallet = () => {
    if (typeof window === "undefined") return;

    console.log("[DEBUG] 👤 Creating user wallet...");

    const wallets = JSON.parse(
      localStorage.getItem("local_chain_wallets") || "{}"
    );
    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const initialBalance = "1000000000000"; // 1000 SOL in lamports

    wallets[userId] = initialBalance;
    localStorage.setItem("local_chain_wallets", JSON.stringify(wallets));

    console.log("[DEBUG] ✅ User wallet created:", {
      userId,
      balance: initialBalance,
      balanceSOL: 1000,
    });

    loadWallets();
    alert(`User wallet created: ${userId.substring(0, 30)}... with 1,000 SOL!`);
  };

  // Clear all wallets
  const clearAllWallets = async () => {
    if (typeof window === "undefined") return;

    if (confirm("Clear all wallets and reset state? This cannot be undone.")) {
      console.log("[DEBUG] 🗑️ Starting wallet clear process...");

      // Log before state
      console.log("[DEBUG] 📊 Before clear:", {
        wallets: localStorage.getItem("local_chain_wallets")?.substring(0, 100),
        vaults: localStorage.getItem("local_chain_vaults")?.substring(0, 100),
        sessions: localStorage
          .getItem("local_chain_sessions")
          ?.substring(0, 100),
        counter: localStorage.getItem("local_chain_session_counter"),
      });

      // Import resetGameChain function
      const { resetGameChain } = await import("@/lib/ports");

      // Reset the game chain instance (this will clear localStorage)
      console.log("[DEBUG] 🔄 Calling resetGameChain()...");
      resetGameChain();

      // Log after state
      console.log("[DEBUG] 📊 After clear:", {
        wallets: localStorage.getItem("local_chain_wallets"),
        vaults: localStorage.getItem("local_chain_vaults"),
        sessions: localStorage.getItem("local_chain_sessions"),
        counter: localStorage.getItem("local_chain_session_counter"),
      });

      console.log("[DEBUG] ✅ Cleared all chain state");
      loadWallets();

      console.log("[DEBUG] 🔄 Page will reload in 1 second...");
      alert("All wallets cleared! The page will reload to reinitialize.");

      // Reload the page to create a fresh chain instance
      setTimeout(() => {
        console.log("[DEBUG] 🔄 Reloading page now...");
        window.location.reload();
      }, 1000);
    }
  };

  // Get wallet type label
  const getWalletLabel = (address: string): string => {
    if (address.includes("HOUSE_VAULT")) return "🏦 House Vault";
    if (address.includes("user_")) return "👤 User";
    return "💼 Wallet";
  };

  // Format address for display
  const formatAddress = (address: string): string => {
    if (address.length <= 30) return address;
    return `${address.substring(0, 20)}...${address.substring(address.length - 8)}`;
  };

  useEffect(() => {
    console.log("[DEBUG] 🚀 DebugPanel mounted - initial load");
    loadWallets();

    // Refresh every 2 seconds
    const interval = setInterval(() => {
      console.log("[DEBUG] ⏰ Auto-refresh wallets (2s interval)");
      loadWallets();
    }, 2000);
    return () => {
      console.log("[DEBUG] 🛑 DebugPanel unmounting - clearing interval");
      clearInterval(interval);
    };
  }, []);

  // Tab configurations
  const tabs: { id: DebugTab; label: string; icon: string }[] = [
    { id: "wallets", label: "Wallets", icon: "💰" },
    { id: "house", label: "House", icon: "🏦" },
    { id: "canvas", label: "Canvas", icon: "🎨" },
    { id: "gameState", label: "State", icon: "🎮" },
  ];

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
        >
          <span>🔧</span>
          <span className="font-mono text-sm">DEBUG PANEL</span>
        </button>
      )}

      {/* Panel */}
      {isOpen && (
        <div className="bg-gray-900 text-white rounded-lg shadow-2xl border-2 border-purple-500 w-[550px] max-h-[700px] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="bg-purple-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🔧</span>
              <h3 className="font-mono font-bold">DEBUG PANEL</h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:text-gray-300 text-xl"
            >
              ×
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="bg-gray-800 px-2 py-2 flex gap-1 border-b border-gray-700">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1 px-3 py-2 rounded font-mono text-xs transition-colors ${
                  activeTab === tab.id
                    ? "bg-purple-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Content - Tab-specific */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* WALLETS TAB */}
            {activeTab === "wallets" && (
              <>
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
                    <p className="text-xs mt-2">
                      Start a game to create wallets
                    </p>
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
                              $
                              {wallet.balance.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </div>
                            <div className="text-xs text-gray-500 font-mono">
                              {BigInt(wallet.lamports).toLocaleString()}{" "}
                              lamports
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
              </>
            )}

            {/* HOUSE TAB */}
            {activeTab === "house" && (
              <div className="space-y-3">
                <div className="bg-gray-800 rounded-lg p-4">
                  <h4 className="font-mono text-sm text-purple-400 mb-3">
                    House Vault Status (localStorage)
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-400">Balance</span>
                      <span className="text-lg font-bold text-green-400">
                        ${localHouseInfo.balance.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-400">Reserved</span>
                      <span className="text-lg font-bold text-orange-400">
                        ${localHouseInfo.reservedFunds.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-400">Available</span>
                      <span className="text-lg font-bold text-blue-400">
                        ${localHouseInfo.availableFunds.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-px bg-gray-700 my-2"></div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-400">
                        Total Paid Out
                      </span>
                      <span className="text-sm font-mono text-red-400">
                        ${localHouseInfo.totalPaidOut.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-400">
                        Total Received
                      </span>
                      <span className="text-sm font-mono text-purple-400">
                        ${localHouseInfo.totalReceived.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-gray-500 text-center font-mono">
                  Auto-refreshes every 2 seconds from localStorage
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
                        className={
                          isDiving ? "text-yellow-400" : "text-gray-500"
                        }
                      >
                        {isDiving ? "YES" : "NO"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">In Ocean:</span>
                      <span
                        className={
                          isInOcean ? "text-blue-400" : "text-gray-500"
                        }
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
                        {survived === undefined
                          ? "N/A"
                          : survived
                            ? "YES"
                            : "NO"}
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
                        <span className="text-purple-400">
                          {animationMessage}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Kaplay Debug Toggle */}
                <div className="bg-gray-800 rounded-lg p-4">
                  <h4 className="font-mono text-sm text-purple-400 mb-3">
                    Kaplay Debug Mode
                  </h4>
                  <button
                    onClick={toggleKaplayDebug}
                    className={`w-full py-3 rounded font-mono text-sm transition-colors ${
                      kaplayDebug
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                    }`}
                  >
                    {kaplayDebug ? "🟢 DEBUG MODE ON" : "⚪ DEBUG MODE OFF"}
                  </button>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Shows hitboxes and object info on canvas
                  </p>
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
                        className={
                          isPlaying ? "text-green-400" : "text-gray-500"
                        }
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
                      <span className="text-yellow-400">
                        ${currentTreasure}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Wallet Balance:</span>
                      <span className="text-green-400">${walletBalance}</span>
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
                {/* Warning banner */}
                {wallets.length > 0 && (
                  <div className="bg-yellow-900/50 border border-yellow-600 rounded p-2 text-xs text-yellow-200 font-mono">
                    ⚠️ After changing wallets, restart dev server:
                    <br />
                    <code className="text-yellow-100">
                      Ctrl+C → npm run dev
                    </code>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={initializeHouseVault}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded font-mono text-xs transition-colors"
                  >
                    🏦 Init Vault
                  </button>
                  <button
                    onClick={topUpHouseVault}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded font-mono text-xs transition-colors"
                  >
                    💰 +100k SOL
                  </button>
                </div>
                <button
                  onClick={createUserWallet}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded font-mono text-sm transition-colors"
                >
                  👤 Create User Wallet
                </button>
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
                  🗑️ Clear All & Reload
                </button>
              </>
            )}
            {activeTab !== "wallets" && (
              <div className="text-center text-gray-500 text-xs font-mono py-2">
                Switch to tabs to access more controls
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
