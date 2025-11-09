"use client";

import { useState, useEffect } from "react";
import OceanScene from "@/components/DeepSeaDiver/OceanScene";
import { calculateDiveStats } from "@/lib/gameLogic";
import { performDive, surfaceWithTreasure, generateSessionId } from "./actions/gameActions";
import type { GameState, Shipwreck, DiveStats } from "@/lib/types";
import { GAME_CONFIG } from "@/lib/constants";

export default function Home() {
  const [gameState, setGameState] = useState<GameState>({
    isPlaying: false,
    diveNumber: 0,
    currentTreasure: 0,
    initialBet: 0,
    depth: 0,
    oxygenLevel: 100,
    sessionId: "",
    discoveredShipwrecks: [],
  });

  const [betAmount, setBetAmount] = useState(100);
  const [betError, setBetError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastShipwreck, setLastShipwreck] = useState<Shipwreck | undefined>();
  const [survived, setSurvived] = useState<boolean | undefined>(undefined);
  const [showBettingCard, setShowBettingCard] = useState(true);
  const [showHUD, setShowHUD] = useState(false);

  // Generate session ID on mount
  useEffect(() => {
    generateSessionId().then((id) => {
      setGameState((prev) => ({ ...prev, sessionId: id }));
    });
  }, []);

  // Validate bet
  const handleBetChange = (amount: number) => {
    if (amount < GAME_CONFIG.MIN_BET) {
      setBetError(`Minimum bet is $${GAME_CONFIG.MIN_BET}`);
    } else if (amount > GAME_CONFIG.MAX_BET) {
      setBetError(`Maximum bet is $${GAME_CONFIG.MAX_BET}`);
    } else {
      setBetError("");
    }
    setBetAmount(amount);
  };

  // Start new game
  const handleStartGame = () => {
    if (betAmount < GAME_CONFIG.MIN_BET || betAmount > GAME_CONFIG.MAX_BET) {
      return;
    }

    console.log(`[GAME] Starting new game with bet: $${betAmount}`);

    // Hide betting card with animation
    setShowBettingCard(false);
    
    // Wait for card to fade, then start game and show HUD
    setTimeout(() => {
      setGameState({
        isPlaying: true,
        diveNumber: 1,
        currentTreasure: betAmount,
        initialBet: betAmount,
        depth: 0,
        oxygenLevel: 100,
        sessionId: gameState.sessionId,
        discoveredShipwrecks: [],
      });
      setShowHUD(true);
      setLastShipwreck(undefined);
      setSurvived(undefined);
      console.log('[GAME] Game started, HUD visible');
    }, 500);
  };

  // Dive deeper
  const handleDiveDeeper = async () => {
    if (isProcessing) return;

    console.log(`[GAME] Dive initiated - Dive #${gameState.diveNumber}, Current treasure: $${gameState.currentTreasure}`);

    setIsProcessing(true);

    try {
      // STEP 1: Start diving animation
      setIsProcessing(true);
      console.log('[GAME] Starting diving animation...');
      
      // Wait for diving animation (2.5 seconds as defined in OceanScene)
      await new Promise((resolve) => setTimeout(resolve, 2500));
      
      // STEP 2: Call server to determine result
      console.log('[GAME] Calling server...');
      const result = await performDive(
        gameState.diveNumber,
        gameState.currentTreasure,
        gameState.sessionId
      );

      console.log(`[GAME] Server response received - Survived: ${result.survived}, Roll: ${result.randomRoll}, Threshold: ${result.threshold}`);

      // STEP 3: Show result animation
      setSurvived(result.survived);
      
      // Wait for result animation to play
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // STEP 4: Update game state
      if (result.survived) {
        console.log(`[GAME] Dive successful! New treasure: $${result.totalTreasure}, Depth: ${result.depth}m`);
        
        setGameState((prev) => ({
          ...prev,
          diveNumber: prev.diveNumber + 1,
          currentTreasure: result.totalTreasure,
          depth: result.depth,
          oxygenLevel: Math.max(5, prev.oxygenLevel - 4),
          discoveredShipwrecks: result.shipwreck
            ? [...prev.discoveredShipwrecks, result.shipwreck]
            : prev.discoveredShipwrecks,
        }));

        if (result.shipwreck) {
          setLastShipwreck(result.shipwreck);
          console.log(`[GAME] Shipwreck discovered: ${result.shipwreck.name}`);
        }
        
        // Reset survived state for next dive
        setTimeout(() => setSurvived(undefined), 100);
      } else {
        console.log(`[GAME] DROWNED at ${result.depth}m - Game Over`);

        // Wait for death animation
        await new Promise((resolve) => setTimeout(resolve, 3000));

        console.log('[GAME] Resetting to betting screen');

        // Reset and show betting card again
        setShowHUD(false);
        setGameState((prev) => ({
          ...prev,
          isPlaying: false,
          diveNumber: 0,
          currentTreasure: 0,
          depth: 0,
          oxygenLevel: 100,
          discoveredShipwrecks: [],
        }));
        setLastShipwreck(undefined);
        setSurvived(undefined);
        
        setTimeout(() => setShowBettingCard(true), 500);
      }
    } catch (error) {
      console.error("Dive failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Surface with treasure
  const handleSurface = async () => {
    if (isProcessing || gameState.currentTreasure <= 0) return;

    console.log(`[GAME] Surfacing with $${gameState.currentTreasure} treasure`);

    setIsProcessing(true);

    try {
      const result = await surfaceWithTreasure(
        gameState.currentTreasure,
        gameState.sessionId
      );

      await new Promise((resolve) => setTimeout(resolve, 2000));

      if (result.success) {
        const profit = result.finalAmount - gameState.initialBet;
        console.log(`[GAME] Surface successful! Final amount: $${result.finalAmount}, Profit: $${profit}`);

        await new Promise((resolve) => setTimeout(resolve, 2000));

        console.log('[GAME] Resetting to betting screen');

        // Reset and show betting card
        setShowHUD(false);
        setGameState((prev) => ({
          ...prev,
          isPlaying: false,
          diveNumber: 0,
          currentTreasure: 0,
          depth: 0,
          oxygenLevel: 100,
          discoveredShipwrecks: [],
        }));
        setLastShipwreck(undefined);
        setSurvived(undefined);
        
        setTimeout(() => setShowBettingCard(true), 500);
      }
    } catch (error) {
      console.error("Surface failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const currentDiveStats: DiveStats | null = gameState.isPlaying
    ? calculateDiveStats(gameState.diveNumber)
    : null;

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden">
      {/* Full-screen Ocean Canvas */}
      <div className="absolute inset-0 w-full h-full">
        <OceanScene
          depth={gameState.depth}
          treasureValue={gameState.currentTreasure}
          oxygenLevel={gameState.oxygenLevel}
          isDiving={isProcessing}
          survived={survived}
          lastShipwreck={lastShipwreck}
        />
      </div>

      {/* Betting Card (Above Water Surface - Initially) */}
      {showBettingCard && (
        <div className={`absolute top-20 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-500 ${
          showBettingCard ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'
        }`}>
          <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 rounded-2xl shadow-2xl p-8 border-4 border-blue-400 backdrop-blur-sm bg-opacity-95 max-w-md">
            <div className="text-center mb-6">
              <h1 className="text-4xl font-bold text-white mb-2">
                🌊 ABYSS FORTUNE
              </h1>
              <p className="text-blue-200 text-sm">
                Dive for treasure • 15% House Edge • Infinite Depths
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-white font-medium mb-2 text-sm">
                  💰 Place Your Bet
                </label>
                <input
                  type="number"
                  value={betAmount}
                  onChange={(e) => handleBetChange(Number(e.target.value))}
                  min={GAME_CONFIG.MIN_BET}
                  max={GAME_CONFIG.MAX_BET}
                  className="w-full px-4 py-3 rounded-lg bg-blue-950 text-white text-xl font-bold border-2 border-blue-600 focus:outline-none focus:border-yellow-400 transition-colors"
                />
                {betError && (
                  <p className="text-red-400 text-xs mt-1">{betError}</p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[10, 25, 50, 100, 250, 500].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => handleBetChange(amount)}
                    className="px-3 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg font-bold text-sm transition-all transform hover:scale-105"
                  >
                    ${amount}
                  </button>
                ))}
              </div>

              <button
                onClick={handleStartGame}
                disabled={!!betError}
                className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl font-bold text-xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg"
              >
                🤿 START DIVING
              </button>

              <p className="text-xs text-blue-300 text-center">
                Press Start to submerge into the depths
              </p>
            </div>
          </div>
        </div>
      )}

      {/* HUD Overlay (In-Game) */}
      {showHUD && currentDiveStats && (
        <div className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${
          showHUD ? 'opacity-100' : 'opacity-0'
        }`}>
          {/* Top HUD Bar */}
          <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black via-black/80 to-transparent p-6 pointer-events-auto">
            <div className="max-w-7xl mx-auto grid grid-cols-2 gap-8 text-white">
              {/* Left: Depth & Dive # */}
              <div className="space-y-1">
                <div className="text-5xl font-bold text-blue-400">
                  {gameState.depth}m
                </div>
                <div className="text-sm text-gray-400 uppercase tracking-wider">
                  Dive #{gameState.diveNumber}
                </div>
              </div>

              {/* Right: Treasure */}
              <div className="text-right space-y-1">
                <div className="text-5xl font-bold text-yellow-400">
                  ${gameState.currentTreasure}
                </div>
                <div className="text-sm text-gray-400 uppercase tracking-wider">
                  Treasure Value
                </div>
              </div>
            </div>
          </div>

          {/* Bottom: Action Buttons */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-6 pointer-events-auto">
            <div className="max-w-4xl mx-auto">
              {/* Stats Panel */}
              <div className="bg-black/60 backdrop-blur-sm rounded-lg p-4 mb-4 border border-blue-500/30">
                <div className="grid grid-cols-4 gap-4 text-center text-white">
                  <div>
                    <div className="text-xs text-gray-400 mb-1">SURVIVAL</div>
                    <div className="text-lg font-bold text-green-400">
                      {(currentDiveStats.survivalProbability * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">MULTIPLIER</div>
                    <div className="text-lg font-bold text-yellow-400">
                      {currentDiveStats.multiplier.toFixed(2)}x
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">POTENTIAL</div>
                    <div className="text-lg font-bold text-purple-400">
                      ${Math.floor(gameState.currentTreasure * currentDiveStats.multiplier)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">ZONE</div>
                    <div className="text-lg font-bold text-blue-400">
                      {currentDiveStats.depthZone.name}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={handleDiveDeeper}
                  disabled={isProcessing}
                  className="flex-1 py-4 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white rounded-xl font-bold text-xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-xl"
                >
                  {isProcessing ? '🌊 DIVING...' : '⬇️ DIVE DEEPER'}
                </button>
                <button
                  onClick={handleSurface}
                  disabled={isProcessing}
                  className="flex-1 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl font-bold text-xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-xl"
                >
                  ⬆️ SURFACE NOW
                </button>
              </div>
            </div>
          </div>
        </div>
      )}




    </div>
  );
}
