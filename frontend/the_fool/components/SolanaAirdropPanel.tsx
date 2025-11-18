'use client';

/**
 * Solana Airdrop Panel
 * 
 * Shows network information and allows airdrops on localhost/devnet
 * when a Solana wallet is connected.
 */

import { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { GAME_COLORS } from '@/lib/gameColors';
import { airdropSol } from '@/app/actions/walletActions';
import { useChainWalletStore } from '@/lib/chainWalletStore';
import { 
  detectSolanaNetwork, 
  canAirdrop, 
  getNetworkDisplayName,
  getNetworkBadgeColor,
  SolanaNetwork 
} from '@/lib/utils/networkDetection';

export function SolanaAirdropPanel() {
  // Check if we're using Solana mode
  const useSolana = process.env.NEXT_PUBLIC_USE_SOLANA === 'true';
  
  // Don't show if not using Solana
  if (!useSolana) {
    return null;
  }

  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  
  // Get balances from Zustand store (updated via SSE)
  const userBalance = useChainWalletStore((state) => state.userBalance);
  const houseVaultBalance = useChainWalletStore((state) => state.houseVaultBalance);
  const isSSEConnected = useChainWalletStore((state) => state.isSSEConnected);
  
  const [isOpen, setIsOpen] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [houseBalance, setHouseBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHouse, setIsLoadingHouse] = useState(false);
  const [isAirdropping, setIsAirdropping] = useState(false);
  const [isAirdroppingHouse, setIsAirdroppingHouse] = useState(false);
  const [airdropAmount, setAirdropAmount] = useState('1');
  const [houseAirdropAmount, setHouseAirdropAmount] = useState('100');
  const [message, setMessage] = useState('');
  const [houseMessage, setHouseMessage] = useState('');

  // Sync user balance from store (SSE updates)
  useEffect(() => {
    if (connected && publicKey) {
      setBalance(userBalance);
    }
  }, [userBalance, connected, publicKey]);

  // Sync house balance from store (SSE updates)
  useEffect(() => {
    setHouseBalance(houseVaultBalance);
  }, [houseVaultBalance]);
  
  // Detect network
  const network = detectSolanaNetwork();
  const networkName = getNetworkDisplayName(network);
  const networkColor = getNetworkBadgeColor(network);
  const airdropAllowed = canAirdrop(network);

  // Note: Balance fetching is now handled by SSE in the Zustand store
  // This component just displays the values from the store
  // SSE provides real-time updates, no polling needed!

  // Handle airdrop
  const handleAirdrop = async () => {
    if (!publicKey) {
      console.warn('[AIRDROP PANEL] ❌ No public key available');
      return;
    }

    console.log('[AIRDROP PANEL] 🚀 Starting airdrop request...', {
      wallet: publicKey.toBase58(),
      amount: airdropAmount,
      network: networkName,
    });

    setIsAirdropping(true);
    setMessage('');

    try {
      const amount = parseFloat(airdropAmount);
      if (isNaN(amount) || amount <= 0) {
        console.warn('[AIRDROP PANEL] ❌ Invalid amount:', airdropAmount);
        setMessage('❌ Invalid amount');
        setIsAirdropping(false);
        return;
      }

      console.log('[AIRDROP PANEL] 📤 Calling airdropSol server action...', {
        wallet: publicKey.toBase58(),
        amount,
      });

      const result = await airdropSol(publicKey.toBase58(), amount);

      console.log('[AIRDROP PANEL] 📥 Received airdrop result:', result);

      if (result.success) {
        console.log('[AIRDROP PANEL] ✅ Airdrop successful!', {
          signature: result.signature,
          newBalance: result.newBalance,
        });
        setMessage(`✅ Airdropped ${amount} SOL!`);
        // Update balance
        if (result.newBalance !== undefined) {
          setBalance(result.newBalance);
          console.log('[AIRDROP PANEL] 💰 Balance updated to:', result.newBalance);
        }
      } else {
        console.error('[AIRDROP PANEL] ❌ Airdrop failed:', result.error);
        setMessage(`❌ ${result.error}`);
      }
    } catch (error) {
      console.error('[AIRDROP PANEL] ❌ Exception during airdrop:', error);
      setMessage(`❌ Failed: ${error}`);
    } finally {
      setIsAirdropping(false);
      console.log('[AIRDROP PANEL] 🏁 Airdrop process completed');
      // Clear message after 5 seconds
      setTimeout(() => setMessage(''), 5000);
    }
  };

  // Handle house airdrop
  const handleHouseAirdrop = async () => {
    const houseAuthority = process.env.NEXT_PUBLIC_HOUSE_AUTHORITY;
    if (!houseAuthority) {
      console.warn('[AIRDROP PANEL] ❌ No house authority configured');
      return;
    }

    console.log('[AIRDROP PANEL] 🚀 Starting house airdrop request...', {
      wallet: houseAuthority,
      amount: houseAirdropAmount,
      network: networkName,
    });

    setIsAirdroppingHouse(true);
    setHouseMessage('');

    try {
      const amount = parseFloat(houseAirdropAmount);
      if (isNaN(amount) || amount <= 0) {
        console.warn('[AIRDROP PANEL] ❌ Invalid house airdrop amount:', houseAirdropAmount);
        setHouseMessage('❌ Invalid amount');
        setIsAirdroppingHouse(false);
        return;
      }

      console.log('[AIRDROP PANEL] 📤 Calling airdropSol for house wallet...', {
        wallet: houseAuthority,
        amount,
      });

      const result = await airdropSol(houseAuthority, amount);

      console.log('[AIRDROP PANEL] 📥 Received house airdrop result:', result);

      if (result.success) {
        console.log('[AIRDROP PANEL] ✅ House airdrop successful!', {
          signature: result.signature,
          newBalance: result.newBalance,
        });
        setHouseMessage(`✅ Airdropped ${amount} SOL to house!`);
        // Update balance
        if (result.newBalance !== undefined) {
          setHouseBalance(result.newBalance);
          console.log('[AIRDROP PANEL] 🏦 House balance updated to:', result.newBalance);
        }
      } else {
        console.error('[AIRDROP PANEL] ❌ House airdrop failed:', result.error);
        setHouseMessage(`❌ ${result.error}`);
      }
    } catch (error) {
      console.error('[AIRDROP PANEL] ❌ Exception during house airdrop:', error);
      setHouseMessage(`❌ Failed: ${error}`);
    } finally {
      setIsAirdroppingHouse(false);
      console.log('[AIRDROP PANEL] 🏁 House airdrop process completed');
      // Clear message after 5 seconds
      setTimeout(() => setHouseMessage(''), 5000);
    }
  };

  // Don't show button if not connected
  if (!connected) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 left-4 z-50"
      style={{
        maxWidth: '400px',
      }}
    >
      {/* Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="nes-btn is-primary"
          style={{
            fontSize: '10px',
            padding: '12px 16px',
          }}
        >
          🌐 NETWORK
        </button>
      )}

      {/* Panel */}
      {isOpen && (
        <div
          className="nes-container is-dark with-title"
          style={{
            backgroundColor: GAME_COLORS.BACKGROUND_DARKER,
            fontSize: '8px',
          }}
        >
          <p className="title" style={{ fontSize: '10px' }}>
            🌐 NETWORK INFO
          </p>

          {/* Close Button */}
          <button
            onClick={() => setIsOpen(false)}
            className="nes-btn is-error"
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              fontSize: '8px',
              padding: '4px 8px',
            }}
          >
            ✕
          </button>

          {/* Network Badge */}
          <div
            className="nes-container is-rounded"
            style={{ 
              marginBottom: '12px',
              backgroundColor: networkColor + '20',
              borderColor: networkColor,
            }}
          >
            <div style={{ marginBottom: '8px' }}>
              <strong>Network:</strong>{' '}
              <span style={{ color: networkColor, fontWeight: 'bold' }}>
                {networkName}
              </span>
            </div>
            <div style={{ fontSize: '7px', opacity: 0.7, marginBottom: '4px' }}>
              {network === SolanaNetwork.MAINNET && '⚠️ Using real SOL!'}
              {network === SolanaNetwork.LOCALHOST && '🔧 Local test network'}
              {network === SolanaNetwork.DEVNET && '🧪 Solana Devnet'}
              {network === SolanaNetwork.TESTNET && '🧪 Solana Testnet'}
            </div>
            <div style={{ fontSize: '7px', opacity: 0.7, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ 
                display: 'inline-block',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: isSSEConnected ? '#4CAF50' : '#FF5722',
              }} />
              {isSSEConnected ? '🟢 Real-time updates active' : '🔴 Polling fallback mode'}
            </div>
          </div>

          {/* User Wallet Balance */}
          <div
            className="nes-container is-rounded"
            style={{ marginBottom: '12px' }}
          >
            <div style={{ marginBottom: '8px' }}>
              <strong>💰 YOUR WALLET</strong>
            </div>
            {publicKey && (
              <>
                <div
                  style={{
                    marginBottom: '4px',
                    fontSize: '7px',
                    opacity: 0.7,
                    wordBreak: 'break-all',
                  }}
                >
                  {publicKey.toBase58().substring(0, 20)}...
                </div>
                <div
                  style={{
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: GAME_COLORS.TREASURE_GOLD,
                  }}
                >
                  {isLoading ? 'Loading...' : `${balance?.toFixed(4) || '0.0000'} SOL`}
                </div>
              </>
            )}
          </div>

          {/* House Wallet Balance */}
          <div
            className="nes-container is-rounded"
            style={{ marginBottom: '12px', backgroundColor: 'rgba(76, 175, 80, 0.1)' }}
          >
            <div style={{ marginBottom: '8px' }}>
              <strong>🏦 HOUSE WALLET</strong>
            </div>
            {process.env.NEXT_PUBLIC_HOUSE_AUTHORITY && (
              <>
                <div
                  style={{
                    marginBottom: '4px',
                    fontSize: '7px',
                    opacity: 0.7,
                    wordBreak: 'break-all',
                  }}
                >
                  {process.env.NEXT_PUBLIC_HOUSE_AUTHORITY.substring(0, 20)}...
                </div>
                <div
                  style={{
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: '#4CAF50',
                  }}
                >
                  {isLoadingHouse ? 'Loading...' : `${houseBalance?.toFixed(4) || '0.0000'} SOL`}
                </div>
              </>
            )}
          </div>

          {/* User Airdrop Section (only if allowed) */}
          {airdropAllowed && (
            <div
              className="nes-container is-rounded"
              style={{
                marginBottom: '12px',
                backgroundColor: 'rgba(33, 150, 243, 0.1)',
              }}
            >
              <div style={{ marginBottom: '8px' }}>
                <strong>💧 AIRDROP TO YOUR WALLET</strong>
              </div>

              {/* Amount Input */}
              <div style={{ marginBottom: '8px' }}>
                <label style={{ fontSize: '8px', opacity: 0.7 }}>
                  Amount (SOL):
                </label>
                <input
                  type="number"
                  className="nes-input"
                  value={airdropAmount}
                  onChange={(e) => setAirdropAmount(e.target.value)}
                  disabled={isAirdropping}
                  min="0.1"
                  max="5"
                  step="0.5"
                  style={{
                    fontSize: '10px',
                    padding: '4px',
                    marginTop: '4px',
                  }}
                />
              </div>

              {/* Airdrop Button */}
              <button
                onClick={handleAirdrop}
                disabled={isAirdropping || !publicKey}
                className={`nes-btn ${isAirdropping || !publicKey ? 'is-disabled' : 'is-primary'} w-full`}
                style={{ fontSize: '8px', padding: '8px', marginBottom: '8px' }}
              >
                {isAirdropping ? '💧 REQUESTING...' : '💧 REQUEST AIRDROP'}
              </button>

              {/* Message */}
              {message && (
                <div
                  style={{
                    fontSize: '7px',
                    textAlign: 'center',
                    padding: '4px',
                    wordBreak: 'break-word',
                  }}
                >
                  {message}
                </div>
              )}

              <div
                style={{
                  fontSize: '6px',
                  opacity: 0.5,
                  textAlign: 'center',
                  marginTop: '4px',
                }}
              >
                Free SOL for testing (max 5 SOL per request)
              </div>
            </div>
          )}

          {/* House Airdrop Section (only if allowed) */}
          {airdropAllowed && (
            <div
              className="nes-container is-rounded"
              style={{
                marginBottom: '12px',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
              }}
            >
              <div style={{ marginBottom: '8px' }}>
                <strong>💧 AIRDROP TO HOUSE WALLET</strong>
              </div>

              {/* Amount Input */}
              <div style={{ marginBottom: '8px' }}>
                <label style={{ fontSize: '8px', opacity: 0.7 }}>
                  Amount (SOL):
                </label>
                <input
                  type="number"
                  className="nes-input"
                  value={houseAirdropAmount}
                  onChange={(e) => setHouseAirdropAmount(e.target.value)}
                  disabled={isAirdroppingHouse}
                  min="1"
                  max="1000"
                  step="10"
                  style={{
                    fontSize: '10px',
                    padding: '4px',
                    marginTop: '4px',
                  }}
                />
              </div>

              {/* Airdrop Button */}
              <button
                onClick={handleHouseAirdrop}
                disabled={isAirdroppingHouse}
                className={`nes-btn ${isAirdroppingHouse ? 'is-disabled' : 'is-success'} w-full`}
                style={{ fontSize: '8px', padding: '8px', marginBottom: '8px' }}
              >
                {isAirdroppingHouse ? '💧 REQUESTING...' : '💧 FUND HOUSE'}
              </button>

              {/* Message */}
              {houseMessage && (
                <div
                  style={{
                    fontSize: '7px',
                    textAlign: 'center',
                    padding: '4px',
                    wordBreak: 'break-word',
                  }}
                >
                  {houseMessage}
                </div>
              )}

              <div
                style={{
                  fontSize: '6px',
                  opacity: 0.5,
                  textAlign: 'center',
                  marginTop: '4px',
                }}
              >
                Fund the house to enable larger payouts (max 1000 SOL per request)
              </div>
            </div>
          )}

          {/* Airdrop Not Available Message */}
          {!airdropAllowed && (
            <div
              className="nes-container is-rounded"
              style={{
                marginBottom: '12px',
                backgroundColor: 'rgba(244, 67, 54, 0.1)',
              }}
            >
              <div style={{ fontSize: '7px', textAlign: 'center' }}>
                ⚠️ Airdrops are only available on Localhost and Devnet networks.
              </div>
            </div>
          )}

          {/* Info */}
          <div
            style={{
              marginTop: '12px',
              fontSize: '6px',
              opacity: 0.5,
              textAlign: 'center',
            }}
          >
            Balance updates automatically every 5 seconds.
          </div>
        </div>
      )}
    </div>
  );
}
