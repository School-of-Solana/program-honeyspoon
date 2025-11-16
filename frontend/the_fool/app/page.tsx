"use client";

import { useState, useEffect } from "react";
import OceanScene from "@/components/DeepSeaDiver/OceanScene";
import { GameErrorBoundary } from "@/components/DeepSeaDiver/GameErrorBoundary";
import { calculateDiveStats } from "@/lib/gameLogic";
import {
  performDive,
  surfaceWithTreasure,
  generateSessionId,
  startGame,
  getWalletInfo,
  getHouseStatus,
} from "./actions/gameActions";
import type { GameState, DiveStats } from "@/lib/types";
import { GAME_CONFIG } from "@/lib/constants";
import { GAME_COLORS } from "@/lib/gameColors";
import { playSound, getSoundManager } from "@/lib/soundManager";
import { useGameStore } from "@/lib/gameStore";

export default function Home() {
  // Generate a fixed userId for this session (in production, would come from auth)
  const [userId] = useState(
    () => `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  );

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
  const [showBettingCard, setShowBettingCard] = useState(true);
  const [showHUD, setShowHUD] = useState(false);

  // Error state for user feedback
  const [errorState, setErrorState] = useState<{
    message: string;
    type: "error" | "warning" | "info";
    action?: () => void;
    actionLabel?: string;
  } | null>(null);

  // Use Zustand store for canvas/scene state
  const startDiveAnimation = useGameStore((state) => state.startDiveAnimation);
  const setSurvived = useGameStore((state) => state.setSurvived);
  const setLastShipwreck = useGameStore((state) => state.setLastShipwreck);
  const setAnimationMessage = useGameStore(
    (state) => state.setAnimationMessage
  );
  const triggerSurfacing = useGameStore((state) => state.triggerSurfacing);
  const setDepth = useGameStore((state) => state.setDepth);
  const setTreasure = useGameStore((state) => state.setTreasure);
  const returnToBeach = useGameStore((state) => state.returnToBeach);

  // Read animation message from store for display
  const animationMessage = useGameStore((state) => state.animationMessage);

  // Debug mode states
  const [debugMode, setDebugMode] = useState(false); // House wallet debug
  const [kaplayDebug, setKaplayDebug] = useState(false); // Kaplay debug mode
  const [soundMuted, setSoundMuted] = useState(false); // Sound mute state
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
        walletBalance: walletInfo.balance,
      }));

      setHouseWalletInfo(houseStatus);
    };

    initializeSession();
  }, [userId]);

  // Sync initial sound state from manager on mount
  useEffect(() => {
    setSoundMuted(getSoundManager().isMuted());
  }, []);

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
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        setDebugMode((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, []);

  // Error handling helpers
  const showError = (
    message: string,
    type: "error" | "warning" | "info" = "error",
    action?: () => void,
    actionLabel?: string
  ) => {
    console.error("[UI ERROR]", message);
    setErrorState({ message, type, action, actionLabel });
    // Auto-dismiss after 5 seconds if no action
    if (!action) {
      setTimeout(() => setErrorState(null), 5000);
    }
  };

  const dismissError = () => setErrorState(null);

  // Start new game
  const handleStartGame = async () => {
    // Check if user has enough balance for fixed bet
    if (betAmount > (gameState.walletBalance || 0)) {
      showError(
        `Insufficient balance. Need $${betAmount}, have $${gameState.walletBalance || 0}`,
        "warning"
      );
      return;
    }

    console.log(`[GAME] 🎮 Starting new game`, {
      betAmount,
      userId,
      sessionId: gameState.sessionId,
      walletBalance: gameState.walletBalance,
    });

    setIsProcessing(true);

    try {
      // Start game on server (validates wallet, places bet)
      const result = await startGame(betAmount, userId, gameState.sessionId);

      if (!result.success) {
        showError(
          result.error || "Failed to start game. Please try again.",
          "error"
        );
        setIsProcessing(false);
        return;
      }

      console.log("[GAME] ✅ Game started successfully", {
        sessionId: result.sessionId,
      });

      // Update wallet balance
      const walletInfo = await getWalletInfo(userId);
      console.log("[GAME] 💰 Wallet updated", {
        newBalance: walletInfo.balance,
        totalWagered: walletInfo.totalWagered,
      });

      // Hide betting card with animation
      setShowBettingCard(false);

      // Wait for card to fade, then start game and show HUD
      setTimeout(() => {
        // ✅ FIX: Ensure we're starting from a clean slate
        // Reset all canvas/animation flags before starting new game
        returnToBeach();

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
        console.log("[GAME] 🎮 HUD visible, game active - flags reset", {
          diveNumber: 1,
          treasure: betAmount,
          depth: 0,
        });
      }, 500);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      showError(
        `Game start failed: ${message}`,
        "error",
        () => window.location.reload(),
        "Reload Page"
      );
      setIsProcessing(false);
    }
  };

  // Dive deeper
  const handleDiveDeeper = async () => {
    if (isProcessing) {
      console.warn("[GAME] ⚠️ Dive blocked - already processing");
      return;
    }

    console.log(`[GAME] 🤿 Dive initiated`, {
      diveNumber: gameState.diveNumber,
      currentTreasure: gameState.currentTreasure,
      depth: gameState.depth,
      sessionId: gameState.sessionId,
    });

    setIsProcessing(true);

    try {
      // STEP 1: Start diving animation via Zustand store
      startDiveAnimation(); // This triggers BeachScene to detect and transition!
      playSound("DIVE"); // Play diving swoosh sound
      setTimeout(() => playSound("BUBBLES"), 200); // Bubbles shortly after
      console.log("[GAME] 🎬 Starting diving animation (2.5s)...");

      // Wait for diving animation (2.5 seconds for scene transition + animation)
      await new Promise((resolve) => setTimeout(resolve, 2500));

      // STEP 2: Call server to determine result
      console.log("[GAME] 🎲 Calling server for dive result...");
      // For first dive, use initialBet as the value to multiply; subsequent dives use accumulated treasure
      const valueToMultiply =
        gameState.currentTreasure === 0
          ? gameState.initialBet
          : gameState.currentTreasure;
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
        depth: result.depth,
      });

      // STEP 3: Show result animation via store
      setSurvived(result.survived);
      if (result.survived) {
        setAnimationMessage("TREASURE FOUND!");
        playSound("COIN"); // Play treasure sound
      } else {
        setAnimationMessage("DROWNED!");
        playSound("EXPLOSION"); // Play death sound
      }

      // Wait for result animation to play
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setAnimationMessage("");

      // STEP 4: Update game state
      if (result.survived) {
        console.log(`[GAME] ✅ Dive successful!`, {
          newTreasure: result.totalTreasure,
          depth: result.depth,
          multiplierApplied: result.multiplier,
          nextDive: gameState.diveNumber + 1,
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

        // Update store with new visual state
        setDepth(result.depth);
        setTreasure(result.totalTreasure);

        if (result.shipwreck) {
          setLastShipwreck(result.shipwreck);
          console.log(`[GAME] 🚢 Shipwreck discovered`, {
            name: result.shipwreck.name,
            depth: result.shipwreck.depth,
            treasureValue: result.shipwreck.treasureValue,
          });
        }

        // ✅ FIX: Don't reset survived here - the canvas handles it now
        // This prevents race conditions with the animation state machine
      } else {
        console.log(`[GAME] 💀 DROWNED - Game Over`, {
          depth: result.depth,
          diveNumber: gameState.diveNumber,
          lostTreasure: gameState.currentTreasure,
          initialBet: gameState.initialBet,
        });

        // Update wallet balance
        const walletInfo = await getWalletInfo(userId);
        console.log("[GAME] 💰 Wallet after loss", {
          newBalance: walletInfo.balance,
          totalLost: walletInfo.totalLost,
        });

        // Wait for death animation
        await new Promise((resolve) => setTimeout(resolve, 3000));

        console.log("[GAME] 🔄 Resetting to betting screen");

        // Generate new session ID for next game
        const newSessionId = await generateSessionId();
        console.log("[GAME] 🆔 New session ID generated", { newSessionId });

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
          sessionId: newSessionId, // ✅ NEW SESSION ID
        }));

        // ✅ FIX: Explicitly reset all canvas flags for next game
        returnToBeach();
        setLastShipwreck(undefined);
        setSurvived(undefined);

        setTimeout(() => setShowBettingCard(true), 500);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

      // Check for session errors
      if (message.includes("session") || message.includes("inactive")) {
        showError(
          "Game session expired. Starting new game...",
          "warning",
          async () => {
            const newSessionId = await generateSessionId();
            setGameState((prev) => ({
              ...prev,
              sessionId: newSessionId,
              isPlaying: false,
            }));
            setShowHUD(false);
            setShowBettingCard(true);
            dismissError();
          },
          "Reset Game"
        );
      } else {
        showError(`Dive failed: ${message}`, "error");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Surface with treasure
  const handleSurface = async () => {
    if (isProcessing) {
      console.warn("[GAME] ⚠️ Surface blocked - already processing");
      return;
    }
    if (gameState.currentTreasure <= 0) {
      console.warn("[GAME] ⚠️ Surface blocked - no treasure");
      return;
    }

    console.log(`[GAME] 🏄 Surfacing`, {
      treasure: gameState.currentTreasure,
      initialBet: gameState.initialBet,
      profit: gameState.currentTreasure - gameState.initialBet,
      diveNumber: gameState.diveNumber,
      depth: gameState.depth,
    });

    setIsProcessing(true);
    triggerSurfacing(); // Trigger surfacing animation via store
    playSound("SURFACE"); // Play splash sound

    try {
      const result = await surfaceWithTreasure(
        gameState.currentTreasure,
        gameState.sessionId,
        gameState.userId
      );

      console.log("[GAME] 💰 Surface result", {
        success: result.success,
        finalAmount: result.finalAmount,
        profit: result.profit,
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));
      setAnimationMessage("");

      if (result.success) {
        console.log(`[GAME] ✅ Surface successful!`, {
          finalAmount: result.finalAmount,
          profit: result.profit,
          profitPercent: `${((result.profit / gameState.initialBet) * 100).toFixed(1)}%`,
        });

        // Update wallet balance
        const walletInfo = await getWalletInfo(userId);
        console.log("[GAME] 💰 Wallet after win", {
          newBalance: walletInfo.balance,
          totalWon: walletInfo.totalWon,
        });

        await new Promise((resolve) => setTimeout(resolve, 2000));

        console.log("[GAME] 🔄 Resetting to betting screen");

        // Generate new session ID for next game
        const newSessionId = await generateSessionId();
        console.log("[GAME] 🆔 New session ID generated", { newSessionId });

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
          sessionId: newSessionId, // ✅ NEW SESSION ID
        }));

        // Reset store state
        // ✅ FIX: Explicitly reset all canvas flags for next game
        returnToBeach();
        setLastShipwreck(undefined);
        setSurvived(undefined);
        setDepth(0);
        setTreasure(0);

        setTimeout(() => setShowBettingCard(true), 500);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

      // Handle treasure mismatch specifically
      if (message.includes("treasure")) {
        showError(
          "Treasure amount mismatch. Please contact support.",
          "error",
          () => window.location.reload(),
          "Reload"
        );
      } else {
        showError(`Surface failed: ${message}`, "error");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const currentDiveStats: DiveStats | null = gameState.isPlaying
    ? calculateDiveStats(gameState.diveNumber)
    : null;

  return (
    <GameErrorBoundary>
      <div className="fixed inset-0 w-screen h-screen overflow-hidden">
        {/* Full-screen Ocean Canvas */}
        <div className="absolute inset-0 w-full h-full">
          <OceanScene />
        </div>

        {/* Error Message Overlay (NES Style) */}
        {errorState && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[60]">
            <div
              className={`nes-container pointer-events-auto ${
                errorState.type === "error"
                  ? "is-error"
                  : errorState.type === "warning"
                    ? "is-warning"
                    : "is-primary"
              }`}
              style={{
                backgroundColor: GAME_COLORS.BACKGROUND_DARKER,
                padding: "20px 32px",
                maxWidth: "500px",
                margin: "0 20px",
              }}
            >
              <p
                style={{
                  fontSize: "12px",
                  marginBottom: errorState.action ? "16px" : "0",
                }}
              >
                {errorState.message}
              </p>

              <div className="flex gap-4 justify-center">
                <button
                  onClick={dismissError}
                  className="nes-btn is-primary"
                  style={{ fontSize: "10px", padding: "8px 16px" }}
                >
                  Dismiss
                </button>

                {errorState.action && (
                  <button
                    onClick={errorState.action}
                    className="nes-btn is-success"
                    style={{ fontSize: "10px", padding: "8px 16px" }}
                  >
                    {errorState.actionLabel || "Retry"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Animation Message Overlay (NES Style) */}
        {animationMessage && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-50"
            style={{ paddingTop: "15%" }}
          >
            <div
              className="nes-container is-dark"
              style={{
                backgroundColor: GAME_COLORS.BACKGROUND_DARKER,
                padding: "12px 24px",
                fontSize: "12px",
                animation: "pulse 1s ease-in-out infinite",
                minWidth: "auto",
                whiteSpace: "nowrap",
              }}
            >
              {animationMessage}
            </div>
          </div>
        )}

        {/* Betting Card (On Beach - Right Side) */}
        {showBettingCard && (
          <div
            className={`absolute top-20 right-8 z-50 transition-all duration-500 ${
              showBettingCard
                ? "opacity-100 translate-y-0"
                : "opacity-0 -translate-y-10"
            }`}
          >
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

              {/* Debug & Mute Buttons */}
              <div className="flex justify-between mb-4">
                <button
                  onClick={() => {
                    getSoundManager().toggleMute();
                    setSoundMuted(getSoundManager().isMuted());
                  }}
                  className={`nes-btn ${soundMuted ? "is-error" : "is-success"}`}
                  style={{ padding: "4px 8px", fontSize: "8px" }}
                  title="Toggle sound"
                >
                  {soundMuted ? "🔇 MUTED" : "🔊 SOUND"}
                </button>
                <button
                  onClick={() => setDebugMode(!debugMode)}
                  className="nes-btn is-warning"
                  style={{ padding: "4px 8px", fontSize: "8px" }}
                  title="Toggle debug mode (Ctrl+Shift+D)"
                >
                  DEBUG
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
                  <span style={{ fontSize: "16px", fontWeight: "bold" }}>
                    ${gameState.walletBalance || 0}
                  </span>
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
                    ${betAmount}
                  </p>
                </div>
              </div>

              {/* Start Button */}
              <button
                onClick={() => {
                  playSound("BUTTON_CLICK");
                  handleStartGame();
                }}
                disabled={betAmount > (gameState.walletBalance || 0)}
                className={`nes-btn ${betAmount > (gameState.walletBalance || 0) ? "is-disabled" : "is-success"} w-full mb-4`}
                style={{ fontSize: "12px" }}
              >
                START GAME (${betAmount})
              </button>

              {/* Error Message */}
              {betAmount > (gameState.walletBalance || 0) && (
                <div className="nes-container is-rounded is-error mb-4">
                  <p style={{ fontSize: "8px", textAlign: "center" }}>
                    Need ${betAmount}, have ${gameState.walletBalance || 0}
                  </p>
                </div>
              )}

              {/* Info */}
              <p
                style={{ fontSize: "8px", textAlign: "center", color: "#aaa" }}
              >
                15% House Edge - Infinite Depths
              </p>
            </div>
          </div>
        )}

        {/* HUD Overlay (In-Game) */}
        {showHUD && currentDiveStats && (
          <div
            className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${
              showHUD ? "opacity-100" : "opacity-0"
            }`}
          >
            {/* Top HUD Bar - NES Style */}
            <div className="absolute top-0 left-0 right-0 p-4 pointer-events-auto">
              <div className="max-w-7xl mx-auto grid grid-cols-2 gap-4">
                {/* Left: Depth & Dive # */}
                <div
                  className="nes-container is-dark"
                  style={{
                    backgroundColor: GAME_COLORS.BACKGROUND_DARKER,
                    padding: "12px",
                  }}
                >
                  <p
                    style={{
                      fontSize: "28px",
                      color: GAME_COLORS.DEPTH_CYAN,
                      marginBottom: "4px",
                    }}
                  >
                    {gameState.depth}m
                  </p>
                  <p
                    style={{
                      fontSize: "8px",
                      color: GAME_COLORS.TEXT_SECONDARY,
                    }}
                  >
                    DIVE #{gameState.diveNumber}
                  </p>
                </div>

                {/* Right: Treasure */}
                <div
                  className="nes-container is-dark"
                  style={{
                    backgroundColor: GAME_COLORS.BACKGROUND_DARKER,
                    padding: "12px",
                    textAlign: "right",
                  }}
                >
                  <p
                    style={{
                      fontSize: "28px",
                      color: GAME_COLORS.TREASURE_GOLD,
                      marginBottom: "4px",
                    }}
                  >
                    ${gameState.currentTreasure}
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

              {/* Debug Mode: House Wallet Info */}
              {debugMode && (
                <div className="max-w-7xl mx-auto mt-4">
                  <div
                    className="nes-container is-dark is-rounded"
                    style={{ backgroundColor: "rgba(220, 38, 38, 0.9)" }}
                  >
                    <div className="flex justify-between items-center mb-4">
                      <span style={{ fontSize: "10px", color: "#fca5a5" }}>
                        DEBUG - HOUSE WALLET
                      </span>
                      <button
                        onClick={() => setDebugMode(false)}
                        className="nes-btn is-error"
                        style={{ padding: "4px 8px", fontSize: "8px" }}
                      >
                        X
                      </button>
                    </div>
                    <div
                      className="grid grid-cols-5 gap-2"
                      style={{ fontSize: "8px" }}
                    >
                      <div>
                        <div style={{ color: "#9ca3af" }}>Balance</div>
                        <div style={{ color: "#4ade80", fontWeight: "bold" }}>
                          ${houseWalletInfo.balance.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: "#9ca3af" }}>Reserved</div>
                        <div style={{ color: "#fb923c", fontWeight: "bold" }}>
                          ${houseWalletInfo.reservedFunds.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: "#9ca3af" }}>Available</div>
                        <div style={{ color: "#60a5fa", fontWeight: "bold" }}>
                          ${houseWalletInfo.availableFunds.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: "#9ca3af" }}>Paid Out</div>
                        <div style={{ color: "#f87171", fontWeight: "bold" }}>
                          ${houseWalletInfo.totalPaidOut.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: "#9ca3af" }}>Received</div>
                        <div style={{ color: "#c084fc", fontWeight: "bold" }}>
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
                {/* Stats Panel - Simplified */}
                <div
                  className="nes-container is-dark mb-4"
                  style={{
                    backgroundColor: GAME_COLORS.BACKGROUND_DARKER,
                    padding: "12px 16px",
                  }}
                >
                  <div className="flex justify-between items-center">
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
                        {(currentDiveStats.survivalProbability * 100).toFixed(
                          0
                        )}
                        %
                      </span>
                    </div>

                    {/* Kaplay Debug Toggle */}
                    <button
                      onClick={() => setKaplayDebug(!kaplayDebug)}
                      className={`nes-btn ${kaplayDebug ? "is-success" : "is-warning"}`}
                      style={{ padding: "6px 12px", fontSize: "8px" }}
                      title="Toggle Kaplay Debug Mode"
                    >
                      {kaplayDebug ? "DBG:ON" : "DBG"}
                    </button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      playSound("BUTTON_CLICK");
                      handleDiveDeeper();
                    }}
                    disabled={isProcessing}
                    className={`nes-btn ${isProcessing ? "is-disabled" : "is-error"} flex-1`}
                    style={{ fontSize: "16px", padding: "16px" }}
                  >
                    {isProcessing ? "DIVING..." : "DIVE DEEPER"}
                  </button>
                  <button
                    onClick={() => {
                      playSound("BUTTON_CLICK");
                      handleSurface();
                    }}
                    disabled={isProcessing}
                    className={`nes-btn ${isProcessing ? "is-disabled" : "is-success"} flex-1`}
                    style={{ fontSize: "16px", padding: "16px" }}
                  >
                    SURFACE
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </GameErrorBoundary>
  );
}
