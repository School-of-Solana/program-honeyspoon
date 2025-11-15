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
  const [shouldSurface, setShouldSurface] = useState(false); // Only surface when player cashes out
  const [lastShipwreck, setLastShipwreck] = useState<Shipwreck | undefined>();
  const [survived, setSurvived] = useState<boolean | undefined>(undefined);
  const [showBettingCard, setShowBettingCard] = useState(true);
  const [showHUD, setShowHUD] = useState(false);
  
  // Debug mode states
  const [debugMode, setDebugMode] = useState(false); // House wallet debug
  const [kaplayDebug, setKaplayDebug] = useState(false); // Kaplay debug mode
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
          currentTreasure: 0,
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
      // For first dive, use initialBet as the value to multiply; subsequent dives use accumulated treasure
      const valueToMultiply = gameState.currentTreasure === 0 ? gameState.initialBet : gameState.currentTreasure;
      const result = await performDive(
        gameState.diveNumber,
        valueToMultiply,
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
    setShouldSurface(true); // Trigger surfacing animation

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
        setShouldSurface(false); // Reset surface trigger
        
        setTimeout(() => setShowBettingCard(true), 500);
      }
    } catch (error) {
      console.error("[GAME] ❌ Exception during surface:", error);
    } finally {
      setIsProcessing(false);
      setShouldSurface(false); // Reset surface trigger
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
          shouldSurface={shouldSurface}
          lastShipwreck={lastShipwreck}
          debugMode={kaplayDebug}
        />
      </div>

      {/* Betting Card (On Beach - Right Side) */}
      {showBettingCard && (
        <div className={`absolute top-20 right-8 z-50 transition-all duration-500 ${
          showBettingCard ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'
        }`}>
          {/* Pirate Treasure Map Card with Wood Panel Theme */}
          <div className="relative max-w-md">
            {/* Rope border effect */}
            <div className="absolute -inset-2 bg-gradient-to-br from-amber-900 via-amber-800 to-amber-900 rounded-3xl opacity-40 blur-sm"></div>
            
            {/* Main card - Wood panel theme */}
            <div className="relative bg-gradient-to-br from-amber-950 via-yellow-950 to-amber-950 rounded-2xl shadow-2xl p-8 border-4 border-amber-700" style={{
              backgroundImage: 'repeating-linear-gradient(90deg, rgba(139, 69, 19, 0.1) 0px, transparent 2px, transparent 4px, rgba(139, 69, 19, 0.1) 6px)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.1)',
            }}>
              {/* Decorative corner pieces */}
              <div className="absolute top-2 left-2 w-4 h-4 border-l-2 border-t-2 border-amber-600"></div>
              <div className="absolute top-2 right-2 w-4 h-4 border-r-2 border-t-2 border-amber-600"></div>
              <div className="absolute bottom-2 left-2 w-4 h-4 border-l-2 border-b-2 border-amber-600"></div>
              <div className="absolute bottom-2 right-2 w-4 h-4 border-r-2 border-b-2 border-amber-600"></div>
              
              <div className="text-center mb-6">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1"></div>
                  <div className="relative">
                    {/* Title with glow */}
                    <h1 className="text-5xl font-bold text-yellow-400 drop-shadow-[0_0_15px_rgba(234,179,8,0.6)]" style={{ 
                      fontFamily: 'var(--font-treasure)',
                      textShadow: '2px 2px 4px rgba(0,0,0,0.8), 0 0 20px rgba(234, 179, 8, 0.4)'
                    }}>
                      ABYSS FORTUNE
                    </h1>
                    {/* Decorative underline */}
                    <div className="h-1 bg-gradient-to-r from-transparent via-yellow-600 to-transparent mt-2 rounded"></div>
                  </div>
                  <button
                    onClick={() => setDebugMode(!debugMode)}
                    className="text-xs text-amber-400 hover:text-amber-200 px-2 py-1 bg-amber-950 rounded border border-amber-700 transition-colors"
                    title="Toggle debug mode (Ctrl+Shift+D)"
                    style={{ fontFamily: 'var(--font-treasure)' }}
                  >
                    DEBUG
                  </button>
                </div>
                <p className="text-amber-300 text-sm" style={{ fontFamily: 'var(--font-treasure)' }}>
                  Dive for treasure - 15% House Edge - Infinite Depths
                </p>
              </div>

              {/* Wallet Balance - Parchment style */}
              <div className="mb-6 p-4 bg-gradient-to-br from-yellow-100 to-amber-100 rounded-lg border-2 border-amber-800 shadow-inner relative" style={{
                backgroundImage: 'radial-gradient(circle at 20% 50%, transparent 20%, rgba(139, 69, 19, 0.03) 21%, rgba(139, 69, 19, 0.03) 34%, transparent 35%)',
              }}>
                {/* Burnt edges effect */}
                <div className="absolute inset-0 rounded-lg opacity-30" style={{
                  background: 'radial-gradient(circle at top left, rgba(139, 69, 19, 0.3) 0%, transparent 30%), radial-gradient(circle at top right, rgba(139, 69, 19, 0.3) 0%, transparent 30%), radial-gradient(circle at bottom left, rgba(139, 69, 19, 0.3) 0%, transparent 30%), radial-gradient(circle at bottom right, rgba(139, 69, 19, 0.3) 0%, transparent 30%)'
                }}></div>
                <div className="flex justify-between items-center relative z-10">
                  <span className="text-amber-900 text-sm font-bold" style={{ fontFamily: 'var(--font-treasure)' }}>Your Balance</span>
                  <span className="text-3xl font-bold text-amber-900" style={{ fontFamily: 'var(--font-treasure)', textShadow: '1px 1px 2px rgba(255,215,0,0.3)' }}>
                    ${gameState.walletBalance || 0}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                {/* Fixed Bet Amount Display - Treasure chest style */}
                <div className="bg-gradient-to-br from-yellow-800 to-amber-900 rounded-lg p-4 border-3 border-yellow-600 shadow-lg" style={{
                  boxShadow: '0 4px 10px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
                }}>
                  <div className="text-center">
                    <p className="text-yellow-200 text-sm mb-2" style={{ fontFamily: 'var(--font-treasure)' }}>Wager per Dive</p>
                    <p className="text-5xl font-bold text-yellow-300 drop-shadow-lg" style={{ 
                      fontFamily: 'var(--font-treasure)',
                      textShadow: '2px 2px 4px rgba(0,0,0,0.8), 0 0 15px rgba(255,215,0,0.5)'
                    }}>${betAmount}</p>
                    <p className="text-xs text-yellow-300 mt-2" style={{ fontFamily: 'var(--font-treasure)' }}>gold pieces</p>
                  </div>
                </div>

                {/* Start Button - Nautical rope style */}
                <button
                  onClick={handleStartGame}
                  disabled={betAmount > (gameState.walletBalance || 0)}
                  className="relative w-full py-5 bg-gradient-to-b from-emerald-600 via-emerald-700 to-emerald-900 hover:from-emerald-500 hover:via-emerald-600 hover:to-emerald-800 text-white rounded-xl font-bold text-2xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none border-4 border-emerald-950"
                  style={{ 
                    fontFamily: 'var(--font-treasure)',
                    boxShadow: '0 8px 20px rgba(0,0,0,0.6), inset 0 2px 4px rgba(255,255,255,0.2)',
                    textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
                  }}
                >
                  {/* Button rope texture */}
                  <div className="absolute inset-0 rounded-xl opacity-10" style={{
                    backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 4px)'
                  }}></div>
                  <span className="relative z-10">CAST OFF (${betAmount})</span>
                </button>
                
                {betAmount > (gameState.walletBalance || 0) && (
                  <div className="bg-red-950 border-2 border-red-700 rounded-lg p-3">
                    <p className="text-red-300 text-sm text-center" style={{ fontFamily: 'var(--font-treasure)' }}>
                      Insufficient doubloons! Need ${betAmount}, have ${gameState.walletBalance || 0}
                    </p>
                  </div>
                )}

                <p className="text-xs text-amber-400 text-center italic" style={{ fontFamily: 'var(--font-treasure)' }}>
                  Beware ye depths below...
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HUD Overlay (In-Game) */}
      {showHUD && currentDiveStats && (
        <div className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${
          showHUD ? 'opacity-100' : 'opacity-0'
        }`}>
          {/* Top HUD Bar - Pirate Theme */}
          <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/90 via-black/70 to-transparent p-6 pointer-events-auto border-b-2 border-amber-900/50">
            <div className="max-w-7xl mx-auto grid grid-cols-2 gap-8 text-white">
              {/* Left: Depth & Dive # - Compass style */}
              <div className="space-y-1 bg-gradient-to-br from-amber-950/60 to-transparent p-4 rounded-lg border-l-4 border-blue-500">
                <div className="text-5xl font-bold text-blue-300 drop-shadow-lg" style={{ 
                  fontFamily: 'var(--font-treasure)',
                  textShadow: '2px 2px 6px rgba(0,0,0,0.9), 0 0 20px rgba(59, 130, 246, 0.4)'
                }}>
                  {gameState.depth}m
                </div>
                <div className="text-sm text-amber-300 uppercase tracking-wider" style={{ fontFamily: 'var(--font-treasure)' }}>
                  Dive #{gameState.diveNumber}
                </div>
              </div>

              {/* Right: Treasure - Chest style */}
              <div className="text-right space-y-1 bg-gradient-to-bl from-amber-950/60 to-transparent p-4 rounded-lg border-r-4 border-yellow-500">
                <div className="text-5xl font-bold text-yellow-300 drop-shadow-lg" style={{ 
                  fontFamily: 'var(--font-treasure)',
                  textShadow: '2px 2px 6px rgba(0,0,0,0.9), 0 0 20px rgba(234, 179, 8, 0.5)'
                }}>
                  ${gameState.currentTreasure}
                </div>
                <div className="text-sm text-amber-300 uppercase tracking-wider" style={{ fontFamily: 'var(--font-treasure)' }}>
                  Treasure Hoard
                </div>
              </div>
            </div>

            {/* Debug Mode: House Wallet Info */}
            {debugMode && (
              <div className="max-w-7xl mx-auto mt-4 bg-red-900/80 border-2 border-red-500 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-red-200 font-bold text-sm uppercase">
                    DEBUG MODE - House Wallet
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

          {/* Bottom: Action Buttons - Pirate Theme */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-6 pointer-events-auto border-t-2 border-amber-900/50">
            <div className="max-w-4xl mx-auto">
              {/* Stats Panel - Treasure Map Style */}
              <div className="bg-gradient-to-br from-amber-950/80 to-black/80 backdrop-blur-sm rounded-lg p-4 mb-4 border-2 border-amber-700/50 shadow-xl" style={{
                backgroundImage: 'repeating-linear-gradient(90deg, rgba(139, 69, 19, 0.05) 0px, transparent 2px, transparent 4px, rgba(139, 69, 19, 0.05) 6px)',
              }}>
                <div className="flex justify-between items-start mb-2">
                  <div className="grid grid-cols-4 gap-4 text-center flex-1">
                    <div className="bg-black/40 rounded-lg p-2 border border-green-700/30">
                      <div className="text-xs text-amber-400 mb-1 uppercase" style={{ fontFamily: 'var(--font-treasure)' }}>Survival</div>
                      <div className="text-xl font-bold text-green-300" style={{ fontFamily: 'var(--font-treasure)' }}>
                        {(currentDiveStats.survivalProbability * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div className="bg-black/40 rounded-lg p-2 border border-yellow-700/30">
                      <div className="text-xs text-amber-400 mb-1 uppercase" style={{ fontFamily: 'var(--font-treasure)' }}>Multiplier</div>
                      <div className="text-xl font-bold text-yellow-300" style={{ fontFamily: 'var(--font-treasure)' }}>
                        {currentDiveStats.multiplier.toFixed(2)}x
                      </div>
                    </div>
                    <div className="bg-black/40 rounded-lg p-2 border border-purple-700/30">
                      <div className="text-xs text-amber-400 mb-1 uppercase" style={{ fontFamily: 'var(--font-treasure)' }}>Potential</div>
                      <div className="text-xl font-bold text-purple-300" style={{ fontFamily: 'var(--font-treasure)' }}>
                        ${Math.floor(gameState.currentTreasure * currentDiveStats.multiplier)}
                      </div>
                    </div>
                    <div className="bg-black/40 rounded-lg p-2 border border-blue-700/30">
                      <div className="text-xs text-amber-400 mb-1 uppercase" style={{ fontFamily: 'var(--font-treasure)' }}>Zone</div>
                      <div className="text-xl font-bold text-blue-300" style={{ fontFamily: 'var(--font-treasure)' }}>
                        {currentDiveStats.depthZone.name}
                      </div>
                    </div>
                  </div>
                  
                  {/* Kaplay Debug Toggle */}
                  <button
                    onClick={() => setKaplayDebug(!kaplayDebug)}
                    className={`ml-4 px-3 py-2 rounded text-xs font-medium transition-colors ${
                      kaplayDebug 
                        ? 'bg-green-700 text-white border-2 border-green-500' 
                        : 'bg-amber-900 text-amber-300 border-2 border-amber-700 hover:bg-amber-800'
                    }`}
                    title="Toggle Kaplay Debug Mode (shows hitboxes, FPS, etc.)"
                    style={{ fontFamily: 'var(--font-treasure)' }}
                  >
                    {kaplayDebug ? 'DEBUG ON' : 'DEBUG'}
                  </button>
                </div>
              </div>

              {/* Action Buttons - Nautical Style */}
              <div className="flex gap-4">
                <button
                  onClick={handleDiveDeeper}
                  disabled={isProcessing}
                  className="relative flex-1 py-5 bg-gradient-to-b from-red-700 via-red-800 to-red-950 hover:from-red-600 hover:via-red-700 hover:to-red-900 text-white rounded-xl font-bold text-2xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none border-4 border-red-950"
                  style={{ 
                    fontFamily: 'var(--font-treasure)',
                    boxShadow: '0 8px 20px rgba(0,0,0,0.8), inset 0 2px 4px rgba(255,255,255,0.15)',
                    textShadow: '2px 2px 4px rgba(0,0,0,0.9)'
                  }}
                >
                  <div className="absolute inset-0 rounded-xl opacity-10" style={{
                    backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.3) 2px, rgba(255,255,255,0.3) 4px)'
                  }}></div>
                  <span className="relative z-10">{isProcessing ? 'DESCENDING...' : 'DIVE DEEPER'}</span>
                </button>
                <button
                  onClick={handleSurface}
                  disabled={isProcessing}
                  className="relative flex-1 py-5 bg-gradient-to-b from-emerald-700 via-emerald-800 to-emerald-950 hover:from-emerald-600 hover:via-emerald-700 hover:to-emerald-900 text-white rounded-xl font-bold text-2xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none border-4 border-emerald-950"
                  style={{ 
                    fontFamily: 'var(--font-treasure)',
                    boxShadow: '0 8px 20px rgba(0,0,0,0.8), inset 0 2px 4px rgba(255,255,255,0.15)',
                    textShadow: '2px 2px 4px rgba(0,0,0,0.9)'
                  }}
                >
                  <div className="absolute inset-0 rounded-xl opacity-10" style={{
                    backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.3) 2px, rgba(255,255,255,0.3) 4px)'
                  }}></div>
                  <span className="relative z-10">SURFACE NOW</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}




    </div>
  );
}
