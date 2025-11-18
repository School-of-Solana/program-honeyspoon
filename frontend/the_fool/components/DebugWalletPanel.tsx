"use client";

/**
 * Debug Wallet Panel - Wallet Information Display with Debug Tools
 *
 * Shows current wallet balances from server (blockchain state).
 * In development mode, provides debug tools to top up wallets.
 *
 * SECURITY: Top-up actions are server-side protected (only work when NODE_ENV !== 'production')
 */

/* eslint-disable react-hooks/rules-of-hooks */
import { useState } from "react";
import { useChainWalletStore } from "@/lib/chainWalletStore";
import { GAME_COLORS } from "@/lib/gameColors";
import {
  debugTopUpUserWallet,
  debugTopUpHouseVault,
} from "@/app/actions/walletActions";

export default function DebugWalletPanel() {
  // Check if we're using Solana mode
  const useSolana = process.env.NEXT_PUBLIC_USE_SOLANA === "true";

  // Hide panel completely if using real Solana
  if (useSolana) {
    return null;
  }

  // Toggle state
  const [isOpen, setIsOpen] = useState(false);
  const [isTopping, setIsTopping] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("100");
  const [message, setMessage] = useState("");

  // Read-only state from Zustand (fetches from server)
  const userId = useChainWalletStore((state) => state.userId);
  const userBalance = useChainWalletStore((state) => state.userBalance);
  const houseBalance = useChainWalletStore((state) => state.houseVaultBalance);
  const houseReserved = useChainWalletStore(
    (state) => state.houseVaultReserved
  );
  const isLoading = useChainWalletStore((state) => state.isLoading);
  const lastUpdated = useChainWalletStore((state) => state.lastUpdated);
  const refreshBalance = useChainWalletStore((state) => state.refreshBalance);

  const houseAvailable = houseBalance - houseReserved;

  // Check if we're in development mode (client-side check for UI only)
  const isDevelopment = process.env.NODE_ENV !== "production";

  // Handle top-up user wallet
  const handleTopUpUser = async () => {
    if (!userId) return;
    setIsTopping(true);
    setMessage("");

    try {
      const amount = parseFloat(topUpAmount);
      if (isNaN(amount) || amount <= 0) {
        setMessage("❌ Invalid amount");
        setIsTopping(false);
        return;
      }

      const result = await debugTopUpUserWallet(userId, amount);

      if (result.success) {
        setMessage(`✅ Topped up ${amount} SOL!`);
        // Refresh balance to show new value
        await refreshBalance();
      } else {
        setMessage(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      setMessage(`❌ Failed: ${error}`);
    } finally {
      setIsTopping(false);
      // Clear message after 3 seconds
      setTimeout(() => setMessage(""), 3000);
    }
  };

  // Handle top-up house vault (using mock PDA)
  const handleTopUpHouse = async () => {
    setIsTopping(true);
    setMessage("");

    try {
      const amount = parseFloat(topUpAmount);
      if (isNaN(amount) || amount <= 0) {
        setMessage("❌ Invalid amount");
        setIsTopping(false);
        return;
      }

      // Mock house vault PDA (matches what gameEngine uses)
      const vaultPda = "HOUSE_VAULT_PDA_house_authority_main";
      const result = await debugTopUpHouseVault(vaultPda, amount);

      if (result.success) {
        setMessage(`✅ Topped up house ${amount} SOL!`);
        // Refresh balance to show new value
        await refreshBalance();
      } else {
        setMessage(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      setMessage(`❌ Failed: ${error}`);
    } finally {
      setIsTopping(false);
      // Clear message after 3 seconds
      setTimeout(() => setMessage(""), 3000);
    }
  };

  return (
    <div
      className="fixed bottom-4 right-4 z-50"
      style={{
        maxWidth: "400px",
      }}
    >
      {/* Toggle Button (always visible) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="nes-btn is-primary"
          style={{
            fontSize: "10px",
            padding: "12px 16px",
            marginLeft: "auto",
            display: "block",
          }}
        >
          💰 WALLET
        </button>
      )}

      {/* Panel (shown when open) */}
      {isOpen && (
        <div
          className="nes-container is-dark with-title"
          style={{
            backgroundColor: GAME_COLORS.BACKGROUND_DARKER,
            fontSize: "8px",
          }}
        >
          <p className="title" style={{ fontSize: "10px" }}>
            💰 WALLET INFO {isDevelopment && "🔧"}
          </p>

          {/* Close Button */}
          <button
            onClick={() => setIsOpen(false)}
            className="nes-btn is-error"
            style={{
              position: "absolute",
              top: "8px",
              right: "8px",
              fontSize: "8px",
              padding: "4px 8px",
            }}
          >
            ✕
          </button>

          {/* Loading Indicator */}
          {isLoading && (
            <div style={{ textAlign: "center", marginBottom: "8px" }}>
              <span>Loading...</span>
            </div>
          )}

          {/* Last Updated */}
          {lastUpdated && !isLoading && (
            <div style={{ marginBottom: "12px", opacity: 0.6 }}>
              <small>
                Last updated: {new Date(lastUpdated).toLocaleTimeString()}
              </small>
            </div>
          )}

          {/* User Wallet */}
          <div
            className="nes-container is-rounded"
            style={{ marginBottom: "12px" }}
          >
            <div style={{ marginBottom: "8px" }}>
              <strong>👤 USER WALLET</strong>
            </div>
            {userId ? (
              <>
                <div
                  style={{
                    marginBottom: "4px",
                    fontSize: "7px",
                    opacity: 0.7,
                  }}
                >
                  Address: {userId.substring(0, 20)}...
                </div>
                <div
                  style={{
                    fontSize: "16px",
                    fontWeight: "bold",
                    color: GAME_COLORS.TREASURE_GOLD,
                  }}
                >
                  {userBalance.toLocaleString()} SOL
                </div>
              </>
            ) : (
              <div style={{ opacity: 0.5 }}>No user wallet</div>
            )}
          </div>

          {/* House Vault */}
          <div
            className="nes-container is-rounded"
            style={{ marginBottom: "12px" }}
          >
            <div style={{ marginBottom: "8px" }}>
              <strong>🏦 HOUSE VAULT</strong>
            </div>
            <div style={{ marginBottom: "4px" }}>
              <span style={{ opacity: 0.7 }}>Total:</span>{" "}
              <span style={{ fontWeight: "bold" }}>
                {houseBalance.toLocaleString()} SOL
              </span>
            </div>
            <div style={{ marginBottom: "4px" }}>
              <span style={{ opacity: 0.7 }}>Reserved:</span>{" "}
              <span style={{ color: GAME_COLORS.DANGER }}>
                {houseReserved.toLocaleString()} SOL
              </span>
            </div>
            <div>
              <span style={{ opacity: 0.7 }}>Available:</span>{" "}
              <span style={{ color: GAME_COLORS.SUCCESS }}>
                {houseAvailable.toLocaleString()} SOL
              </span>
            </div>
          </div>

          {/* Debug Tools (Development Only) */}
          {isDevelopment && (
            <div
              className="nes-container is-rounded"
              style={{
                marginBottom: "12px",
                backgroundColor: "rgba(255, 165, 0, 0.1)",
              }}
            >
              <div style={{ marginBottom: "8px" }}>
                <strong>🔧 DEBUG TOOLS</strong>
              </div>

              {/* Amount Input */}
              <div style={{ marginBottom: "8px" }}>
                <label style={{ fontSize: "8px", opacity: 0.7 }}>
                  Amount (SOL):
                </label>
                <input
                  type="number"
                  className="nes-input"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  disabled={isTopping}
                  style={{
                    fontSize: "10px",
                    padding: "4px",
                    marginTop: "4px",
                  }}
                />
              </div>

              {/* Top-up Buttons */}
              <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                <button
                  onClick={handleTopUpUser}
                  disabled={isTopping || !userId}
                  className={`nes-btn ${isTopping || !userId ? "is-disabled" : "is-warning"}`}
                  style={{ fontSize: "7px", padding: "6px", flex: 1 }}
                >
                  {isTopping ? "..." : "💰 Top Up User"}
                </button>
                <button
                  onClick={handleTopUpHouse}
                  disabled={isTopping}
                  className={`nes-btn ${isTopping ? "is-disabled" : "is-warning"}`}
                  style={{ fontSize: "7px", padding: "6px", flex: 1 }}
                >
                  {isTopping ? "..." : "🏦 Top Up House"}
                </button>
              </div>

              {/* Message */}
              {message && (
                <div
                  style={{
                    fontSize: "7px",
                    textAlign: "center",
                    padding: "4px",
                    marginTop: "4px",
                  }}
                >
                  {message}
                </div>
              )}

              <div
                style={{
                  fontSize: "6px",
                  opacity: 0.5,
                  textAlign: "center",
                  marginTop: "4px",
                }}
              >
                Dev only - server-side protected
              </div>
            </div>
          )}

          {/* Refresh Button */}
          <button
            onClick={() => refreshBalance()}
            disabled={isLoading || !userId}
            className={`nes-btn ${isLoading || !userId ? "is-disabled" : "is-primary"} w-full`}
            style={{ fontSize: "8px", padding: "8px" }}
          >
            {isLoading ? "LOADING..." : "🔄 REFRESH"}
          </button>

          {/* Info */}
          <div
            style={{
              marginTop: "12px",
              fontSize: "6px",
              opacity: 0.5,
              textAlign: "center",
            }}
          >
            Balances update from server automatically every 5 seconds.
            {!isDevelopment && (
              <>
                <br />
                (Debug tools hidden in production)
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
