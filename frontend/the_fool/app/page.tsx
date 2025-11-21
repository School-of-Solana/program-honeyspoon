"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import OceanScene from "@/components/DeepSeaDiver/OceanScene";
import DebugPanel from "@/components/DebugWalletPanel";
import { GameErrorBoundary } from "@/components/DeepSeaDiver/GameErrorBoundary";
import { WalletMultiButton } from "@/components/WalletMultiButton";
import { BettingCard } from "@/components/game/BettingCard";
import { GameHUD } from "@/components/game/GameHUD";
import { LoadingScreen } from "@/components/LoadingScreen";

import { SolanaAirdropPanel } from "@/components/SolanaAirdropPanel";
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
import { useGameConfig } from "@/lib/hooks/useGameConfig";
import { useWalletBalance } from "@/lib/hooks/useGameQueries";
import { useWalletOrUserId } from "@/lib/hooks/useWalletOrUserId";
import { useWalletSSE } from "@/lib/hooks/useWalletSSE";
import { useGameChain } from "@/lib/hooks/useGameChain";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";
import { useDebouncedCallback } from "use-debounce";
import { playSound, getSoundManager, preloadSounds } from "@/lib/sounds";
import { useGameStore } from "@/lib/gameStore";
import { useChainWalletStore } from "@/lib/chainWalletStore";
import { solToLamports, lamportsToSol } from "@/lib/utils/solana";
import {
  parseServerError,
  getErrorAction,
  ErrorCategory,
  isErrorCategory,
  type GameError,
} from "@/lib/errorTypes";
import {
  parseSolanaError,
  formatSolanaErrorForUser,
} from "@/lib/utils/solanaErrorParser";

