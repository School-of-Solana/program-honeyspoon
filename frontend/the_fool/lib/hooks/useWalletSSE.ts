/**
 * useWalletSSE - Server-Sent Events hook for real-time wallet updates
 * 
 * Replaces polling with push-based updates from the server.
 * Automatically reconnects on connection loss.
 * 
 * @param userId - User wallet address to subscribe to
 * @returns Wallet data and connection status
 */

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

export interface WalletSSEData {
  userBalance: number;
  houseVaultBalance: number;
  houseVaultReserved: number;
  timestamp: number;
}

export interface UseWalletSSEResult {
  data: WalletSSEData | null;
  isConnected: boolean;
  error: string | null;
  reconnect: () => void;
}

export function useWalletSSE(userId: string | null): UseWalletSSEResult {
  const [data, setData] = useState<WalletSSEData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      console.log('[SSE Hook] Closing existing connection');
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!userId) {
      console.log('[SSE Hook] No userId, skipping connection');
      return;
    }

    // Clean up any existing connection
    cleanup();

    const url = `/api/wallet-events?userId=${encodeURIComponent(userId)}`;
    console.log('[SSE Hook] 🔌 Connecting to SSE:', url);

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('[SSE Hook] ✅ Connected to wallet events stream');
      setIsConnected(true);
      setError(null);
      reconnectAttemptsRef.current = 0; // Reset reconnect counter on success
    };

    eventSource.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('[SSE Hook] 📨 Received message:', message);

        if (message.type === 'connected') {
          console.log('[SSE Hook] 🎉 Connection established at', new Date(message.timestamp).toISOString());
        } else if (message.type === 'balance-update') {
          console.log('[SSE Hook] 💰 Balance update received:', {
            userBalance: message.userBalance,
            houseVaultBalance: message.houseVaultBalance,
            houseVaultReserved: message.houseVaultReserved,
          });
          setData({
            userBalance: message.userBalance ?? 0,
            houseVaultBalance: message.houseVaultBalance ?? 0,
            houseVaultReserved: message.houseVaultReserved ?? 0,
            timestamp: message.timestamp,
          });
        }
      } catch (error) {
        console.error('[SSE Hook] Failed to parse SSE message:', error);
      }
    };

    eventSource.onerror = (err) => {
      console.error('[SSE Hook] ❌ SSE connection error:', err);
      setIsConnected(false);
      
      // Exponential backoff for reconnection
      reconnectAttemptsRef.current++;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
      
      console.log(`[SSE Hook] 🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
      setError(`Connection lost. Reconnecting in ${delay / 1000}s...`);
      
      cleanup();
      
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log('[SSE Hook] Attempting reconnection...');
        connect();
      }, delay);
    };
  }, [userId, cleanup]);

  // Connect on mount and when userId changes
  useEffect(() => {
    if (userId) {
      connect();
    }

    return () => {
      console.log('[SSE Hook] 🧹 Cleaning up SSE connection');
      cleanup();
    };
  }, [userId, connect, cleanup]);

  const reconnect = useCallback(() => {
    console.log('[SSE Hook] Manual reconnect requested');
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  return {
    data,
    isConnected,
    error,
    reconnect,
  };
}
