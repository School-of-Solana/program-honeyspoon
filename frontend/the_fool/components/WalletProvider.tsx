'use client';

import { useMemo, ReactNode } from 'react';
import { 
  ConnectionProvider, 
  WalletProvider as SolanaWalletProvider 
} from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

interface WalletProviderProps {
  children: ReactNode;
}

/**
 * WalletProvider wraps the app with Solana wallet adapter
 * 
 * Features:
 * - Connects to RPC endpoint from env vars
 * - Supports Phantom wallet (add more as needed)
 * - Auto-connects to previously used wallet
 * - Provides wallet modal for connection UI
 * 
 * Usage in layout.tsx:
 * ```tsx
 * import { WalletProvider } from '@/components/WalletProvider';
 * 
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <WalletProvider>{children}</WalletProvider>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
export function WalletProvider({ children }: WalletProviderProps) {
  // Get RPC endpoint from environment
  const endpoint = process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:8899';
  
  // Determine network (for wallet auto-detection)
  const network = useMemo(() => {
    if (endpoint.includes('devnet')) return WalletAdapterNetwork.Devnet;
    if (endpoint.includes('testnet')) return WalletAdapterNetwork.Testnet;
    if (endpoint.includes('mainnet')) return WalletAdapterNetwork.Mainnet;
    return WalletAdapterNetwork.Devnet; // Default for localhost
  }, [endpoint]);
  
  // Initialize wallet adapters
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      // Add more wallets as needed:
      // new SolflareWalletAdapter(),
      // new BackpackWalletAdapter(),
    ],
    [network]
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}
