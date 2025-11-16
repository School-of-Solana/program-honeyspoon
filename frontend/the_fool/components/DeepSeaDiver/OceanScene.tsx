"use client";

import { useEffect, useRef } from "react";
import kaplay from "kaplay";
import type { KAPLAYCtx } from "kaplay";
import { AnimationType, type Shipwreck } from "@/lib/types";
import { SPRITE_CONFIGS } from "@/lib/spriteConfig";
import { GAME_COLORS } from "@/lib/gameColors";
import * as CONST from "./sceneConstants";
import { createSurfacingScene } from "./scenes/SurfacingScene";
import { createBeachScene } from "./scenes/BeachScene";
import { createDivingScene, type DivingSceneState } from "./scenes/DivingScene";

interface OceanSceneProps {
  depth: number;
  treasureValue: number;
  oxygenLevel: number;
  isDiving: boolean;
  survived?: boolean;
  shouldSurface?: boolean;
  lastShipwreck?: Shipwreck;
  onAnimationComplete?: () => void;
  debugMode?: boolean;
  animationMessage?: string; // NEW: Pass messages from React instead of Kaplay text
  isInOcean?: boolean; // Track if we're in the ocean scene (not on beach)
}

export default function OceanScene({
  depth,
  treasureValue,
  isDiving,
  survived,
  shouldSurface = false,
  debugMode = true,
  isInOcean = false,
}: OceanSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const kRef = useRef<KAPLAYCtx | null>(null);
  const initializedRef = useRef<boolean>(false);

  // Use refs to track prop changes inside Kaplay closures
  const isDivingRef = useRef(isDiving);
  const survivedRef = useRef(survived);
  const shouldSurfaceRef = useRef(shouldSurface);
  const depthRef = useRef(depth);
  const treasureRef = useRef(treasureValue);
  const isInOceanRef = useRef(isInOcean);

  // Update refs when props change
  useEffect(() => {
    const changes = [];
    if (isDivingRef.current !== isDiving)
      changes.push(`isDiving: ${isDivingRef.current} → ${isDiving}`);
    if (survivedRef.current !== survived)
      changes.push(`survived: ${survivedRef.current} → ${survived}`);
    if (shouldSurfaceRef.current !== shouldSurface)
      changes.push(
        `shouldSurface: ${shouldSurfaceRef.current} → ${shouldSurface}`
      );
    if (depthRef.current !== depth)
      changes.push(`depth: ${depthRef.current}m → ${depth}m`);
    if (treasureRef.current !== treasureValue)
      changes.push(`treasure: $${treasureRef.current} → $${treasureValue}`);
    if (isInOceanRef.current !== isInOcean)
      changes.push(`isInOcean: ${isInOceanRef.current} → ${isInOcean}`);

    if (changes.length > 0) {
      console.log("[CANVAS] 📊 Props changed:", changes.join(", "));
    }

    isDivingRef.current = isDiving;
    survivedRef.current = survived;
    shouldSurfaceRef.current = shouldSurface;
    depthRef.current = depth;
    treasureRef.current = treasureValue;
    isInOceanRef.current = isInOcean;
  }, [isDiving, survived, shouldSurface, depth, treasureValue, isInOcean]);

  useEffect(() => {
    console.log("[CANVAS] 🎬 OceanScene useEffect triggered");

    if (!canvasRef.current) {
      console.log("[CANVAS] ❌ No canvas ref!");
      return;
    }

    // Only initialize Kaplay once
    if (initializedRef.current && kRef.current) {
      console.log("[CANVAS] ⏭️  Already initialized, skipping");
      return;
    }

    // Clean up previous instance (in case of hot reload)
    if (kRef.current) {
      console.log("[CANVAS] 🧹 Cleaning up previous instance");
      try {
        kRef.current.quit();
      } catch (e) {
        // Ignore errors during cleanup
      }
      kRef.current = null;
    }

    console.log("[CANVAS] 🎨 Initializing Kaplay...");

    // Initialize Kaplay (fullscreen) - only once
    const k = kaplay({
      canvas: canvasRef.current,
      width: window.innerWidth,
      height: window.innerHeight,
      background: GAME_COLORS.KAPLAY.OCEAN_BG,
      debug: debugMode,
      stretch: true,
      letterbox: false,
    });

    console.log("[CANVAS] ✅ Kaplay initialized!");
    kRef.current = k;
    initializedRef.current = true;

    // Load all sprites dynamically from config
    console.log("[CANVAS] 📦 Loading sprites from config...");

    SPRITE_CONFIGS.forEach((sprite) => {
      k.loadSprite(sprite.name, sprite.file, {
        sliceX: sprite.sliceX,
        sliceY: sprite.sliceY,
        anims: sprite.anims,
      });
      // console.log(`[CANVAS] ✅ Loaded ${sprite.name} (${sprite.sliceX}×${sprite.sliceY} = ${sprite.totalFrames} frames)`);
    });

    console.log("[CANVAS] ✅ All sprites loaded!");

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

    // Boat creation moved to entities/boat.ts

    // ===== BEACH/SURFACE SCENE ===== (Extracted to scenes/BeachScene.ts)
    createBeachScene({
      k,
      refs: {
        isDivingRef,
        survivedRef,
        shouldSurfaceRef,
        depthRef,
        treasureRef,
        isInOceanRef,
      },
      hexToRgb,
    });

    // ===== SURFACING SCENE ===== (Extracted to scenes/SurfacingScene.ts)
    createSurfacingScene({
      k,
      refs: {
        isDivingRef,
        survivedRef,
        shouldSurfaceRef,
        depthRef,
        treasureRef,
        isInOceanRef,
      },
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
        refs: {
          isDivingRef,
          survivedRef,
          shouldSurfaceRef,
          depthRef,
          treasureRef,
          isInOceanRef,
        },
        hexToRgb,
      },
      divingState,
      depth
    );

    // Start at beach scene
    console.log("[CANVAS] 🚀 Starting at beach...");
    k.go("beach");
    console.log("[CANVAS] ✅ Beach scene started!");

    // Cleanup only on unmount
    return () => {
      if (kRef.current) {
        try {
          kRef.current.quit();
        } catch (e) {
          // Ignore errors during cleanup
        }
        kRef.current = null;
        initializedRef.current = false;
      }
    };
  }, []);

  // Toggle Kaplay debug mode
  useEffect(() => {
    if (!kRef.current) return;

    // Kaplay's debug mode can be toggled via debug.inspect
    if (debugMode) {
      console.log("[CANVAS] 🔧 Debug mode enabled");
      (kRef.current as any).debug.inspect = true;
    } else {
      console.log("[CANVAS] 🔧 Debug mode disabled");
      (kRef.current as any).debug.inspect = false;
    }
  }, [debugMode]);

  // Trigger animations when props change
  useEffect(() => {
    if (!kRef.current) return;
  }, [depth, treasureValue, isDiving, survived]);

  // Helper function
  function hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 74, g: 144, b: 226 };
  }

  return <canvas ref={canvasRef} className="w-full h-full" />;
}
