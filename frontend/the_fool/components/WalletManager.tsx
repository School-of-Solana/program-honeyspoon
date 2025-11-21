"use client";

/**
 * Wallet Manager Component
 *
 * Manages deposits/withdrawals between Solana wallet and Game wallet (UserAccount PDA)
 * Shows balances, stats, and provides deposit/withdraw functionality
 *
 * TODO: This component is ready but requires program changes first:
 * - Add UserAccount PDA to program
 * - Add deposit() and withdraw() instructions
 * - Modify start_session() to use UserAccount
 */

import { useState, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { GAME_COLORS } from "@/lib/gameColors";

// TODO: Replace with actual server actions once program is updated
// import { depositToGameWallet, withdrawFromGameWallet, getUserAccount } from '@/app/actions/walletActions';

interface UserAccountData {
  owner: string;
  balance: number;
  totalDeposited: number;
  totalWithdrawn: number;
  totalWagered: number;
  totalWon: number;
  gamesPlayed: number;
}

export function WalletManager() {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();

  const [isOpen, setIsOpen] = useState(false);
  const [solanaBalance, setSolanaBalance] = useState<number>(0);
  const [gameWalletData, setGameWalletData] = useState<UserAccountData | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [amount, setAmount] = useState("1.0");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");

  // Fetch balances
  useEffect(() => {
    if (!connected || !publicKey) {
      return;
    }
    const fetchBalances = async () => {
      if (!publicKey) return;

      setIsLoading(true);
      try {
        // Fetch Solana wallet balance
        const balance = await connection.getBalance(publicKey);
        setSolanaBalance(balance / LAMPORTS_PER_SOL);

        // TODO: Fetch UserAccount PDA balance from program
        // const userAccountData = await getUserAccount(publicKey.toBase58());
        // setGameWalletData(userAccountData);

        // Mock data for now
        setGameWalletData({
          owner: publicKey.toBase58(),
          balance: 1.5,
          totalDeposited: 10,
          totalWithdrawn: 8,
          totalWagered: 8.5,
          totalWon: 9.2,
          gamesPlayed: 47,
        });
      } catch (_error) {
        console.error("[WALLET MANAGER] Failed to fetch balances:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBalances();
  }, [publicKey, connection, connected]);

  // Don't show if not connected
  if (!connected || !publicKey) {
    return null;
  }

  // Handle deposit
  const handleDeposit = async () => {
    if (!publicKey) return;

    setIsProcessing(true);
    setMessage("");

    try {
      const depositAmount = parseFloat(amount);
      if (isNaN(depositAmount) || depositAmount <= 0) {
        setMessage("ERROR: Invalid amount");
        setIsProcessing(false);
        return;
      }

      if (depositAmount > solanaBalance) {
        setMessage("ERROR: Insufficient Solana wallet balance");
        setIsProcessing(false);
        return;
      }

      // TODO: Call deposit instruction
      // const result = await depositToGameWallet(publicKey.toBase58(), depositAmount);

      setMessage(`OK: Deposited ${depositAmount} SOL to game wallet!`);

      // Refresh balances
      // await fetchBalances();
    } catch (_error) {
      setMessage(`ERROR: Deposit failed: ${error}`);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setMessage(""), 5000);
    }
  };

  // Handle withdraw
  const handleWithdraw = async () => {
    if (!publicKey || !gameWalletData) return;

    setIsProcessing(true);
    setMessage("");

    try {
      const withdrawAmount = parseFloat(amount);
      if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
        setMessage("ERROR: Invalid amount");
        setIsProcessing(false);
        return;
      }

      if (withdrawAmount > gameWalletData.balance) {
        setMessage("ERROR: Insufficient game wallet balance");
        setIsProcessing(false);
        return;
      }

      // TODO: Call withdraw instruction
      // const result = await withdrawFromGameWallet(publicKey.toBase58(), withdrawAmount);

      setMessage(`OK: Withdrew ${withdrawAmount} SOL to Solana wallet!`);

      // Refresh balances
      // await fetchBalances();
    } catch (_error) {
      setMessage(`ERROR: Withdraw failed: ${error}`);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setMessage(""), 5000);
    }
  };

  // Calculate net profit
  const netProfit = gameWalletData
    ? gameWalletData.totalWon - gameWalletData.totalWagered
    : 0;
  const isProfit = netProfit >= 0;

  return (
    <div className="fixed bottom-4 right-20 z-50">
      {/* Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="nes-btn is-primary"
          style={{
            fontSize: "10px",
            padding: "12px 16px",
          }}
        >
          Amount: WALLET
        </button>
      )}

      {/* Panel */}
      {isOpen && (
        <div
          className="nes-container is-dark with-title"
          style={{
            backgroundColor: GAME_COLORS.BACKGROUND_DARKER,
            fontSize: "8px",
            width: "400px",
          }}
        >
          <p className="title" style={{ fontSize: "10px" }}>
            Amount: WALLET MANAGER
          </p>

          {/* Close Button */}
          <button
            onClick={() => setIsOpen(false)}
            className="nes-btn is-error"
            style={{
              position: "absolute",
              top: "8px",
              right: "8px",
              fontSize: "8px",
              padding: "4px 8px",
            }}
          >
            ✕
          </button>

          {isLoading ? (
            <div style={{ textAlign: "center", padding: "20px" }}>
              Loading...
            </div>
          ) : (
            <>
              {/* Balances */}
              <div style={{ marginBottom: "16px" }}>
                {/* Solana Wallet Balance */}
                <div
                  className="nes-container is-rounded"
                  style={{
                    marginBottom: "8px",
                    backgroundColor: "rgba(76, 175, 80, 0.1)",
                  }}
                >
                  <div
                    style={{
                      marginBottom: "4px",
                      fontSize: "8px",
                      opacity: 0.7,
                    }}
                  >
                    Solana Wallet
                  </div>
                  <div
                    style={{
                      fontSize: "20px",
                      fontWeight: "bold",
                      color: GAME_COLORS.SUCCESS,
                    }}
                  >
                    {solanaBalance.toFixed(4)} SOL
                  </div>
                </div>

                {/* Game Wallet Balance */}
                <div
                  className="nes-container is-rounded"
                  style={{ backgroundColor: "rgba(255, 193, 7, 0.1)" }}
                >
                  <div
                    style={{
                      marginBottom: "4px",
                      fontSize: "8px",
                      opacity: 0.7,
                    }}
                  >
                    Game Wallet
                  </div>
                  <div
                    style={{
                      fontSize: "20px",
                      fontWeight: "bold",
                      color: GAME_COLORS.TREASURE_GOLD,
                    }}
                  >
                    {gameWalletData?.balance.toFixed(4) || "0.0000"} SOL
                  </div>
                </div>
              </div>

              {/* Mode Tabs */}
              <div
                style={{ marginBottom: "12px", display: "flex", gap: "8px" }}
              >
                <button
                  onClick={() => setMode("deposit")}
                  className={`nes-btn ${mode === "deposit" ? "is-primary" : ""}`}
                  style={{ fontSize: "8px", padding: "8px", flex: 1 }}
                >
                  ⬇️ DEPOSIT
                </button>
                <button
                  onClick={() => setMode("withdraw")}
                  className={`nes-btn ${mode === "withdraw" ? "is-success" : ""}`}
                  style={{ fontSize: "8px", padding: "8px", flex: 1 }}
                >
                  ⬆️ WITHDRAW
                </button>
              </div>

              {/* Amount Input */}
              <div style={{ marginBottom: "12px" }}>
                <label
                  style={{
                    fontSize: "8px",
                    opacity: 0.7,
                    display: "block",
                    marginBottom: "4px",
                  }}
                >
                  Amount (SOL):
                </label>
                <input
                  type="number"
                  className="nes-input"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={isProcessing}
                  min="0.01"
                  step="0.1"
                  style={{
                    fontSize: "10px",
                    padding: "8px",
                  }}
                />
                <div
                  style={{ marginTop: "4px", fontSize: "7px", opacity: 0.6 }}
                >
                  {mode === "deposit"
                    ? `Max: ${solanaBalance.toFixed(4)} SOL`
                    : `Max: ${gameWalletData?.balance.toFixed(4) || "0.0000"} SOL`}
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={mode === "deposit" ? handleDeposit : handleWithdraw}
                disabled={isProcessing}
                className={`nes-btn ${isProcessing ? "is-disabled" : mode === "deposit" ? "is-primary" : "is-success"} w-full`}
                style={{
                  fontSize: "10px",
                  padding: "12px",
                  marginBottom: "12px",
                }}
              >
                {isProcessing
                  ? "PROCESSING..."
                  : mode === "deposit"
                    ? "⬇️ DEPOSIT TO GAME"
                    : "⬆️ WITHDRAW TO SOLANA"}
              </button>

              {/* Message */}
              {message && (
                <div
                  style={{
                    fontSize: "7px",
                    textAlign: "center",
                    padding: "8px",
                    marginBottom: "12px",
                    backgroundColor: message.includes("ERROR:")
                      ? "rgba(244, 67, 54, 0.2)"
                      : "rgba(76, 175, 80, 0.2)",
                  }}
                >
                  {message}
                </div>
              )}

              {/* Stats */}
              {gameWalletData && (
                <div
                  className="nes-container is-rounded"
                  style={{
                    fontSize: "7px",
                    backgroundColor: "rgba(33, 150, 243, 0.1)",
                  }}
                >
                  <div
                    style={{
                      marginBottom: "6px",
                      fontSize: "8px",
                      fontWeight: "bold",
                    }}
                  >
                    Info: STATISTICS
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "4px",
                    }}
                  >
                    <div>
                      <div style={{ opacity: 0.6 }}>Deposited:</div>
                      <div style={{ fontWeight: "bold" }}>
                        {gameWalletData.totalDeposited.toFixed(2)} SOL
                      </div>
                    </div>
                    <div>
                      <div style={{ opacity: 0.6 }}>Withdrawn:</div>
                      <div style={{ fontWeight: "bold" }}>
                        {gameWalletData.totalWithdrawn.toFixed(2)} SOL
                      </div>
                    </div>
                    <div>
                      <div style={{ opacity: 0.6 }}>Wagered:</div>
                      <div style={{ fontWeight: "bold" }}>
                        {gameWalletData.totalWagered.toFixed(2)} SOL
                      </div>
                    </div>
                    <div>
                      <div style={{ opacity: 0.6 }}>Won:</div>
                      <div style={{ fontWeight: "bold" }}>
                        {gameWalletData.totalWon.toFixed(2)} SOL
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: "8px",
                      paddingTop: "8px",
                      borderTop: "1px solid rgba(255,255,255,0.2)",
                    }}
                  >
                    <div style={{ opacity: 0.6 }}>Net Profit/Loss:</div>
                    <div
                      style={{
                        fontSize: "16px",
                        fontWeight: "bold",
                        color: isProfit
                          ? GAME_COLORS.SUCCESS
                          : GAME_COLORS.DANGER,
                      }}
                    >
                      {isProfit ? "+" : ""}
                      {netProfit.toFixed(4)} SOL {isProfit ? "OK:" : "ERROR:"}
                    </div>
                  </div>

                  <div style={{ marginTop: "4px", opacity: 0.6 }}>
                    Games Played: {gameWalletData.gamesPlayed}
                  </div>
                </div>
              )}

              {/* Warning */}
              <div
                style={{
                  marginTop: "12px",
                  fontSize: "6px",
                  opacity: 0.5,
                  textAlign: "center",
                }}
              >
                WARNING: Keep some SOL in your Solana wallet for transaction
                fees
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
