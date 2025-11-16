/**
 * Game Store - Centralized State Management with Zustand
 *
 * This store replaces the fragile useRef + useEffect pattern with a single source of truth
 * that both React components and Kaplay scenes can read from and write to.
 */

import { create } from "zustand";
import type { Shipwreck } from "./types";

/**
 * Canvas/Scene State
 * Controls the Kaplay game canvas and scene transitions
 */
interface CanvasState {
  // Scene control
  isDiving: boolean; // Triggers diving animation
  isInOcean: boolean; // Prevents duplicate transitions
  shouldSurface: boolean; // Triggers surfacing animation
  survived?: boolean; // Death animation trigger (undefined = no animation)

  // Visual state
  depth: number;
  treasureValue: number;
  oxygenLevel: number;
  lastShipwreck?: Shipwreck;
  animationMessage: string; // Message overlay (e.g., "DIVING...")
}

/**
 * Game Logic State
 * Controls the game rules and progression
 */
interface GameLogicState {
  // Session
  isPlaying: boolean;
  sessionId: string;
  userId: string;

  // Game progression
  diveNumber: number;
  currentTreasure: number;
  initialBet: number;

  // Wallet
  walletBalance: number;

  // History
  discoveredShipwrecks: Shipwreck[];
}

/**
 * UI State
 * Controls what UI elements are visible
 */
interface UIState {
  showBettingCard: boolean;
  showHUD: boolean;
  isProcessing: boolean;
  debugMode: boolean;
  kaplayDebug: boolean;
  soundMuted: boolean;
}

/**
 * Complete Game State
 */
interface GameState extends CanvasState, GameLogicState, UIState {
  // Canvas Actions
  startDiveAnimation: () => void;
  enterOcean: () => void;
  endDiveAnimation: () => void;
  setDepth: (depth: number) => void;
  setTreasure: (amount: number) => void;
  setSurvived: (survived: boolean | undefined) => void;
  setLastShipwreck: (shipwreck: Shipwreck | undefined) => void;
  setAnimationMessage: (message: string) => void;
  triggerSurfacing: () => void;
  returnToBeach: () => void;
  resetForNewGame: () => void;

  // Game Logic Actions
  initializeSession: (
    userId: string,
    sessionId: string,
    balance: number
  ) => void;
  startGame: (betAmount: number) => void;
  completeDive: (result: {
    survived: boolean;
    totalTreasure: number;
    depth: number;
    shipwreck?: Shipwreck;
  }) => void;
  completeGame: (finalBalance: number) => void;

  // UI Actions
  setProcessing: (isProcessing: boolean) => void;
  toggleDebugMode: () => void;
  toggleKaplayDebug: () => void;
  toggleSound: () => void;

  // Reset
  reset: () => void;
}

/**
 * Initial State
 */
const initialState = {
  // Canvas State
  isDiving: false,
  isInOcean: false,
  shouldSurface: false,
  survived: undefined,
  depth: 0,
  treasureValue: 0,
  oxygenLevel: 100,
  lastShipwreck: undefined,
  animationMessage: "",

  // Game Logic State
  isPlaying: false,
  sessionId: "",
  userId: "",
  diveNumber: 0,
  currentTreasure: 0,
  initialBet: 0,
  walletBalance: 0,
  discoveredShipwrecks: [],

  // UI State
  showBettingCard: true,
  showHUD: false,
  isProcessing: false,
  debugMode: false,
  kaplayDebug: false,
  soundMuted: false,
};

/**
 * Game Store
 */
