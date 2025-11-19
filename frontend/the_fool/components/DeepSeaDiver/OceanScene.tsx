"use client";

import { useEffect, useRef } from "react";
import kaplay from "kaplay";
import type { KAPLAYCtx } from "kaplay";
import { AnimationType } from "@/lib/types";
import { SPRITE_CONFIGS } from "@/lib/spriteConfig";
import { GAME_COLORS } from "@/lib/gameColors";
import * as CONST from "./sceneConstants";
import { createSurfacingScene } from "./scenes/SurfacingScene";
import { createBeachScene } from "./scenes/BeachScene";
import { createDivingScene, type DivingSceneState } from "./scenes/DivingScene";
import { useGameStore } from "@/lib/gameStore";
import { logger } from "@/lib/logger";

interface OceanSceneProps {
  // No more state props! Just config options
  debugMode?: boolean;
}

export default function OceanScene({ debugMode = true }: OceanSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const kRef = useRef<KAPLAYCtx | null>(null);
  const initializedRef = useRef<boolean>(false);

  // Subscribe to only the Kaplay debug setting from store
  const kaplayDebug = useGameStore((state) => state.kaplayDebug);

  // Helper function - defined before useEffect to avoid hoisting issues
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 74, g: 144, b: 226 };
  };

  useEffect(() => {
    // Canvas logging is now controlled by the centralized logger
    logger.canvas.debug("🎬 OceanScene useEffect triggered");
    logger.canvas.debug("OK: Using Zustand store - no more refs!");

    if (!canvasRef.current) {
      logger.canvas.debug("ERROR: No canvas ref!");
      return;
    }

    // Only initialize Kaplay once
    if (initializedRef.current && kRef.current) {
      logger.canvas.debug("⏭️  Already initialized, skipping");
      return;
    }

    // Clean up previous instance (in case of hot reload)
    if (kRef.current) {
      logger.canvas.debug("🧹 Cleaning up previous instance");
      try {
        kRef.current.quit();
      } catch {
        // Ignore errors during cleanup
      }
      kRef.current = null;
    }

    logger.canvas.debug("🎨 Initializing Kaplay...");

    // Initialize Kaplay (fullscreen) - only once
    const k = kaplay({
      canvas: canvasRef.current,
      width: window.innerWidth,
      height: window.innerHeight,
      background: GAME_COLORS.KAPLAY.OCEAN_BG,
      debug: debugMode,
      stretch: true,
      letterbox: false,
      // Enable cursor on canvas
      pixelDensity: window.devicePixelRatio || 1,
    });

    logger.canvas.debug("OK: Kaplay initialized!");
    kRef.current = k;
    initializedRef.current = true;

    // Load all sprites dynamically from config
    logger.canvas.debug("Package: Loading sprites from config...");

    SPRITE_CONFIGS.forEach((sprite) => {
      k.loadSprite(sprite.name, sprite.file, {
        sliceX: sprite.sliceX,
        sliceY: sprite.sliceY,
        anims: sprite.anims,
      });
    });

    logger.canvas.debug("OK: All sprites loaded!");

    // CENTRALIZED Animation state (not per-object!)
    const diverY = k.height() / 2 - CONST.LAYOUT.DIVER_Y_OFFSET;
    const diverX = k.width() / 2;
    const isAnimating = false;
    const animationType: AnimationType = AnimationType.IDLE;
    const divingSpeed = 0;

    // Diving animation timing (centralized)
    const divingElapsed = 0;
    const divingDuration = CONST.ANIMATION_TIMINGS.DIVING_DURATION;

    // Treasure animation timing
    const treasurePulseTime = 0;

    // ===== BEACH/SURFACE SCENE ===== (Extracted to scenes/BeachScene.ts)
    // No more refs! Scenes read directly from the store
    createBeachScene({
      k,
      hexToRgb,
    });

    // ===== SURFACING SCENE ===== (Extracted to scenes/SurfacingScene.ts)
    createSurfacingScene({
      k,
      hexToRgb,
    });

    // Create state object for diving scene
    const divingState: DivingSceneState = {
      diverY,
      diverX,
      isAnimating,
      animationType,
      divingSpeed,
      divingElapsed,
      divingDuration,
      treasurePulseTime,
    };

    // ===== DIVING/UNDERWATER SCENE ===== (Extracted to scenes/DivingScene.ts)
    createDivingScene(
      {
        k,
        hexToRgb,
      },
      divingState
    );

    // Start at beach scene
    logger.canvas.debug("Launch: Starting at beach...");
    k.go("beach");
    logger.canvas.debug("OK: Beach scene started!");

    // Cleanup only on unmount
    return () => {
      if (kRef.current) {
        try {
          kRef.current.quit();
        } catch {
          // Ignore errors during cleanup
        }
        kRef.current = null;
        initializedRef.current = false;
      }
    };
  }, [debugMode]);

  // Toggle Kaplay debug mode
  useEffect(() => {
    if (!kRef.current) return;

    // Kaplay's debug mode can be toggled via debug.inspect
    if (kaplayDebug) {
      logger.canvas.debug("🔧 Kaplay debug mode enabled");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (kRef.current as any).debug.inspect = true;
    } else {
      logger.canvas.debug("🔧 Kaplay debug mode disabled");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (kRef.current as any).debug.inspect = false;
    }
  }, [kaplayDebug]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{
        cursor: "default",
        pointerEvents: "auto",
      }}
    />
  );
}
