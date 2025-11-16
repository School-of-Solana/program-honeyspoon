"use client";

/**
 * Debug Wallet Panel - Read-Only Wallet Information Display
 *
 * Shows current wallet balances from server (blockchain state).
 * SECURITY: No admin functions exposed (no top-up, no clear, etc.)
 *
 * For admin functions, use direct blockchain operations or create
 * separate admin panel with proper authentication.
 */

import { useState } from "react";
import { useChainWalletStore } from "@/lib/chainWalletStore";
import { GAME_COLORS } from "@/lib/gameColors";

export default function DebugWalletPanel() {
  // Toggle state
  const [isOpen, setIsOpen] = useState(false);

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
            💰 WALLET INFO (READ-ONLY)
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
            Balances are READ-ONLY. Only game actions can modify them.
            <br />
            Updates every 2 seconds automatically.
          </div>
        </div>
      )}
    </div>
  );
}
