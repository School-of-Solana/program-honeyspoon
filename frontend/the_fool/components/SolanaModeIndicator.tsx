"use client";

/**
 * Solana Mode Indicator
 *
 * Shows a small badge indicating whether the app is in Local or Solana mode.
 * Useful for developers to quickly see which mode they're in.
 *
 * - Local Mode: In-memory simulation (no blockchain)
 * - Solana Mode: Real blockchain transactions
 */
export function SolanaModeIndicator() {
  const useSolana = process.env.NEXT_PUBLIC_USE_SOLANA === "true";

  // Only show in development
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return (
    <div className="fixed top-20 left-4 z-40">
      <div
        className={`px-3 py-1 rounded text-xs font-mono ${
          useSolana ? "bg-green-600 text-white" : "bg-gray-600 text-white"
        }`}
        title={
          useSolana ? "Using real Solana blockchain" : "Using local simulation"
        }
      >
        {useSolana ? "🔗 Solana Mode" : "💻 Local Mode"}
      </div>
    </div>
  );
}

/**
 * Dev Tools Badge
 *
 * Shows that debug tools are available (only in local mode)
 */
export function DevToolsBadge() {
  const useSolana = process.env.NEXT_PUBLIC_USE_SOLANA === "true";
  const isDevelopment = process.env.NODE_ENV !== "production";

  // Only show in development AND local mode
  if (!isDevelopment || useSolana) {
    return null;
  }

  return (
    <div className="fixed top-32 left-4 z-40">
      <div
        className="px-3 py-1 rounded text-xs font-mono bg-yellow-600 text-white"
        title="Debug tools available (wallet top-up)"
      >
        🔧 Dev Tools Active
      </div>
    </div>
  );
}
