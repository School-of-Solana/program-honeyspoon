"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import type { WalletName } from "@solana/wallet-adapter-base";
import { WalletIcon } from "@solana/wallet-adapter-react-ui";
import { useState, useRef, useEffect } from "react";

/**
 * Multi-button wallet selector with dropdown
 *
 * Features:
 * - Shows all available wallets in dropdown
 * - Displays wallet name and icon when connected
 * - Shows address with copy button
 * - Disconnect option in dropdown
 * - Styled to match the game's aesthetic
 *
 * Usage:
 * ```tsx
 * import { WalletMultiButton } from '@/components/WalletMultiButton';
 *
 * function Header() {
 *   return <WalletMultiButton />;
 * }
 * ```
 */
export function WalletMultiButton() {
  const {
    publicKey,
    wallet,
    wallets,
    select,
    connect,
    disconnect,
    connecting,
  } = useWallet();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }

    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [dropdownOpen]);

  const handleCopyAddress = async () => {
    if (publicKey) {
      await navigator.clipboard.writeText(publicKey.toBase58());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleWalletSelect = async (walletName: WalletName) => {
    select(walletName);
    setDropdownOpen(false);
    // Connect will happen automatically via wallet adapter
  };

  const handleDisconnect = () => {
    disconnect();
    setDropdownOpen(false);
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const base =
    "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all";
  const connected = publicKey && wallet;

  if (connecting) {
    return (
      <button
        disabled
        className={`${base} bg-blue-600 text-white opacity-75 cursor-wait`}
      >
        <span className="animate-spin">⏳</span>
        Connecting...
      </button>
    );
  }

  if (connected) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className={`${base} bg-gray-800 text-white border-2 border-gray-700 hover:border-blue-500`}
        >
          {/* Wallet Icon */}
          {wallet.adapter.icon && (
            <img
              src={wallet.adapter.icon}
              alt={wallet.adapter.name}
              className="w-5 h-5 rounded"
            />
          )}

          {/* Wallet Name */}
          <span className="text-sm font-bold">{wallet.adapter.name}</span>

          {/* Address */}
          <span className="text-xs text-gray-400 font-mono">
            {shortenAddress(publicKey.toBase58())}
          </span>

          {/* Dropdown Arrow */}
          <span
            className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
          >
            ▼
          </span>
        </button>

        {/* Dropdown Menu */}
        {dropdownOpen && (
          <div className="absolute right-0 mt-2 w-64 bg-gray-800 border-2 border-gray-700 rounded-lg shadow-xl z-50">
            {/* Address Section */}
            <div className="p-3 border-b border-gray-700">
              <div className="text-xs text-gray-400 mb-1">Your Address</div>
              <div className="flex items-center gap-2">
                <code className="text-xs text-white font-mono flex-1 truncate">
                  {publicKey.toBase58()}
                </code>
                <button
                  onClick={handleCopyAddress}
                  className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded transition-colors"
                  title="Copy address"
                >
                  {copied ? "-" : "📋"}
                </button>
              </div>
            </div>

            {/* Change Wallet */}
            <div className="p-2">
              <div className="text-xs text-gray-400 px-2 py-1">
                Change Wallet
              </div>
              {wallets
                .filter((w) => w.readyState === "Installed")
                .map((w) => (
                  <button
                    key={w.adapter.name}
                    onClick={() => handleWalletSelect(w.adapter.name)}
                    className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-700 rounded transition-colors ${
                      w.adapter.name === wallet.adapter.name
                        ? "bg-gray-700"
                        : ""
                    }`}
                    disabled={w.adapter.name === wallet.adapter.name}
                  >
                    <img
                      src={w.adapter.icon}
                      alt={w.adapter.name}
                      className="w-5 h-5 rounded"
                    />
                    <span className="text-sm text-white">{w.adapter.name}</span>
                    {w.adapter.name === wallet.adapter.name && (
                      <span className="ml-auto text-green-500 text-xs">●</span>
                    )}
                  </button>
                ))}

              {wallets.filter((w) => w.readyState === "NotDetected").length >
                0 && (
                <>
                  <div className="text-xs text-gray-500 px-2 py-1 mt-2">
                    Not Installed
                  </div>
                  {wallets
                    .filter((w) => w.readyState === "NotDetected")
                    .map((w) => (
                      <a
                        key={w.adapter.name}
                        href={w.adapter.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-700 rounded transition-colors opacity-50"
                      >
                        <img
                          src={w.adapter.icon}
                          alt={w.adapter.name}
                          className="w-5 h-5 rounded grayscale"
                        />
                        <span className="text-sm text-gray-400">
                          {w.adapter.name}
                        </span>
                        <span className="ml-auto text-xs">↗</span>
                      </a>
                    ))}
                </>
              )}
            </div>

            {/* Disconnect Button */}
            <div className="p-2 border-t border-gray-700">
              <button
                onClick={handleDisconnect}
                className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
              >
                Disconnect
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Not connected - show wallet selector
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className={`${base} bg-blue-600 hover:bg-blue-700 text-white`}
      >
        <span>Link:</span>
        Connect Wallet
        <span
          className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
        >
          ▼
        </span>
      </button>

      {/* Wallet Selector Dropdown */}
      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-gray-800 border-2 border-gray-700 rounded-lg shadow-xl z-50">
          <div className="p-2">
            <div className="text-xs text-gray-400 px-2 py-2">Select Wallet</div>

            {/* Installed Wallets */}
            {wallets
              .filter((w) => w.readyState === "Installed")
              .map((w) => (
                <button
                  key={w.adapter.name}
                  onClick={() => handleWalletSelect(w.adapter.name)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-700 rounded transition-colors"
                >
                  <img
                    src={w.adapter.icon}
                    alt={w.adapter.name}
                    className="w-5 h-5 rounded"
                  />
                  <span className="text-sm text-white">{w.adapter.name}</span>
                  <span className="ml-auto text-green-500 text-xs">-</span>
                </button>
              ))}

            {/* Not Installed Wallets */}
            {wallets.filter((w) => w.readyState === "NotDetected").length >
              0 && (
              <>
                <div className="text-xs text-gray-500 px-2 py-2 mt-2 border-t border-gray-700">
                  Install Wallet
                </div>
                {wallets
                  .filter((w) => w.readyState === "NotDetected")
                  .map((w) => (
                    <a
                      key={w.adapter.name}
                      href={w.adapter.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-700 rounded transition-colors"
                    >
                      <img
                        src={w.adapter.icon}
                        alt={w.adapter.name}
                        className="w-5 h-5 rounded opacity-50"
                      />
                      <span className="text-sm text-gray-400">
                        {w.adapter.name}
                      </span>
                      <span className="ml-auto text-xs">↗</span>
                    </a>
                  ))}
              </>
            )}

            {wallets.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-gray-400">
                No wallets detected
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact wallet button for mobile/small spaces
 */
export function WalletMultiButtonCompact() {
  const { publicKey, wallet } = useWallet();

  if (publicKey && wallet) {
    return (
      <div className="flex items-center gap-1 px-2 py-1 bg-gray-800 rounded border border-gray-700">
        {wallet.adapter.icon && (
          <img
            src={wallet.adapter.icon}
            alt={wallet.adapter.name}
            className="w-4 h-4 rounded"
          />
        )}
        <span className="text-xs text-gray-400 font-mono">
          {publicKey.toBase58().slice(0, 4)}...
        </span>
      </div>
    );
  }

  return (
    <button className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded">
      Connect
    </button>
  );
}
