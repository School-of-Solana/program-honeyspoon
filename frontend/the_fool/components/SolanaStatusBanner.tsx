"use client";

import { useEffect, useState } from "react";
import { Connection } from "@solana/web3.js";
import {
  detectSolanaNetwork,
  getNetworkDisplayName,
  getNetworkBadgeColor,
} from "@/lib/utils/networkDetection";

/**
 * Banner that shows Solana connection status
 * - Shows temporary banner on initial connection (auto-hides after 10s)
 * - Adds persistent colored border around page to indicate network
 * - Warns users if network is not running when in Solana mode
 */
export function SolanaStatusBanner() {
  const useSolana = process.env.NEXT_PUBLIC_USE_SOLANA === "true";
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "http://localhost:8899";

  const [connected, setConnected] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(useSolana); // Initialize based on useSolana
  const [showBanner, setShowBanner] = useState(true);

  // Detect network from RPC URL
  const network = detectSolanaNetwork(rpcUrl);
  const networkName = getNetworkDisplayName(network);
  const badgeColor = getNetworkBadgeColor(network);

  useEffect(() => {
    if (!useSolana) {
      return;
    }

    let mounted = true;

    async function checkConnection() {
      try {
        const connection = new Connection(rpcUrl, "confirmed");
        await connection.getVersion();
        if (mounted) {
          setConnected(true);
          setChecking(false);
        }
      } catch (_error) {
        if (mounted) {
          setConnected(false);
          setChecking(false);
        }
      }
    }

    checkConnection();

    // Check periodically
    const interval = setInterval(checkConnection, 10000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [useSolana, rpcUrl]);

  // Auto-hide success banner after 10 seconds
  useEffect(() => {
    if (connected && showBanner) {
      const timer = setTimeout(() => {
        setShowBanner(false);
      }, 10000); // 10 seconds

      return () => clearTimeout(timer);
    }
  }, [connected, showBanner]);

  // Add global border styling for network indication
  useEffect(() => {
    if (!useSolana || !connected) return;

    // Add border to body
    document.body.style.border = `4px solid ${badgeColor}`;
    document.body.style.boxSizing = "border-box";

    return () => {
      // Cleanup on unmount
      document.body.style.border = "";
    };
  }, [useSolana, connected, badgeColor]);

  // Don't show anything if not in Solana mode
  if (!useSolana) {
    return null;
  }

  // Show checking state
  if (checking) {
    return (
      <div className="fixed top-0 left-0 right-0 bg-blue-600 text-white text-center py-2 text-sm z-50">
        🔍 Checking Solana connection...
      </div>
    );
  }

  // Show error if not connected (persistent, no auto-hide)
  if (!connected) {
    const isLocalhost = network === "localhost";
    return (
      <div className="fixed top-0 left-0 right-0 bg-red-600 text-white text-center py-3 text-sm z-50 shadow-lg">
        <div className="container mx-auto px-4">
          <p className="font-bold mb-1">
            WARNING: Solana {networkName} Not Connected
          </p>
          {isLocalhost && (
            <p className="text-xs opacity-90">
              Run{" "}
              <code className="bg-red-700 px-2 py-0.5 rounded">
                npm run setup
              </code>{" "}
              to start localnet, or switch to Local mode in .env.local
              (NEXT_PUBLIC_USE_SOLANA=false)
            </p>
          )}
          {!isLocalhost && (
            <p className="text-xs opacity-90">
              Cannot connect to {rpcUrl}. Check your network connection.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Show success banner only if showBanner is true (auto-hides after 10s)
  if (!showBanner) {
    return null;
  }

  const bgStyle = {
    backgroundColor: badgeColor,
  };

  return (
    <div
      className="fixed top-0 left-0 right-0 text-white text-center py-2 text-xs z-50 transition-opacity duration-500"
      style={bgStyle}
    >
      OK: Connected to Solana {networkName} ({rpcUrl})
    </div>
  );
}
