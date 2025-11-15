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
          <div className="nes-container is-dark with-title" style={{ width: '400px', backgroundColor: '#212529' }}>
            <p className="title" style={{ fontSize: '12px' }}>ABYSS FORTUNE</p>
            
            {/* Debug Button */}
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setDebugMode(!debugMode)}
                className="nes-btn is-warning"
                style={{ padding: '4px 8px', fontSize: '8px' }}
                title="Toggle debug mode (Ctrl+Shift+D)"
              >
                DEBUG
              </button>
            </div>

            {/* Wallet Balance */}
            <div className="nes-container is-rounded mb-4" style={{ backgroundColor: '#ffd700', color: '#000' }}>
              <div className="flex justify-between items-center">
                <span style={{ fontSize: '10px' }}>BALANCE</span>
                <span style={{ fontSize: '16px', fontWeight: 'bold' }}>${gameState.walletBalance || 0}</span>
              </div>
            </div>

            {/* Bet Amount */}
            <div className="nes-container is-rounded mb-4" style={{ backgroundColor: '#00ff00', color: '#000' }}>
              <div className="text-center">
                <p style={{ fontSize: '8px', marginBottom: '8px' }}>WAGER PER DIVE</p>
                <p style={{ fontSize: '24px', fontWeight: 'bold' }}>${betAmount}</p>
              </div>
            </div>

            {/* Start Button */}
            <button
              onClick={handleStartGame}
              disabled={betAmount > (gameState.walletBalance || 0)}
              className={`nes-btn ${betAmount > (gameState.walletBalance || 0) ? 'is-disabled' : 'is-success'} w-full mb-4`}
              style={{ fontSize: '12px' }}
            >
              START GAME (${betAmount})
            </button>
            
            {/* Error Message */}
            {betAmount > (gameState.walletBalance || 0) && (
              <div className="nes-container is-rounded is-error mb-4">
                <p style={{ fontSize: '8px', textAlign: 'center' }}>
                  Need ${betAmount}, have ${gameState.walletBalance || 0}
                </p>
              </div>
            )}

            {/* Info */}
            <p style={{ fontSize: '8px', textAlign: 'center', color: '#aaa' }}>
              15% House Edge - Infinite Depths
            </p>
          </div>
        </div>
      )}

      {/* HUD Overlay (In-Game) */}
      {showHUD && currentDiveStats && (
        <div className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${
          showHUD ? 'opacity-100' : 'opacity-0'
        }`}>
          {/* Top HUD Bar - NES Style */}
          <div className="absolute top-0 left-0 right-0 p-4 pointer-events-auto">
            <div className="max-w-7xl mx-auto grid grid-cols-2 gap-4">
              {/* Left: Depth & Dive # */}
              <div className="nes-container is-dark" style={{ backgroundColor: 'rgba(33, 37, 41, 0.95)', padding: '16px' }}>
                <p style={{ fontSize: '32px', color: '#00bfff', marginBottom: '4px' }}>
                  {gameState.depth}m
                </p>
                <p style={{ fontSize: '10px', color: '#ffd700' }}>
                  DIVE #{gameState.diveNumber}
                </p>
              </div>

              {/* Right: Treasure */}
              <div className="nes-container is-dark" style={{ backgroundColor: 'rgba(33, 37, 41, 0.95)', padding: '16px', textAlign: 'right' }}>
                <p style={{ fontSize: '32px', color: '#ffd700', marginBottom: '4px' }}>
                  ${gameState.currentTreasure}
                </p>
                <p style={{ fontSize: '10px', color: '#00ff00' }}>
                  TREASURE
                </p>
              </div>
            </div>

            {/* Debug Mode: House Wallet Info */}
            {debugMode && (
              <div className="max-w-7xl mx-auto mt-4">
                <div className="nes-container is-dark is-rounded" style={{ backgroundColor: 'rgba(220, 38, 38, 0.9)' }}>
                  <div className="flex justify-between items-center mb-4">
                    <span style={{ fontSize: '10px', color: '#fca5a5' }}>
                      DEBUG - HOUSE WALLET
                    </span>
                    <button
                      onClick={() => setDebugMode(false)}
                      className="nes-btn is-error"
                      style={{ padding: '4px 8px', fontSize: '8px' }}
                    >
                      X
                    </button>
                  </div>
                  <div className="grid grid-cols-5 gap-2" style={{ fontSize: '8px' }}>
                    <div>
                      <div style={{ color: '#9ca3af' }}>Balance</div>
                      <div style={{ color: '#4ade80', fontWeight: 'bold' }}>
                        ${houseWalletInfo.balance.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#9ca3af' }}>Reserved</div>
                      <div style={{ color: '#fb923c', fontWeight: 'bold' }}>
                        ${houseWalletInfo.reservedFunds.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#9ca3af' }}>Available</div>
                      <div style={{ color: '#60a5fa', fontWeight: 'bold' }}>
                        ${houseWalletInfo.availableFunds.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#9ca3af' }}>Paid Out</div>
                      <div style={{ color: '#f87171', fontWeight: 'bold' }}>
                        ${houseWalletInfo.totalPaidOut.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#9ca3af' }}>Received</div>
                      <div style={{ color: '#c084fc', fontWeight: 'bold' }}>
                        ${houseWalletInfo.totalReceived.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom: Action Buttons - NES Style */}
          <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-auto">
            <div className="max-w-4xl mx-auto">
              {/* Stats Panel */}
              <div className="nes-container is-dark mb-4" style={{ backgroundColor: 'rgba(33, 37, 41, 0.95)' }}>
                <div className="flex justify-between items-center">
                  <div className="grid grid-cols-4 gap-4 text-center flex-1">
                    <div>
                      <div style={{ fontSize: '8px', color: '#4ade80', marginBottom: '4px' }}>SURVIVAL</div>
                      <div style={{ fontSize: '16px', color: '#4ade80', fontWeight: 'bold' }}>
                        {(currentDiveStats.survivalProbability * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '8px', color: '#fbbf24', marginBottom: '4px' }}>MULTIPLIER</div>
                      <div style={{ fontSize: '16px', color: '#fbbf24', fontWeight: 'bold' }}>
                        {currentDiveStats.multiplier.toFixed(2)}x
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '8px', color: '#a78bfa', marginBottom: '4px' }}>POTENTIAL</div>
                      <div style={{ fontSize: '16px', color: '#a78bfa', fontWeight: 'bold' }}>
                        ${Math.floor(gameState.currentTreasure * currentDiveStats.multiplier)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '8px', color: '#60a5fa', marginBottom: '4px' }}>ZONE</div>
                      <div style={{ fontSize: '16px', color: '#60a5fa', fontWeight: 'bold' }}>
                        {currentDiveStats.depthZone.name}
                      </div>
                    </div>
                  </div>
                  
                  {/* Kaplay Debug Toggle */}
                  <button
                    onClick={() => setKaplayDebug(!kaplayDebug)}
                    className={`nes-btn ${kaplayDebug ? 'is-success' : 'is-warning'} ml-4`}
                    style={{ padding: '8px 16px', fontSize: '8px' }}
                    title="Toggle Kaplay Debug Mode"
                  >
                    {kaplayDebug ? 'DBG:ON' : 'DBG'}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={handleDiveDeeper}
                  disabled={isProcessing}
                  className={`nes-btn ${isProcessing ? 'is-disabled' : 'is-error'} flex-1`}
                  style={{ fontSize: '16px', padding: '16px' }}
                >
                  {isProcessing ? 'DIVING...' : 'DIVE DEEPER'}
                </button>
                <button
                  onClick={handleSurface}
                  disabled={isProcessing}
                  className={`nes-btn ${isProcessing ? 'is-disabled' : 'is-success'} flex-1`}
                  style={{ fontSize: '16px', padding: '16px' }}
                >
                  SURFACE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}




    </div>
  );
}
