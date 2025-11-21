/**
 * GameHUD Component
 * 
 * Displays the in-game HUD overlay:
 * - Current treasure amount
 * - Survival chance
 * - Dive deeper / Surface buttons
 */

import { GAME_COLORS } from "@/lib/gameColors";
import type { DiveStats } from "@/lib/types";
import type { SoundType } from "@/lib/sounds";

interface GameHUDProps {
  currentTreasure: number;
  diveNumber: number;
  currentDiveStats: DiveStats;
  isProcessing: boolean;
  onDiveDeeper: () => void;
  onSurface: () => void;
  onPlaySound: (sound: SoundType) => void;
}

export function GameHUD({
  currentTreasure,
  diveNumber,
  currentDiveStats,
  isProcessing,
  onDiveDeeper,
  onSurface,
  onPlaySound,
}: GameHUDProps) {
  return (
    <div className="absolute inset-0 pointer-events-none transition-opacity duration-500 opacity-100">
      {/* Top HUD Bar - NES Style (Treasure Only) */}
      <div
        className="absolute top-20 right-4 pointer-events-auto"
        style={{ width: "180px" }}
      >
        {/* Treasure Panel */}
        <div
          className="nes-container is-dark"
          style={{
            backgroundColor: GAME_COLORS.BACKGROUND_DARKER,
            padding: "10px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontSize: "24px",
              color: GAME_COLORS.TREASURE_GOLD,
              marginBottom: "2px",
            }}
          >
            {currentTreasure} SOL
          </p>
          <p
            style={{
              fontSize: "8px",
              color: GAME_COLORS.TEXT_SECONDARY,
            }}
          >
            TREASURE
          </p>
        </div>
      </div>

      {/* Bottom: Action Buttons - NES Style */}
      <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-auto">
        <div className="max-w-4xl mx-auto">
          {/* Stats Panel - Simplified */}
          <div
            className="nes-container is-dark mb-4"
            style={{
              backgroundColor: GAME_COLORS.BACKGROUND_DARKER,
              padding: "12px 16px",
            }}
          >
            <div className="flex items-center gap-2">
              <span
                style={{
                  fontSize: "10px",
                  color: GAME_COLORS.TEXT_SECONDARY,
                }}
              >
                SURVIVAL CHANCE:
              </span>
              <span
                style={{
                  fontSize: "20px",
                  color: GAME_COLORS.SURVIVAL_GREEN,
                  fontWeight: "bold",
                }}
              >
                {(currentDiveStats.survivalProbability * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={() => {
                onPlaySound("BUTTON_CLICK");
                onDiveDeeper();
              }}
              disabled={isProcessing}
              className={`nes-btn ${isProcessing ? "is-disabled" : "is-error"} flex-1`}
              style={{ fontSize: "16px", padding: "16px" }}
            >
              {isProcessing ? "DIVING..." : "DIVE DEEPER"}
            </button>
            {diveNumber > 1 && (
              <button
                onClick={() => {
                  onPlaySound("BUTTON_CLICK");
                  onSurface();
                }}
                disabled={isProcessing}
                className={`nes-btn ${isProcessing ? "is-disabled" : "is-success"} flex-1`}
                style={{ fontSize: "16px", padding: "16px" }}
              >
                SURFACE
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
