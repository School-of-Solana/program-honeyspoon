'use client';

import { useEffect, useState } from 'react';
import { Connection } from '@solana/web3.js';

/**
 * Banner that shows Solana connection status
 * Warns users if localnet is not running when in Solana mode
 */
export function SolanaStatusBanner() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  
  const useSolana = process.env.NEXT_PUBLIC_USE_SOLANA === 'true';
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:8899';
  
  useEffect(() => {
    if (!useSolana) {
      setChecking(false);
      return;
    }
    
    let mounted = true;
    
    async function checkConnection() {
      try {
        const connection = new Connection(rpcUrl, 'confirmed');
        await connection.getVersion();
        if (mounted) {
          setConnected(true);
          setChecking(false);
        }
      } catch (error) {
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
  
  // Show error if not connected
  if (!connected) {
    return (
      <div className="fixed top-0 left-0 right-0 bg-red-600 text-white text-center py-3 text-sm z-50 shadow-lg">
        <div className="container mx-auto px-4">
          <p className="font-bold mb-1">
            ⚠️ Solana Localnet Not Running
          </p>
          <p className="text-xs opacity-90">
            Run <code className="bg-red-700 px-2 py-0.5 rounded">npm run setup</code> to start localnet, 
            or switch to Local mode in .env.local (NEXT_PUBLIC_USE_SOLANA=false)
          </p>
        </div>
      </div>
    );
  }
  
  // Show success banner (can be dismissed)
  return (
    <div className="fixed top-0 left-0 right-0 bg-green-600 text-white text-center py-2 text-xs z-50">
      ✅ Connected to Solana Localnet ({rpcUrl})
    </div>
  );
}
