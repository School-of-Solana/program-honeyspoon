"use client";

import { useState, useEffect } from "react";
import OceanScene from "@/components/DeepSeaDiver/OceanScene";
import { calculateDiveStats } from "@/lib/gameLogic";
import { 
  performDive, 
  surfaceWithTreasure, 
  generateSessionId, 
  startGame,
  getWalletInfo,
  getHouseStatus
} from "./actions/gameActions";
import type { GameState, Shipwreck, DiveStats } from "@/lib/types";
import { GAME_CONFIG } from "@/lib/constants";

export default function Home() {
  // Generate a fixed userId for this session (in production, would come from auth)
  const [userId] = useState(() => `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`);
  
  const [gameState, setGameState] = useState<GameState>({
    isPlaying: false,
    diveNumber: 0,
    currentTreasure: 0,
    initialBet: 0,
    depth: 0,
    oxygenLevel: 100,
    sessionId: "",
    userId: "",
    discoveredShipwrecks: [],
    walletBalance: 0,
  });

  const betAmount = GAME_CONFIG.FIXED_BET; // Fixed bet amount for simplified gameplay
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDiving, setIsDiving] = useState(false); // Separate state for diving animation
  const [lastShipwreck, setLastShipwreck] = useState<Shipwreck | undefined>();
  const [survived, setSurvived] = useState<boolean | undefined>(undefined);
  const [showBettingCard, setShowBettingCard] = useState(true);
  const [showHUD, setShowHUD] = useState(false);
  
  // Debug mode state
  const [debugMode, setDebugMode] = useState(false);
  const [houseWalletInfo, setHouseWalletInfo] = useState({
    balance: 0,
    reservedFunds: 0,
    availableFunds: 0,
    totalPaidOut: 0,
    totalReceived: 0,
  });

  // Initialize session and wallet on mount
  useEffect(() => {
    const initializeSession = async () => {
      const sessionId = await generateSessionId();
      const walletInfo = await getWalletInfo(userId);
      const houseStatus = await getHouseStatus();
      
      setGameState((prev) => ({ 
        ...prev, 
        sessionId, 
        userId,
        walletBalance: walletInfo.balance 
      }));
      
      setHouseWalletInfo(houseStatus);
    };
    
    initializeSession();
  }, [userId]);

  // Update house wallet info periodically in debug mode
  useEffect(() => {
    if (!debugMode) return;
    
    const interval = setInterval(async () => {
      const houseStatus = await getHouseStatus();
      setHouseWalletInfo(houseStatus);
    }, 2000); // Update every 2 seconds
    
    return () => clearInterval(interval);
  }, [debugMode]);

  // Keyboard shortcut to toggle debug mode (Ctrl+Shift+D)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        setDebugMode(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Start new game
  const handleStartGame = async () => {
    // Check if user has enough balance for fixed bet
    if (betAmount > (gameState.walletBalance || 0)) {
      console.error('[GAME] ❌ Insufficient balance', {
        betAmount,
        walletBalance: gameState.walletBalance,
        needed: betAmount - (gameState.walletBalance || 0)
      });
      return;
    }

    console.log(`[GAME] 🎮 Starting new game`, {
      betAmount,
      userId,
      sessionId: gameState.sessionId,
      walletBalance: gameState.walletBalance
    });

    setIsProcessing(true);

    try {
      // Start game on server (validates wallet, places bet)
      const result = await startGame(betAmount, userId, gameState.sessionId);
      
      if (!result.success) {
        console.error('[GAME] ❌ Failed to start game', {
          error: result.error,
          betAmount,
          userId
        });
        setIsProcessing(false);
        return;
      }

      console.log('[GAME] ✅ Game started successfully', { sessionId: result.sessionId });

      // Update wallet balance
      const walletInfo = await getWalletInfo(userId);
      console.log('[GAME] 💰 Wallet updated', {
        newBalance: walletInfo.balance,
        totalWagered: walletInfo.totalWagered
      });

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
          userId: gameState.userId,
          discoveredShipwrecks: [],
          walletBalance: walletInfo.balance,
        });
        setShowHUD(true);
        setLastShipwreck(undefined);
        setSurvived(undefined);
        setIsProcessing(false);
        console.log('[GAME] 🎮 HUD visible, game active', {
          diveNumber: 1,
          treasure: betAmount,
          depth: 0
        });
      }, 500);
    } catch (error) {
      console.error("[GAME] ❌ Exception during start:", error);
      setIsProcessing(false);
    }
  };

  // Dive deeper
  const handleDiveDeeper = async () => {
    if (isProcessing) {
      console.warn('[GAME] ⚠️ Dive blocked - already processing');
      return;
    }

    console.log(`[GAME] 🤿 Dive initiated`, {
      diveNumber: gameState.diveNumber,
      currentTreasure: gameState.currentTreasure,
      depth: gameState.depth,
      sessionId: gameState.sessionId
    });

    setIsProcessing(true);

    try {
      // STEP 1: Start diving animation
      setIsDiving(true);
      console.log('[GAME] 🎬 Starting diving animation (2.5s)...');
      
      // Wait for diving animation (2.5 seconds as defined in OceanScene)
      await new Promise((resolve) => setTimeout(resolve, 2500));
      setIsDiving(false);
      
      // STEP 2: Call server to determine result
      console.log('[GAME] 🎲 Calling server for dive result...');
      const result = await performDive(
        gameState.diveNumber,
        gameState.currentTreasure,
        gameState.sessionId,
        gameState.userId
      );

      console.log(`[GAME] 📊 Server response`, {
        survived: result.survived,
        randomRoll: result.randomRoll,
        threshold: result.threshold,
        survivalProb: `${(result.survivalProbability * 100).toFixed(1)}%`,
        multiplier: `${result.multiplier.toFixed(2)}x`,
        newTreasure: result.totalTreasure,
        depth: result.depth
      });

      // STEP 3: Show result animation
      setSurvived(result.survived);
      
      // Wait for result animation to play
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // STEP 4: Update game state
      if (result.survived) {
        console.log(`[GAME] ✅ Dive successful!`, {
          newTreasure: result.totalTreasure,
          depth: result.depth,
          multiplierApplied: result.multiplier,
          nextDive: gameState.diveNumber + 1
        });
        
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
          console.log(`[GAME] 🚢 Shipwreck discovered`, {
            name: result.shipwreck.name,
            depth: result.shipwreck.depth,
            treasureValue: result.shipwreck.treasureValue
          });
        }
        
        // Reset survived state for next dive
        setTimeout(() => setSurvived(undefined), 100);
      } else {
        console.log(`[GAME] 💀 DROWNED - Game Over`, {
          depth: result.depth,
          diveNumber: gameState.diveNumber,
          lostTreasure: gameState.currentTreasure,
          initialBet: gameState.initialBet
        });

        // Update wallet balance
        const walletInfo = await getWalletInfo(userId);
        console.log('[GAME] 💰 Wallet after loss', {
          newBalance: walletInfo.balance,
          totalLost: walletInfo.totalLost
        });

        // Wait for death animation
        await new Promise((resolve) => setTimeout(resolve, 3000));

        console.log('[GAME] 🔄 Resetting to betting screen');

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
          walletBalance: walletInfo.balance,
        }));
        setLastShipwreck(undefined);
        setSurvived(undefined);
        
        setTimeout(() => setShowBettingCard(true), 500);
      }
    } catch (error) {
      console.error("[GAME] ❌ Exception during dive:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Surface with treasure
  const handleSurface = async () => {
    if (isProcessing) {
      console.warn('[GAME] ⚠️ Surface blocked - already processing');
      return;
    }
    if (gameState.currentTreasure <= 0) {
      console.warn('[GAME] ⚠️ Surface blocked - no treasure');
      return;
    }

    console.log(`[GAME] 🏄 Surfacing`, {
      treasure: gameState.currentTreasure,
      initialBet: gameState.initialBet,
      profit: gameState.currentTreasure - gameState.initialBet,
      diveNumber: gameState.diveNumber,
      depth: gameState.depth
    });

    setIsProcessing(true);

    try {
      const result = await surfaceWithTreasure(
        gameState.currentTreasure,
        gameState.sessionId,
        gameState.userId
      );

      console.log('[GAME] 💰 Surface result', {
        success: result.success,
        finalAmount: result.finalAmount,
        profit: result.profit
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      if (result.success) {
        console.log(`[GAME] ✅ Surface successful!`, {
          finalAmount: result.finalAmount,
          profit: result.profit,
          profitPercent: `${((result.profit / gameState.initialBet) * 100).toFixed(1)}%`
        });

        // Update wallet balance
        const walletInfo = await getWalletInfo(userId);
        console.log('[GAME] 💰 Wallet after win', {
          newBalance: walletInfo.balance,
          totalWon: walletInfo.totalWon
        });

        await new Promise((resolve) => setTimeout(resolve, 2000));

        console.log('[GAME] 🔄 Resetting to betting screen');

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
          walletBalance: walletInfo.balance,
        }));
        setLastShipwreck(undefined);
        setSurvived(undefined);
        
        setTimeout(() => setShowBettingCard(true), 500);
      }
    } catch (error) {
      console.error("[GAME] ❌ Exception during surface:", error);
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
          isDiving={isDiving}
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
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1"></div>
                <h1 className="text-4xl font-bold text-white">
                  🌊 ABYSS FORTUNE
                </h1>
                <button
                  onClick={() => setDebugMode(!debugMode)}
                  className="text-xs text-blue-400 hover:text-blue-200 px-2 py-1 bg-blue-950 rounded border border-blue-700"
                  title="Toggle debug mode (Ctrl+Shift+D)"
                >
                  🔧
                </button>
              </div>
              <p className="text-blue-200 text-sm">
                Dive for treasure • 15% House Edge • Infinite Depths
              </p>
            </div>

            {/* Wallet Balance */}
            <div className="mb-6 p-4 bg-blue-950/50 rounded-lg border-2 border-blue-600">
              <div className="flex justify-between items-center">
                <span className="text-blue-300 text-sm font-medium">💰 Your Balance</span>
                <span className="text-2xl font-bold text-yellow-400">
                  ${gameState.walletBalance || 0}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              {/* Fixed Bet Amount Display */}
              <div className="bg-blue-950/70 rounded-lg p-4 border-2 border-yellow-500">
                <div className="text-center">
                  <p className="text-blue-300 text-sm mb-2">Fixed Bet Amount</p>
                  <p className="text-4xl font-bold text-yellow-400">${betAmount}</p>
                  <p className="text-xs text-blue-300 mt-2">per round</p>
                </div>
              </div>

              <button
                onClick={handleStartGame}
                disabled={betAmount > (gameState.walletBalance || 0)}
                className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl font-bold text-xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg"
              >
                🤿 START DIVING (${betAmount})
              </button>
              
              {betAmount > (gameState.walletBalance || 0) && (
                <p className="text-red-400 text-xs text-center">
                  Insufficient balance. Need ${betAmount}, have ${gameState.walletBalance || 0}
                </p>
              )}

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

            {/* Debug Mode: House Wallet Info */}
            {debugMode && (
              <div className="max-w-7xl mx-auto mt-4 bg-red-900/80 border-2 border-red-500 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-red-200 font-bold text-sm uppercase">
                    🔧 DEBUG MODE - House Wallet
                  </span>
                  <button
                    onClick={() => setDebugMode(false)}
                    className="text-red-300 hover:text-white text-xs px-2 py-1 bg-red-800 rounded"
                  >
                    Close
                  </button>
                </div>
                <div className="grid grid-cols-5 gap-3 text-white text-xs">
                  <div className="bg-black/40 rounded p-2">
                    <div className="text-gray-400 mb-1">Balance</div>
                    <div className="font-bold text-green-400">
                      ${houseWalletInfo.balance.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-black/40 rounded p-2">
                    <div className="text-gray-400 mb-1">Reserved</div>
                    <div className="font-bold text-orange-400">
                      ${houseWalletInfo.reservedFunds.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-black/40 rounded p-2">
                    <div className="text-gray-400 mb-1">Available</div>
                    <div className="font-bold text-blue-400">
                      ${houseWalletInfo.availableFunds.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-black/40 rounded p-2">
                    <div className="text-gray-400 mb-1">Paid Out</div>
                    <div className="font-bold text-red-400">
                      ${houseWalletInfo.totalPaidOut.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-black/40 rounded p-2">
                    <div className="text-gray-400 mb-1">Received</div>
                    <div className="font-bold text-purple-400">
                      ${houseWalletInfo.totalReceived.toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-red-200">
                  Press <kbd className="px-1 py-0.5 bg-red-800 rounded">Ctrl+Shift+D</kbd> to toggle debug mode
                </div>
              </div>
            )}
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
