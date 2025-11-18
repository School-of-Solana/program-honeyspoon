/**
 * Network Detection Utility
 *
 * Detects which Solana network we're connected to based on RPC URL
 */

export enum SolanaNetwork {
  LOCALHOST = "localhost",
  DEVNET = "devnet",
  TESTNET = "testnet",
  MAINNET = "mainnet-beta",
  UNKNOWN = "unknown",
}

/**
 * Detect which Solana network we're connected to
 */
export function detectSolanaNetwork(rpcUrl?: string): SolanaNetwork {
  const url =
    rpcUrl || process.env.NEXT_PUBLIC_RPC_URL || "http://localhost:8899";

  const urlLower = url.toLowerCase();

  if (urlLower.includes("localhost") || urlLower.includes("127.0.0.1")) {
    return SolanaNetwork.LOCALHOST;
  }

  if (urlLower.includes("devnet")) {
    return SolanaNetwork.DEVNET;
  }

  if (urlLower.includes("testnet")) {
    return SolanaNetwork.TESTNET;
  }

  if (urlLower.includes("mainnet")) {
    return SolanaNetwork.MAINNET;
  }

  return SolanaNetwork.UNKNOWN;
}

/**
 * Check if airdrops are allowed on this network
 */
export function canAirdrop(network?: SolanaNetwork): boolean {
  const net = network || detectSolanaNetwork();

  // Only allow airdrops on localhost and devnet
  return net === SolanaNetwork.LOCALHOST || net === SolanaNetwork.DEVNET;
}

/**
 * Get a human-readable network name
 */
export function getNetworkDisplayName(network?: SolanaNetwork): string {
  const net = network || detectSolanaNetwork();

  switch (net) {
    case SolanaNetwork.LOCALHOST:
      return "Localhost";
    case SolanaNetwork.DEVNET:
      return "Devnet";
    case SolanaNetwork.TESTNET:
      return "Testnet";
    case SolanaNetwork.MAINNET:
      return "Mainnet";
    default:
      return "Unknown Network";
  }
}

/**
 * Get network badge color
 */
export function getNetworkBadgeColor(network?: SolanaNetwork): string {
  const net = network || detectSolanaNetwork();

  switch (net) {
    case SolanaNetwork.LOCALHOST:
      return "#4CAF50"; // Green
    case SolanaNetwork.DEVNET:
      return "#2196F3"; // Blue
    case SolanaNetwork.TESTNET:
      return "#FF9800"; // Orange
    case SolanaNetwork.MAINNET:
      return "#F44336"; // Red
    default:
      return "#9E9E9E"; // Gray
  }
}
