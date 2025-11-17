'use client';

import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useGameChain } from '@/lib/hooks/useGameChain';

/**
 * Simple wallet connect/disconnect button
 * 
 * Shows:
 * - "Connect Wallet" when disconnected
 * - Shortened address when connected
 * - Click to open wallet modal or disconnect
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

  const handleClick = () => {
    if (connected) {
      wallet.disconnect?.();
    } else {
      setVisible(true);
    }
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <button
      onClick={handleClick}
      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
    >
      {connected && publicKey ? (
        <>
          {shortenAddress(publicKey.toBase58())}
          <span className="ml-2 text-xs opacity-75">(click to disconnect)</span>
        </>
      ) : (
        'Connect Wallet'
      )}
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