export const useGameStore = create<GameState>((set) => ({
  ...initialState,

  // ===== CANVAS ACTIONS =====

  /**
   * Start the diving animation
   * Sets isDiving=true but NOT isInOcean (let BeachScene set that on transition)
   */
  startDiveAnimation: () => {
    console.log("[STORE] 🤿 Starting dive animation");
    set({
      isDiving: true,
      animationMessage: "DIVING...",
      // ✅ FIX: Clear all other animation flags
      survived: undefined,
      shouldSurface: false,
    });
  },

  /**
   * Called by BeachScene when transitioning to diving
   * Prevents duplicate transitions
   */
  enterOcean: () => {
    console.log("[STORE] 🌊 Entering ocean");
    set({ isInOcean: true });
  },

  /**
   * End the diving animation
   */
  endDiveAnimation: () => {
    console.log("[STORE] ✅ Dive animation complete");
    set({
      isDiving: false,
      animationMessage: "",
    });
  },

  /**
   * Update depth (called continuously during dive)
   */
  setDepth: (depth: number) => {
    set({ depth });
  },

  /**
   * Update treasure value (visual only - game logic uses currentTreasure)
   */
  setTreasure: (amount: number) => {
    set({ treasureValue: amount });
  },

  /**
   * Set survival status (triggers death/success animations)
   */
  setSurvived: (survived: boolean | undefined) => {
    console.log("[STORE] 💀 Survival status:", survived);
    set({ survived });
  },

  /**
   * Set last discovered shipwreck
   */
  setLastShipwreck: (shipwreck: Shipwreck | undefined) => {
    set({ lastShipwreck: shipwreck });
  },

  /**
   * Set animation message overlay
   */
  setAnimationMessage: (message: string) => {
    set({ animationMessage: message });
  },

  /**
   * Trigger surfacing animation
   */
  triggerSurfacing: () => {
    console.log("[STORE] 🏄 Triggering surfacing");
    set({
      shouldSurface: true,
      animationMessage: "SURFACING!",
      // ✅ FIX: Clear other animation flags
      isDiving: false,
      survived: undefined,
    });
  },

  /**
   * Return to beach (called by surfacing/death scenes)
   * Resets flow state when returning from ocean to beach
   * Used: After surfacing complete, after death animation
   */
  returnToBeach: () => {
    console.log("[STORE] 🏖️ Returning to beach");
    set({
      isDiving: false,
      isInOcean: false,
      shouldSurface: false,
      survived: undefined,
      depth: 0,
      animationMessage: "",
    });
  },

  /**
   * Reset for new game (called when starting a new game session)
   * Clears all flow and visual state for a fresh start
   * Used: When user clicks "START GAME" button
   */
  resetForNewGame: () => {
    console.log("[STORE] 🎮 Resetting for new game");
    set({
      isDiving: false,
      isInOcean: false,
      shouldSurface: false,
      survived: undefined,
      depth: 0,
      treasureValue: 0,
      oxygenLevel: 100,
      lastShipwreck: undefined,
      animationMessage: "",
    });
  },

  // ===== GAME LOGIC ACTIONS =====

  /**
   * Initialize a new session
   */
  initializeSession: (userId: string, sessionId: string, balance: number) => {
    console.log("[STORE] 🆔 Initializing session", {
      userId,
      sessionId,
      balance,
    });
    set({
      userId,
      sessionId,
      walletBalance: balance,
    });
  },

  /**
   * Start a new game (after placing bet)
   */
  startGame: (betAmount: number) => {
    console.log("[STORE] 🎮 Starting new game", { betAmount });
    set({
      isPlaying: true,
      diveNumber: 1,
      currentTreasure: 0,
      initialBet: betAmount,
      depth: 0,
      oxygenLevel: 100,
      discoveredShipwrecks: [],
      treasureValue: 0,
      lastShipwreck: undefined,
      survived: undefined,
      showBettingCard: false,
      showHUD: true,
    });
  },

  /**
   * Complete a dive (survived or died)
   */
  completeDive: (result) => {
    const { survived, totalTreasure, depth, shipwreck } = result;

    console.log("[STORE] 📊 Dive complete", { survived, totalTreasure, depth });

    if (survived) {
      // Update game state for next dive
      set((state) => ({
        diveNumber: state.diveNumber + 1,
        currentTreasure: totalTreasure,
        treasureValue: totalTreasure,
        depth,
        oxygenLevel: Math.max(5, state.oxygenLevel - 4),
        discoveredShipwrecks: shipwreck
          ? [...state.discoveredShipwrecks, shipwreck]
          : state.discoveredShipwrecks,
        lastShipwreck: shipwreck,
      }));
    } else {
      // Death - game will reset after animation
      console.log("[STORE] 💀 Player died");
    }
  },

  /**
   * Complete the game (surfaced or died)
   * Resets to betting screen
   */
  completeGame: (finalBalance: number) => {
    console.log("[STORE] 🏁 Game complete", { finalBalance });
    set({
      isPlaying: false,
      diveNumber: 0,
      currentTreasure: 0,
      initialBet: 0,
      depth: 0,
      oxygenLevel: 100,
      discoveredShipwrecks: [],
      treasureValue: 0,
      lastShipwreck: undefined,
      survived: undefined,
      walletBalance: finalBalance,
      showHUD: false,
      showBettingCard: true,
      isDiving: false,
      isInOcean: false,
      shouldSurface: false,
    });
  },

  // ===== UI ACTIONS =====

  setProcessing: (isProcessing: boolean) => {
    set({ isProcessing });
  },

  toggleDebugMode: () => {
    set((state) => ({ debugMode: !state.debugMode }));
  },

  toggleKaplayDebug: () => {
    set((state) => ({ kaplayDebug: !state.kaplayDebug }));
  },

  toggleSound: () => {
    set((state) => ({ soundMuted: !state.soundMuted }));
  },

  // ===== RESET =====

  /**
   * Reset to initial state (for testing/debugging)
   */
  reset: () => {
    console.log("[STORE] 🔄 Resetting to initial state");
    set(initialState);
  },
}));

/**
 * Helper hook to get just the canvas state
 * Use this in Kaplay scenes
 */
export const useCanvasState = () =>
  useGameStore((state) => ({
    isDiving: state.isDiving,
    isInOcean: state.isInOcean,
    shouldSurface: state.shouldSurface,
    survived: state.survived,
    depth: state.depth,
    treasureValue: state.treasureValue,
    oxygenLevel: state.oxygenLevel,
    lastShipwreck: state.lastShipwreck,
  }));

/**
 * Helper to get store actions
 * Use this when you only need actions, not state
 */
export const useGameActions = () =>
  useGameStore((state) => ({
    // Canvas actions
    startDiveAnimation: state.startDiveAnimation,
    enterOcean: state.enterOcean,
    endDiveAnimation: state.endDiveAnimation,
    setDepth: state.setDepth,
    setTreasure: state.setTreasure,
    setSurvived: state.setSurvived,
    setLastShipwreck: state.setLastShipwreck,
    setAnimationMessage: state.setAnimationMessage,
    triggerSurfacing: state.triggerSurfacing,
    returnToBeach: state.returnToBeach,

    // Game logic actions
    startGame: state.startGame,
    completeDive: state.completeDive,
    completeGame: state.completeGame,

    // UI actions
    setProcessing: state.setProcessing,
  }));