export default function Home() {
  // Fetch game config from blockchain
  const {
    config: gameConfig,
    loading: configLoading,
    error: configError,
  } = useGameConfig();

  // Use wallet integration hook (handles both Solana wallet and local userId)
  const {
    userId: walletOrUserId,
    isWalletMode,
    walletConnected,
  } = useWalletOrUserId();

  // Use game chain hook (provides wallet-connected chain instance)
  const { chain: gameChain, connected: isChainWalletConnected } =
    useGameChain();

  // Use Zustand store for userId and wallet balance
  const userIdFromStore = useChainWalletStore((state) => state.userId);
  const setUserId = useChainWalletStore((state) => state.setUserId);
  const userBalanceFromStore = useChainWalletStore(
    (state) => state.userBalance
  );

  // Use TanStack Query for wallet balance (with auto-refetch every 5s)
  const { data: walletData, isLoading: isLoadingWallet } =
    useWalletBalance(userIdFromStore);

  // Prefer TanStack Query balance over Zustand (more reliable and auto-refetches)
  // walletData comes from walletActions.getWalletInfo which returns userBalance
  const userBalance = walletData?.userBalance ?? userBalanceFromStore;
  const refreshBalance = useChainWalletStore((state) => state.refreshBalance);
  const isLoading = useChainWalletStore((state) => state.isLoading);
  const updateFromSSE = useChainWalletStore((state) => state.updateFromSSE);
  const setSSEConnected = useChainWalletStore((state) => state.setSSEConnected);
  const isSSEConnected = useChainWalletStore((state) => state.isSSEConnected);
  const lastUpdated = useChainWalletStore((state) => state.lastUpdated);
  const houseVaultBalance = useChainWalletStore(
    (state) => state.houseVaultBalance
  );
  const houseVaultReserved = useChainWalletStore(
    (state) => state.houseVaultReserved
  );

  // Use SSE for real-time updates
  const {
    data: sseData,
    isConnected: sseConnected,
    error: sseError,
  } = useWalletSSE(userIdFromStore);

  // Update store when SSE data arrives
  useEffect(() => {
    if (sseData) {
      updateFromSSE(sseData);
    }
  }, [sseData, updateFromSSE]);

  // Update SSE connection status in store
  useEffect(() => {
    setSSEConnected(sseConnected);
  }, [sseConnected, setSSEConnected]);

  // Convert nullable userId to non-null for GameState compatibility
  const userId = userIdFromStore || "";

  // Initialize userId on mount if not already set
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if we already have a userId in the store
    if (userIdFromStore) {
      console.log(
        "[GAME] Package: Using existing userId from store:",
        userIdFromStore.substring(0, 30) + "..."
      );
      return;
    }

    // Try to get userId from legacy localStorage
    const storedUserId = localStorage.getItem("game_user_id");
    if (storedUserId) {
      console.log(
        "[GAME] Package: Migrating userId from localStorage:",
        storedUserId.substring(0, 30) + "..."
      );
      setUserId(storedUserId);
      return;
    }

    // Check if there's already a user wallet in localStorage
    const walletsStr = localStorage.getItem("local_chain_wallets");
    if (walletsStr) {
      try {
        const wallets = JSON.parse(walletsStr);
        const userWallets = Object.keys(wallets).filter((addr) =>
          addr.startsWith("user_")
        );
        if (userWallets.length > 0) {
          console.log(
            "[GAME] Package: Using existing wallet from localStorage:",
            userWallets[0].substring(0, 30) + "..."
          );
          setUserId(userWallets[0]);
          // Clean up legacy storage
          localStorage.setItem("game_user_id", userWallets[0]);
          return;
        }
      } catch (e) {
        console.warn("[GAME] Failed to parse wallets from localStorage");
      }
    }

    // No existing userId found - generate new one
    const newUserId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    console.log(
      "[GAME] 🆕 Generated new userId:",
      newUserId.substring(0, 30) + "..."
    );
    setUserId(newUserId);
    localStorage.setItem("game_user_id", newUserId);
  }, [userIdFromStore, setUserId]);

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
    walletBalance: userBalance, // Use balance from Zustand store
  });

  // Sync gameState.walletBalance with Zustand store
  useEffect(() => {
    setGameState((prev) => ({ ...prev, walletBalance: userBalance }));
  }, [userBalance]);

  // Use config from blockchain, fallback to hardcoded if loading
  const betAmount = gameConfig?.FIXED_BET ?? GAME_CONFIG.FIXED_BET;
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
  const resetForNewGame = useGameStore((state) => state.resetForNewGame);

  // Read animation message from store for display
  const animationMessage = useGameStore((state) => state.animationMessage);

  // Sound state
  const [soundMuted, setSoundMuted] = useState(false); // Sound mute state

  // House wallet info for debug panel (now comes from Zustand store)
  const houseWalletInfo = {
    balance: houseVaultBalance,
    reservedFunds: houseVaultReserved,
    availableFunds: houseVaultBalance - houseVaultReserved,
    totalPaidOut: 0, // Not tracked yet
    totalReceived: 0, // Not tracked yet
  };

  // Track if session has been initialized (to prevent re-initialization on balance updates)
  const sessionInitializedRef = useRef(false);

  // Initialize session on mount (only once when userId is set AND balance is loaded)
  useEffect(() => {
    const initializeSession = async () => {
      if (!userId) return; // Wait for userId to be set

      // CRITICAL FIX: Wait for initial balance to load
      // userBalance starts at 0, but after initial fetch it will be 1000 (for new users)
      // We need to wait for lastUpdated to be set, which indicates the fetch completed
      if (!lastUpdated && userBalance === 0) {
        console.log("[GAME] ⏳ Waiting for initial balance fetch...");
        return;
      }

      // CRITICAL FIX: Only initialize once! Don't re-initialize on balance updates
      if (sessionInitializedRef.current) {
        console.log("[GAME] ⏭️ Session already initialized, skipping...");
        return;
      }

      const sessionId = await generateSessionId();

      setGameState((prev) => ({
        ...prev,
        sessionId,
        userId,
        walletBalance: userBalance, // Use balance from Zustand store
      }));

      sessionInitializedRef.current = true; // Mark as initialized

      console.log("[GAME] 🎮 Session initialized", {
        sessionId,
        userId: userId.substring(0, 30) + "...",
        walletBalance: userBalance,
        zustandStoreBalance: userBalance,
      });
    };

    initializeSession();
    // IMPORTANT: Depends on lastUpdated to wait for initial fetch
    // But uses ref to prevent re-initialization on subsequent updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, lastUpdated]);

  // Sync wallet balance to game state (without regenerating session ID)
  useEffect(() => {
    console.log("[GAME] Amount: Syncing balance to game state", {
      zustandBalance: userBalance,
      previousGameBalance: gameState.walletBalance,
    });
    setGameState((prev) => ({
      ...prev,
      walletBalance: userBalance,
    }));
  }, [userBalance]);

  // Initialize sounds on mount
  useEffect(() => {
    preloadSounds();
    setSoundMuted(getSoundManager().isMuted());
  }, []);

  // No longer needed - Zustand store auto-syncs from localStorage every 2 seconds

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
    console.log("[GAME] 🎮 handleStartGame called", {
      betAmount,
      userBalance,
      canStart: betAmount <= userBalance,
    });

    // Check if user has enough balance for fixed bet
    if (betAmount > userBalance) {
      console.log("[GAME] ERROR: Insufficient balance check failed!");
      showError(
        `Insufficient balance. Need ${betAmount} SOL, have ${userBalance.toFixed(4)} SOL`,
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
      // Check if using Solana mode - if so, use client-side chain (wallet required for signing)
      const useSolana = process.env.NEXT_PUBLIC_USE_SOLANA === "true";
      let newSessionId = gameState.sessionId; // Default to current session ID

      if (useSolana) {
        console.log(
          "[GAME] Link: Using client-side Solana chain for transaction"
        );

        try {
          // Call chain directly on client (wallet will sign)
          const betLamports = solToLamports(betAmount);
          const maxPayoutMultiplier =
            gameConfig?.MAX_PAYOUT_MULTIPLIER ??
            GAME_CONFIG.MAX_PAYOUT_MULTIPLIER;
          const maxPayoutLamports = solToLamports(
            betAmount * maxPayoutMultiplier
          );

          console.log("[GAME] Amount: Transaction parameters:", {
            betAmount: `${betAmount} SOL`,
            betLamports: betLamports.toString(),
            maxPayoutMultiplier,
            maxPayout: `${betAmount * maxPayoutMultiplier} SOL`,
            maxPayoutLamports: maxPayoutLamports.toString(),
          });

          // Get vault PDA
          console.log("[GAME] 🔑 Deriving vault PDA...");
          const { PublicKey } = await import("@solana/web3.js");
          const { getHouseVaultAddress } = await import("@/lib/solana/pdas");
          const programId = new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID!);
          const houseAuthPubkey = new PublicKey(
            process.env.NEXT_PUBLIC_HOUSE_AUTHORITY!
          );
          const [vaultPda] = getHouseVaultAddress(houseAuthPubkey, programId);

          console.log("[GAME] Vault: Vault PDA derived:", vaultPda.toBase58());
          console.log("[GAME] Note: Calling startSession with params:", {
            userPubkey: userId,
            betLamports: betLamports.toString(),
            maxPayoutLamports: maxPayoutLamports.toString(),
            houseVaultPda: vaultPda.toBase58(),
          });

          const { sessionPda, state } = await gameChain.startSession({
            userPubkey: userId,
            maxPayoutLamports: maxPayoutLamports,
            houseVaultPda: vaultPda.toBase58(),
          });

          console.log("[GAME] OK: Solana session started on-chain!", {
            sessionPda,
            currentTreasure: lamportsToSol(state.currentTreasure),
            currentTreasureLamports: state.currentTreasure.toString(),
            diveNumber: state.diveNumber,
            status: state.status,
          });

          // Store session ID for later use
          newSessionId = sessionPda;

          console.log("[GAME] Info: Session created with ID:", newSessionId);
        } catch (error) {
          console.error("[GAME] ERROR: Solana transaction failed:", error);

          // Debug: Log the raw error structure
          console.log("[GAME] DEBUG: Raw error object:", {
            type: typeof error,
            keys: error ? Object.keys(error) : [],
            message: error instanceof Error ? error.message : String(error),
            logs: (error as any)?.logs,
            err: (error as any)?.err,
          });

          // Parse Solana error with improved parser
          const parsed = parseSolanaError(error);
          console.log("[GAME] Parsed Solana Error:", {
            errorCode: parsed.errorCode,
            errorCodeNumber: parsed.errorCodeNumber,
            errorMessage: parsed.errorMessage,
            amounts: parsed.amounts,
            addresses: parsed.addresses,
            explorerLinks: parsed.explorerLinks,
          });

          console.log("[GAME] User-Friendly Error Message:");
          console.log(formatSolanaErrorForUser(parsed));

          console.error("[GAME] ERROR: Error details:", {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
          throw error; // Re-throw to be caught by outer try-catch
        }
      } else {
        // LocalGameChain mode - use server action
        console.log("[GAME] Link: Using server action for LocalGameChain");
        const result = await startGame(userId, gameState.sessionId);

        if (!result.success) {
          showError(
            result.error || "Failed to start game. Please try again.",
            "error"
          );
          setIsProcessing(false);
          return;
        }

        console.log("[GAME] OK: Game started successfully", {
          sessionId: result.sessionId,
        });

        // Store session ID for later use
        newSessionId = result.sessionId || gameState.sessionId;
      }

      // Refresh balance (SSE will handle this, but force update just in case)
      await refreshBalance();

      // Hide betting card with animation
      setShowBettingCard(false);

      // Wait for card to fade, then start game and show HUD
      setTimeout(() => {
        // OK: Reset all flow state for new game
        resetForNewGame();

        setGameState({
          isPlaying: true,
          diveNumber: 1,
          currentTreasure: 0,
          initialBet: betAmount,
          depth: 0,
          oxygenLevel: 100,
          sessionId: newSessionId, // OK: Use new session ID (from either Solana or LocalGameChain)
          userId: gameState.userId,
          discoveredShipwrecks: [],
          walletBalance: (gameState.walletBalance ?? 0) - betAmount,
        });
        setShowHUD(true);
        setLastShipwreck(undefined);
        setSurvived(undefined);
        setIsProcessing(false);
        console.log("[GAME] 🎮 HUD visible, game active - flags reset", {
          diveNumber: 1,
          treasure: betAmount,
          depth: 0,
          sessionId: newSessionId, // Log the new session ID
        });
      }, 500);
    } catch (error) {
      console.error("[GAME] ERROR: handleStartGame caught error:", error);

      // Try parsing as Solana error
      let userMessage = "Unknown error";
      try {
        const parsed = parseSolanaError(error);
        userMessage = formatSolanaErrorForUser(parsed);

        console.log("[GAME] Final Parsed Error for User:");
        console.log(userMessage);
        console.log("[GAME] Full Parsed Data:", parsed);
      } catch (parseError) {
        // Fall back to generic message if parsing fails
        userMessage = error instanceof Error ? error.message : "Unknown error";
      }

      const stack = error instanceof Error ? error.stack : undefined;

      console.error("[GAME] ERROR: Error details:", {
        message: userMessage,
        stack,
        type: error?.constructor?.name,
      });

      showError(
        `Game start failed:\n${userMessage}`,
        "error",
        () => window.location.reload(),
        "Reload Page"
      );
      setIsProcessing(false);
    }
  };

  // Wrap handleStartGame with debouncing to prevent double-clicks (2 second delay)
  const debouncedStartGame = useDebouncedCallback(
    handleStartGame,
    2000, // 2 second debounce
    { leading: true, trailing: false } // Execute immediately on first click, ignore subsequent clicks
  );

  // Dive deeper
  const handleDiveDeeper = async () => {
    if (isProcessing) {
      console.warn("[GAME] WARNING: Dive blocked - already processing");
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

      // STEP 2: Call server or blockchain to determine result
      const requestId = crypto.randomUUID();
      console.log("[GAME] 🎲 Calling for dive result...", {
        requestId,
        diveNumber: gameState.diveNumber,
        sessionId: gameState.sessionId.substring(0, 12) + "...",
      });

      // For first dive, use initialBet as the value to multiply; subsequent dives use accumulated treasure
      const valueToMultiply =
        gameState.currentTreasure === 0
          ? gameState.initialBet
          : gameState.currentTreasure;

      const useSolana = process.env.NEXT_PUBLIC_USE_SOLANA === "true";
      let result;

      if (useSolana) {
        // Solana mode - call chain directly (wallet will sign)
        console.log("[GAME] Link: Solana mode: calling playRound on-chain...");

        const { state, survived } = await gameChain.playRound({
          sessionPda: gameState.sessionId,
          userPubkey: gameState.userId,
        });

        // Get dive stats and generate shipwreck for depth calculation
        const { calculateDiveStats, generateShipwreck } = await import(
          "@/lib/gameLogic"
        );
        const diveStats = calculateDiveStats(gameState.diveNumber);
        const shipwreck = survived
          ? generateShipwreck(gameState.diveNumber, gameState.sessionId)
          : undefined;

        // Convert chain result to DiveResult format
        result = {
          success: true,
          randomRoll: 0, // Not exposed by chain
          threshold: 0, // Not exposed by chain
          survived,
          newTreasureValue: lamportsToSol(state.currentTreasure),
          totalTreasure: lamportsToSol(state.currentTreasure),
          diveNumber: state.diveNumber,
          depth: diveStats.depth,
          survivalProbability: 0.7, // Approximate - not exposed by chain
          multiplier: 1.5, // Approximate - not exposed by chain
          timestamp: Date.now(),
          shipwreck: shipwreck ? { ...shipwreck, discovered: true } : undefined,
        };

        console.log("[GAME] OK: On-chain playRound result:", {
          survived,
          newDiveNumber: state.diveNumber,
          treasure: lamportsToSol(state.currentTreasure),
        });
      } else {
        // LocalGameChain mode - use server action
        console.log("[GAME] Link: LocalGameChain mode: using server action...");
        result = await performDive(
          gameState.diveNumber,
          valueToMultiply,
          gameState.sessionId,
          gameState.userId
        );
      }

      console.log(`[GAME] Info: Server response`, {
        requestId,
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
        console.log(`[GAME] OK: Dive successful!`, {
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

        // OK: FIX: Don't reset survived here - the canvas handles it now
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
        console.log("[GAME] Amount: Wallet after loss", {
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
          sessionId: newSessionId, // OK: NEW SESSION ID
        }));

        // Canvas state will be reset by returnToBeach() from death animation
        // React just needs to clean up its own state
        setLastShipwreck(undefined);
        setSurvived(undefined);

        setTimeout(() => setShowBettingCard(true), 500);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("[GAME] ERROR: Dive error:", error);
      console.error("[GAME] ERROR: Error message:", message);

      // OK: NEW: Use typed error parsing instead of string matching
      const gameError = parseServerError(message);
      const action = getErrorAction(gameError);

      // Handle based on error category
      if (isErrorCategory(gameError, ErrorCategory.SESSION)) {
        // Session expired - reset to new game
        showError(
          gameError.message,
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
          action.primaryLabel
        );
      } else if (isErrorCategory(gameError, ErrorCategory.VALIDATION)) {
        // Data corruption - recommend support contact
        showError(
          gameError.message,
          "error",
          () => window.location.reload(),
          action.primaryLabel
        );
      } else {
        // Other errors - show generic message
        showError(`Dive failed: ${gameError.message}`, "error");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Surface with treasure
  const handleSurface = async () => {
    if (isProcessing) {
      console.warn("[GAME] WARNING: Surface blocked - already processing");
      return;
    }
    if (gameState.currentTreasure <= 0) {
      console.warn("[GAME] WARNING: Surface blocked - no treasure");
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
      const useSolana = process.env.NEXT_PUBLIC_USE_SOLANA === "true";
      let result;

      if (useSolana) {
        // Solana mode - call chain directly (wallet will sign)
        console.log("[GAME] Link: Solana mode: calling cashOut on-chain...");

        const { finalTreasureLamports, state } = await gameChain.cashOut({
          sessionPda: gameState.sessionId,
          userPubkey: gameState.userId,
        });

        // Convert to expected format
        const finalAmount = lamportsToSol(finalTreasureLamports);
        const profit = finalAmount - gameState.initialBet;

        result = {
          success: true,
          finalAmount,
          profit,
        };

        console.log("[GAME] OK: On-chain cashOut result:", {
          finalTreasureLamports: finalTreasureLamports.toString(),
          finalAmount,
          profit,
          sessionStatus: state.status,
        });
      } else {
        // LocalGameChain mode - use server action
        console.log("[GAME] Link: LocalGameChain mode: using server action...");
        result = await surfaceWithTreasure(
          gameState.currentTreasure,
          gameState.sessionId,
          gameState.userId
        );
      }

      console.log("[GAME] Amount: Surface result", {
        success: result.success,
        finalAmount: result.finalAmount,
        profit: result.profit,
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));
      setAnimationMessage("");

      if (result.success) {
        console.log(`[GAME] OK: Surface successful!`, {
          finalAmount: result.finalAmount,
          profit: result.profit,
          profitPercent: `${((result.profit / gameState.initialBet) * 100).toFixed(1)}%`,
        });

        // Update wallet balance
        const walletInfo = await getWalletInfo(userId);
        const profitOrLoss = result.profit >= 0 ? "profit" : "loss";
        console.log(`[GAME] Amount: Wallet after cashout (${profitOrLoss})`, {
          newBalance: walletInfo.balance,
          profitAmount: result.profit,
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
          sessionId: newSessionId, // OK: NEW SESSION ID
        }));

        // Canvas state will be reset by returnToBeach() from surfacing scene
        // React just needs to clean up its own state
        setLastShipwreck(undefined);
        setSurvived(undefined);
        setDepth(0);
        setTreasure(0);

        setTimeout(() => setShowBettingCard(true), 500);
      }
    } catch (error) {
      console.error("[GAME] ERROR: Cash out error:", error);
      console.error(
        "[GAME] ERROR: Error stack:",
        error instanceof Error ? error.stack : "No stack"
      );
      console.error("[GAME] ERROR: Error type:", error?.constructor?.name);

      const message = error instanceof Error ? error.message : "Unknown error";

      // OK: NEW: Use typed error parsing instead of string matching
      const gameError = parseServerError(message);
      const action = getErrorAction(gameError);

      // Handle based on error category
      if (isErrorCategory(gameError, ErrorCategory.VALIDATION)) {
        // Data corruption - recommend support contact
        showError(
          gameError.message,
          "error",
          () => window.location.reload(),
          action.primaryLabel
        );
      } else if (isErrorCategory(gameError, ErrorCategory.SESSION)) {
        // Session expired - reset to new game
        showError(
          gameError.message,
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
          action.primaryLabel
        );
      } else {
        // Other errors - show generic message
        showError(`Surface failed: ${gameError.message}`, "error");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const currentDiveStats: DiveStats | null = gameState.isPlaying
    ? calculateDiveStats(gameState.diveNumber)
    : null;

  // Show loading screen while initial data is being fetched
  const isInitialLoading = isLoadingWallet && userBalance === 0 && !userId;

  if (isInitialLoading) {
    return <LoadingScreen />;
  }

  return (
    <GameErrorBoundary>
      <div className="fixed inset-0 w-screen h-screen overflow-hidden">
        {/* Wallet Connection Button - Top Right */}
        <div className="absolute top-4 right-4 z-[100]">
          <WalletMultiButton />
        </div>

        {/* Full-screen Ocean Canvas */}
        <div
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: "auto" }}
        >
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
          <BettingCard
            userBalance={userBalance}
            betAmount={betAmount}
            isLoadingWallet={isLoadingWallet}
            isLoading={isLoading}
            soundMuted={soundMuted}
            gameConfig={gameConfig}
            onStartGame={handleStartGame}
            onRefreshBalance={refreshBalance}
            onToggleSound={() => {
              getSoundManager().toggleMute();
              setSoundMuted(getSoundManager().isMuted());
            }}
            onPlaySound={playSound}
          />
        )}

        {/* HUD Overlay (In-Game) */}
        {showHUD && currentDiveStats && (
          <GameHUD
            currentTreasure={gameState.currentTreasure}
            diveNumber={gameState.diveNumber}
            currentDiveStats={currentDiveStats}
            isProcessing={isProcessing}
            onDiveDeeper={handleDiveDeeper}
            onSurface={handleSurface}
            onPlaySound={playSound}
          />
        )}

        {/* Unified Debug Panel (only in development, Local mode only) */}
        {process.env.NODE_ENV === "development" && <DebugPanel />}

        {/* Solana Airdrop Panel (only when using Solana mode) */}
        <SolanaAirdropPanel />
      </div>
    </GameErrorBoundary>
  );
}
