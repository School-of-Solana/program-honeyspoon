/**
 * BettingCard Component
 *
 * Displays the betting interface when not in a game:
 * - Wallet balance
 * - Bet amount
 * - Start game button
 * - Sound toggle
 * - Game info (house edge, survival chance)
 */

import { GAME_COLORS } from "@/lib/gameColors";
import { GAME_CONFIG } from "@/lib/constants";
import type { SoundType } from "@/lib/sounds";

interface BettingCardProps {
  userBalance: number;
  betAmount: number;
  isLoadingWallet: boolean;
  isLoading: boolean;
  soundMuted: boolean;
  gameConfig: any; // Using any to match the hook's return type
  onStartGame: () => void;
  onRefreshBalance: () => Promise<void>;
  onToggleSound: () => void;
  onPlaySound: (sound: SoundType) => void;
}

export function BettingCard({
  userBalance,
  betAmount,
  isLoadingWallet,
  isLoading,
  soundMuted,
  gameConfig,
  onStartGame,
  onRefreshBalance,
  onToggleSound,
  onPlaySound,
}: BettingCardProps) {
  const hasInsufficientBalance = !isLoadingWallet && betAmount > userBalance;

  return (
    <div className="absolute top-20 right-8 z-50 transition-all duration-500 opacity-100 translate-y-0">
      <div
        className="nes-container is-dark with-title"
        style={{
          width: "400px",
          backgroundColor: GAME_COLORS.BACKGROUND_DARK,
        }}
      >
        <p className="title" style={{ fontSize: "12px" }}>
          ABYSS FORTUNE
        </p>

        {/* Sound Mute Button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={onToggleSound}
            className={`nes-btn ${soundMuted ? "is-error" : "is-success"}`}
            style={{ padding: "4px 8px", fontSize: "8px" }}
            title="Toggle sound"
          >
            {soundMuted ? "🔇 MUTED" : "🔊 SOUND"}
          </button>
        </div>

        {/* Wallet Balance */}
        <div
          className="nes-container is-rounded mb-4"
          style={{
            backgroundColor: GAME_COLORS.TREASURE_GOLD,
            color: "#000",
          }}
        >
          <div className="flex justify-between items-center">
            <span style={{ fontSize: "10px" }}>BALANCE</span>
            <div className="flex items-center gap-2">
              <span style={{ fontSize: "16px", fontWeight: "bold" }}>
                {isLoadingWallet ? "..." : `${userBalance.toFixed(3)} SOL`}
              </span>
              <button
                className="nes-btn is-primary"
                style={{
                  padding: "4px 10px",
                  fontSize: "16px",
                  minHeight: "28px",
                  lineHeight: "1",
                }}
                onClick={onRefreshBalance}
                disabled={isLoading}
                title="Refresh balance"
              >
                {isLoading ? "..." : "↻"}
              </button>
            </div>
          </div>
        </div>

        {/* Bet Amount */}
        <div
          className="nes-container is-rounded mb-4"
          style={{
            backgroundColor: GAME_COLORS.SUCCESS,
            color: "#000",
          }}
        >
          <div className="text-center">
            <p style={{ fontSize: "8px", marginBottom: "8px" }}>
              WAGER PER DIVE
            </p>
            <p style={{ fontSize: "24px", fontWeight: "bold" }}>
              {betAmount} SOL
            </p>
          </div>
        </div>

        {/* Start Button */}
        <button
          onClick={() => {
            onPlaySound("BUTTON_CLICK");
            onStartGame();
          }}
          disabled={isLoadingWallet || hasInsufficientBalance}
          className={`nes-btn ${isLoadingWallet || hasInsufficientBalance ? "is-disabled" : "is-success"} w-full mb-4`}
          style={{ fontSize: "12px" }}
        >
          {isLoadingWallet
            ? "Loading balance..."
            : `START GAME (${betAmount} SOL)`}
        </button>

        {/* Error Message */}
        {hasInsufficientBalance && (
          <div className="nes-container is-rounded is-error mb-4">
            <p style={{ fontSize: "8px", textAlign: "center" }}>
              Need {betAmount} SOL, have {userBalance.toFixed(4)} SOL
            </p>
          </div>
        )}

        {/* Info */}
        <p style={{ fontSize: "8px", textAlign: "center", color: "#aaa" }}>
          {gameConfig
            ? `${(gameConfig.houseEdge * 100).toFixed(0)}% House Edge - ${(gameConfig.baseWinProbability * 100).toFixed(0)}% Start Chance`
            : `${(GAME_CONFIG.HOUSE_EDGE * 100).toFixed(0)}% House Edge - Loading config...`}
        </p>
      </div>
    </div>
  );
}
