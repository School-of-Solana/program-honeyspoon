"use client";

import { useState } from "react";
import { GAME_CONFIG } from "@/lib/constants";
import type { DiveStats } from "@/lib/types";

interface GameControlsProps {
  isPlaying: boolean;
  currentTreasure: number;
  diveStats: DiveStats | null;
  onStartGame: (betAmount: number) => void;
  onDiveDeeper: () => void;
  onSurface: () => void;
  isProcessing: boolean;
}

export default function GameControls({
  isPlaying,
  currentTreasure,
  diveStats,
  onStartGame,
  onDiveDeeper,
  onSurface,
  isProcessing,
}: GameControlsProps) {
  const [betAmount, setBetAmount] = useState(100);
  const [error, setError] = useState<string>("");

  const handleBetChange = (amount: number) => {
    if (amount < GAME_CONFIG.MIN_BET) {
      setError(`Minimum bet is $${GAME_CONFIG.MIN_BET}`);
    } else if (amount > GAME_CONFIG.MAX_BET) {
      setError(`Maximum bet is $${GAME_CONFIG.MAX_BET}`);
    } else {
      setError("");
    }
    setBetAmount(amount);
  };

  const handleStartGame = () => {
    if (betAmount < GAME_CONFIG.MIN_BET || betAmount > GAME_CONFIG.MAX_BET) {
      return;
    }
    setError("");
    onStartGame(betAmount);
  };

  return (
    <div className="w-full max-w-4xl bg-gradient-to-b from-blue-900 to-blue-950 rounded-lg shadow-xl p-6 text-white">
      <h2 className="text-2xl font-bold mb-4 text-center text-blue-200">
        🌊 ABYSS FORTUNE 🌊
      </h2>

      {!isPlaying ? (
        // Pre-game: Bet selection
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Place Your Bet (Initial Dive Equipment)
            </label>
            <input
              type="number"
              value={betAmount}
              onChange={(e) => handleBetChange(Number(e.target.value))}
              min={GAME_CONFIG.MIN_BET}
              max={GAME_CONFIG.MAX_BET}
              className="w-full px-4 py-2 rounded bg-blue-800 text-white border-2 border-blue-600 focus:outline-none focus:border-blue-400"
            />
            {error && <p className="text-red-400 text-sm mt-1">{error}</p>}
          </div>

          <div className="flex gap-2 flex-wrap">
            {[10, 25, 50, 100, 250, 500].map((amount) => (
              <button
                key={amount}
                onClick={() => handleBetChange(amount)}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded font-bold transition-colors"
              >
                ${amount}
              </button>
            ))}
          </div>

          <button
            onClick={handleStartGame}
            disabled={!!error || isProcessing}
            className="w-full py-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 rounded-lg font-bold text-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
          >
            🤿 START DIVING
          </button>

          <div className="text-sm text-blue-300 text-center">
            <p>💡 Find treasure in sunken shipwrecks!</p>
            <p>⚠️ Risk increases with depth</p>
            <p>📊 House Edge: 15% (Fixed EV: 0.85)</p>
          </div>
        </div>
      ) : (
        // In-game: Dive controls
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-blue-800 p-3 rounded">
              <p className="text-blue-300">Current Treasure</p>
              <p className="text-2xl font-bold text-yellow-400">
                ${currentTreasure}
              </p>
            </div>
            <div className="bg-blue-800 p-3 rounded">
              <p className="text-blue-300">Dive Number</p>
              <p className="text-2xl font-bold">{diveStats?.diveNumber || 0}</p>
            </div>
          </div>

          {diveStats && (
            <div className="bg-blue-800 p-4 rounded space-y-2">
              <h3 className="font-bold text-lg text-blue-200">
                Next Dive Stats
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-blue-300">Depth</p>
                  <p className="font-bold">{diveStats.depth}m</p>
                </div>
                <div>
                  <p className="text-blue-300">Zone</p>
                  <p className="font-bold">{diveStats.depthZone.name}</p>
                </div>
                <div>
                  <p className="text-blue-300">Survival Chance</p>
                  <p className="font-bold text-green-400">
                    {(diveStats.survivalProbability * 100).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-blue-300">Multiplier</p>
                  <p className="font-bold text-yellow-400">
                    {diveStats.multiplier.toFixed(2)}x
                  </p>
                </div>
                <div>
                  <p className="text-blue-300">Potential Treasure</p>
                  <p className="font-bold text-yellow-400">
                    ${Math.floor(currentTreasure * diveStats.multiplier)}
                  </p>
                </div>
                <div>
                  <p className="text-blue-300">Oxygen</p>
                  <p className="font-bold">{diveStats.oxygenRemaining}%</p>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
