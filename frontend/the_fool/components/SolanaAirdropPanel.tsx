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
  
  const [isOpen, setIsOpen] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAirdropping, setIsAirdropping] = useState(false);
  const [airdropAmount, setAirdropAmount] = useState('1');
  const [message, setMessage] = useState('');
  
  // Detect network
  const network = detectSolanaNetwork();
  const networkName = getNetworkDisplayName(network);
  const networkColor = getNetworkBadgeColor(network);
  const airdropAllowed = canAirdrop(network);

  // Fetch balance when connected
  useEffect(() => {
    if (!connected || !publicKey) {
      setBalance(null);
      return;
    }

    const fetchBalance = async () => {
      setIsLoading(true);
      try {
        const bal = await connection.getBalance(publicKey);
        setBalance(bal / LAMPORTS_PER_SOL);
      } catch (error) {
        console.error('[AIRDROP] Failed to fetch balance:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBalance();

    // Poll balance every 5 seconds
    const interval = setInterval(fetchBalance, 5000);
    return () => clearInterval(interval);
  }, [connected, publicKey, connection]);

  // Handle airdrop
  const handleAirdrop = async () => {
    if (!publicKey) return;

    setIsAirdropping(true);
    setMessage('');

    try {
      const amount = parseFloat(airdropAmount);
      if (isNaN(amount) || amount <= 0) {
        setMessage('❌ Invalid amount');
        setIsAirdropping(false);
        return;
      }

      const result = await airdropSol(publicKey.toBase58(), amount);

      if (result.success) {
        setMessage(`✅ Airdropped ${amount} SOL!`);
        // Update balance
        if (result.newBalance !== undefined) {
          setBalance(result.newBalance);
        }
      } else {
        setMessage(`❌ ${result.error}`);
      }
    } catch (error) {
      setMessage(`❌ Failed: ${error}`);
    } finally {
      setIsAirdropping(false);
      // Clear message after 5 seconds
      setTimeout(() => setMessage(''), 5000);
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
            <div style={{ fontSize: '7px', opacity: 0.7 }}>
              {network === SolanaNetwork.MAINNET && '⚠️ Using real SOL!'}
              {network === SolanaNetwork.LOCALHOST && '🔧 Local test network'}
              {network === SolanaNetwork.DEVNET && '🧪 Solana Devnet'}
              {network === SolanaNetwork.TESTNET && '🧪 Solana Testnet'}
            </div>
          </div>

          {/* Wallet Balance */}
          <div
            className="nes-container is-rounded"
            style={{ marginBottom: '12px' }}
          >
            <div style={{ marginBottom: '8px' }}>
              <strong>💰 WALLET BALANCE</strong>
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

          {/* Airdrop Section (only if allowed) */}
          {airdropAllowed && (
            <div
              className="nes-container is-rounded"
              style={{
                marginBottom: '12px',
                backgroundColor: 'rgba(33, 150, 243, 0.1)',
              }}
            >
              <div style={{ marginBottom: '8px' }}>
                <strong>💧 AIRDROP SOL</strong>
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
