'use client';

import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useGameChain } from '@/lib/hooks/useGameChain';

/**
 * Enhanced wallet button with wallet name and selector
 * 
 * Features:
 * - Shows wallet name (e.g., "Phantom") when connected
 * - Shows shortened address
 * - Click to open wallet selector modal
 * - Disconnect button when connected
 * 
 * Usage:
 * ```tsx
 * import { WalletButton } from '@/components/WalletButton';
 * 
 * function Header() {
 *   return <WalletButton />;
 * }
 * ```
 */
export function WalletButton() {
  const { connected, publicKey, wallet } = useGameChain();
  const { setVisible } = useWalletModal();

  const handleConnect = () => {
    setVisible(true);
  };

  const handleDisconnect = () => {
    wallet.disconnect?.();
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  // Get wallet name (e.g., "Phantom", "Solflare")
  const walletName = wallet.wallet?.adapter?.name || 'Unknown';

  if (connected && publicKey) {
    return (
      <div className="flex items-center gap-2">
        {/* Wallet Info Display */}
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg border border-gray-700">
          {/* Wallet Icon/Name */}
          <div className="flex items-center gap-2">
            {wallet.wallet?.adapter?.icon && (
              <img 
                src={wallet.wallet.adapter.icon} 
                alt={walletName}
                className="w-5 h-5 rounded"
              />
            )}
            <span className="text-sm font-medium text-gray-300">
              {walletName}
            </span>
          </div>
          
          {/* Divider */}
          <div className="w-px h-4 bg-gray-600" />
          
          {/* Address */}
          <span className="text-sm text-gray-400 font-mono">
            {shortenAddress(publicKey.toBase58())}
          </span>
        </div>

        {/* Change Wallet Button */}
        <button
          onClick={handleConnect}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-colors"
          title="Change wallet"
        >
          Change
        </button>

        {/* Disconnect Button */}
        <button
          onClick={handleDisconnect}
          className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg font-medium transition-colors"
          title="Disconnect wallet"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
    >
      Connect Wallet
    </button>
  );
}

/**
 * Wallet status indicator (read-only)
 * 
 * Shows wallet connection status without interaction
 */
export function WalletStatus() {
  const { connected, publicKey, connecting } = useGameChain();

  if (connecting) {
    return <div className="text-sm text-gray-500">Connecting...</div>;
  }

  if (connected && publicKey) {
    return (
      <div className="text-sm text-green-600">
        Connected: {publicKey.toBase58().slice(0, 8)}...
      </div>
    );
  }

  return <div className="text-sm text-gray-500">Not connected</div>;
}
