"use client";

import { useEffect, useRef } from "react";
import kaplay from "kaplay";
import type { KAPLAYCtx } from "kaplay";
import { getDepthZone } from "@/lib/gameLogic";
import { AnimationType, type Shipwreck } from "@/lib/types";
import { SPRITE_CONFIGS } from "@/lib/spriteConfig";
import { GAME_COLORS } from "@/lib/gameColors";
import * as CONST from "./sceneConstants";
import { createBoat } from "./entities/boat";
import { createBubble } from "./entities/bubble";
import { createFish } from "./entities/fish";
import { createJellyfish } from "./entities/jellyfish";
import { createSeagull } from "./entities/seagull";
import { createAmbientPredator } from "./entities/predator";
import { createTreasureParticles } from "./entities/particles";
import { triggerDeathAnimation } from "./entities/death";
import { createLayerPart } from "./entities/parallax";
import { createCrab } from "./entities/crab";
import { createStarfish } from "./entities/starfish";
import { createPalmTree } from "./entities/palmtree";
import { createSurfacingScene } from "./scenes/SurfacingScene";

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
    if (isDivingRef.current !== isDiving) changes.push(`isDiving: ${isDivingRef.current} → ${isDiving}`);
    if (survivedRef.current !== survived) changes.push(`survived: ${survivedRef.current} → ${survived}`);
    if (shouldSurfaceRef.current !== shouldSurface) changes.push(`shouldSurface: ${shouldSurfaceRef.current} → ${shouldSurface}`);
    if (depthRef.current !== depth) changes.push(`depth: ${depthRef.current}m → ${depth}m`);
    if (treasureRef.current !== treasureValue) changes.push(`treasure: $${treasureRef.current} → $${treasureValue}`);
    if (isInOceanRef.current !== isInOcean) changes.push(`isInOcean: ${isInOceanRef.current} → ${isInOcean}`);

    if (changes.length > 0) {
      console.log('[CANVAS] 📊 Props changed:', changes.join(', '));
    }

    isDivingRef.current = isDiving;
    survivedRef.current = survived;
    shouldSurfaceRef.current = shouldSurface;
    depthRef.current = depth;
    treasureRef.current = treasureValue;
    isInOceanRef.current = isInOcean;
  }, [isDiving, survived, shouldSurface, depth, treasureValue, isInOcean]);

  useEffect(() => {
    console.log('[CANVAS] 🎬 OceanScene useEffect triggered');

    if (!canvasRef.current) {
      console.log('[CANVAS] ❌ No canvas ref!');
      return;
    }

    // Only initialize Kaplay once
    if (initializedRef.current && kRef.current) {
      console.log('[CANVAS] ⏭️  Already initialized, skipping');
      return;
    }

    // Clean up previous instance (in case of hot reload)
    if (kRef.current) {
      console.log('[CANVAS] 🧹 Cleaning up previous instance');
      try {
        kRef.current.quit();
      } catch (e) {
        // Ignore errors during cleanup
      }
      kRef.current = null;
    }

    console.log('[CANVAS] 🎨 Initializing Kaplay...');

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

    console.log('[CANVAS] ✅ Kaplay initialized!');
    kRef.current = k;
    initializedRef.current = true;

    // Load all sprites dynamically from config
    console.log('[CANVAS] 📦 Loading sprites from config...');

    SPRITE_CONFIGS.forEach((sprite) => {
      k.loadSprite(sprite.name, sprite.file, {
        sliceX: sprite.sliceX,
        sliceY: sprite.sliceY,
        anims: sprite.anims,
      });
      // console.log(`[CANVAS] ✅ Loaded ${sprite.name} (${sprite.sliceX}×${sprite.sliceY} = ${sprite.totalFrames} frames)`);
    });

    console.log('[CANVAS] ✅ All sprites loaded!');

    // CENTRALIZED Animation state (not per-object!)
    let diverY = k.height() / 2 - CONST.LAYOUT.DIVER_Y_OFFSET;
    const diverX = k.width() / 2;
    let isAnimating = false;
    let animationType: AnimationType = AnimationType.IDLE;
    let divingSpeed = 0;

    // Diving animation timing (centralized)
    let divingElapsed = 0;
    const divingDuration = CONST.ANIMATION_TIMINGS.DIVING_DURATION;

    // Treasure animation timing
    let treasurePulseTime = 0;

    // Boat creation moved to entities/boat.ts

    // ===== BEACH/SURFACE SCENE =====
    // NOTE: Beach scene logic can be extracted to scenes/BeachScene.ts for better organization
    k.scene("beach", () => {
      console.log('[CANVAS] 🏖️ Beach scene created!');

      // Sky gradient
      k.add([
        k.rect(k.width(), k.height() * CONST.LAYOUT.SKY_HEIGHT),
        k.pos(0, 0),
        k.color(...CONST.COLORS.SKY),
        k.z(CONST.Z_LAYERS.SKY),
      ]);

      // Sun
      const sun = k.add([
        k.circle(CONST.SCALES.SUN_RADIUS),
        k.pos(k.width() * CONST.LAYOUT.SUN_X, k.height() * CONST.LAYOUT.SUN_Y),
        k.color(...CONST.COLORS.SUN),
        k.z(CONST.Z_LAYERS.SUN),
      ]);

      // Rotating sun rays
      for (let i = 0; i < CONST.SPAWN_RATES.SUN_RAY_COUNT; i++) {
        const angle = (Math.PI * 2 * i) / CONST.SPAWN_RATES.SUN_RAY_COUNT;
        const sunRay = k.add([
          k.rect(CONST.SCALES.SUN_RAY_WIDTH, CONST.SCALES.SUN_RAY_LENGTH),
          k.pos(sun.pos.x, sun.pos.y),
          k.anchor("bot"),
          k.rotate(angle * (180 / Math.PI)),
          k.color(...CONST.COLORS.SUN_RAY),
          k.opacity(CONST.OPACITY.FOAM),
          k.z(CONST.Z_LAYERS.SUN),
        ]);

        sunRay.onUpdate(() => {
          sunRay.angle += CONST.MOTION.SUN_RAY_ROTATION_SPEED * k.dt();
        });
      }

      // Beach/sand - DIAGONAL with WAVY LEFT EDGE
      const waterSurfaceY = k.height() * CONST.LAYOUT.WATER_SURFACE_Y;
      const beachPoints: any[] = [];
      const waveAmplitude = CONST.SCALES.WAVE_AMPLITUDE;
      const waveFrequency = CONST.SCALES.WAVE_FREQUENCY;
      const beachStartY = waterSurfaceY;
      const beachBaseX = k.width() * CONST.LAYOUT.BEACH_BASE_X;

      // Top-right corner (start of beach) - at water surface level
      beachPoints.push(k.vec2(beachBaseX + waveAmplitude, beachStartY));

      // Wavy LEFT EDGE (water side) - vertical sine wave
      for (let y = beachStartY; y <= k.height(); y += CONST.SCALES.SHELL_SIZE) {
        const progress = (y - beachStartY) / (k.height() - beachStartY);
        const baseX = beachBaseX + progress * k.width() * CONST.LAYOUT.BEACH_DIAGONAL_WIDTH;
        const waveX = baseX + Math.sin(y * waveFrequency) * waveAmplitude;
        beachPoints.push(k.vec2(waveX, y));
      }

      // Bottom-right corner
      beachPoints.push(k.vec2(k.width(), k.height()));

      // Top-right corner (close polygon)
      beachPoints.push(k.vec2(k.width(), beachStartY));

      // Create beach polygon with wavy left edge
      k.add([
        k.polygon(beachPoints),
        k.pos(0, 0),
        k.color(...CONST.COLORS.BEACH),
        k.z(CONST.Z_LAYERS.BEACH),
      ]);

      // Add foam/wave line along beach LEFT edge (decorative white dots)
      for (let y = beachStartY; y <= k.height(); y += CONST.SCALES.SHELL_SIZE) {
        const progress = (y - beachStartY) / (k.height() - beachStartY);
        const baseX = beachBaseX + progress * k.width() * CONST.LAYOUT.BEACH_DIAGONAL_WIDTH;
        const waveX = baseX + Math.sin(y * waveFrequency) * waveAmplitude;

        k.add([
          k.circle(3),
          k.pos(waveX, y),
          k.color(...CONST.COLORS.FOAM),
          k.opacity(CONST.OPACITY.FOAM),
          k.z(CONST.Z_LAYERS.FOAM),
        ]);
      }

      // === BEACH DECORATIONS (on diagonal beach) ===

      // Multiple palm trees across the beach - NOW USING SPRITES!
      CONST.DECORATIONS.PALM_TREES.forEach((palm: any) => {
        createPalmTree(k, k.width() * palm.x, k.height() * palm.y, palm.scale, CONST.Z_LAYERS.LIGHT_RAYS);
      });

      // Rocks on beach (scattered on diagonal beach) - NOW USING SPRITES!
      CONST.DECORATIONS.ROCKS.forEach((rock, index) => {
        k.add([
          k.sprite("beachrock", { frame: index % 4 }), // Rotate through 4 rock variations
          k.pos(k.width() * rock.x, k.height() * rock.y),
          k.anchor("center"),
          k.scale(rock.scale),
          k.rotate(Math.random() * 360), // Random rotation for variety
          k.z(CONST.Z_LAYERS.SUN),
        ]);
      });

      // Add pebbles for extra detail
      CONST.DECORATIONS.PEBBLES.forEach((pebble: any, index: number) => {
        k.add([
          k.sprite("pebbles", { frame: index % 6 }),
          k.pos(k.width() * pebble.x, k.height() * pebble.y),
          k.anchor("center"),
          k.scale(1.5),
          k.z(CONST.Z_LAYERS.SUN),
        ]);
      });

      // Shells on beach (small decorative, on diagonal beach) - NOW USING SPRITES!
      CONST.DECORATIONS.SHELLS.forEach((shell, index) => {
        k.add([
          k.sprite("shell", { frame: index % 3 }), // Rotate through 3 shell variations
          k.pos(k.width() * shell.x, k.height() * shell.y),
          k.anchor("center"),
          k.scale(1.5),
          k.rotate(Math.random() * 360), // Random rotation
          k.z(CONST.Z_LAYERS.SUN),
        ]);
      });

      // Clouds in sky (fluffy)
      CONST.DECORATIONS.CLOUDS.forEach(cloud => {
        const cloudX = k.width() * cloud.x;
        const cloudY = k.height() * cloud.y;

        k.add([
          k.circle(CONST.SCALES.CLOUD_BASE * cloud.scale),
          k.pos(cloudX, cloudY),
          k.color(...CONST.COLORS.CLOUD),
          k.opacity(CONST.OPACITY.CLOUD),
          k.z(CONST.Z_LAYERS.BEACH),
        ]);
        k.add([
          k.circle((CONST.SCALES.CLOUD_BASE + 5) * cloud.scale),
          k.pos(cloudX + 15 * cloud.scale, cloudY),
          k.color(...CONST.COLORS.CLOUD),
          k.opacity(CONST.OPACITY.CLOUD),
          k.z(CONST.Z_LAYERS.BEACH),
        ]);
        k.add([
          k.circle((CONST.SCALES.CLOUD_BASE - 2) * cloud.scale),
          k.pos(cloudX + 30 * cloud.scale, cloudY),
          k.color(...CONST.COLORS.CLOUD),
          k.opacity(CONST.OPACITY.CLOUD),
          k.z(CONST.Z_LAYERS.BEACH),
        ]);
      });

      // Flying seagulls
      // Seagull creation moved to entities/seagull.ts

      // Spawn seagulls (now with sprite animation!)
      CONST.DECORATIONS.SEAGULLS.forEach(seagull => {
        createSeagull(k, k.width() * seagull.x, k.height() * seagull.y, seagull.speed);
      });

      // Spawn crabs on beach (NEW!)
      CONST.DECORATIONS.CRABS.forEach(crab => {
        createCrab(k, k.width() * crab.x, k.height() * crab.y, crab.direction, crab.speed, CONST.Z_LAYERS.SUN);
      });

      // Spawn starfish on beach (NEW!)
      CONST.DECORATIONS.STARFISH.forEach(starfish => {
        createStarfish(k, k.width() * starfish.x, k.height() * starfish.y, starfish.scale, CONST.Z_LAYERS.SUN);
      });

      // Create boat at water surface (LEFT SIDE - UI is on right)
      const boatBaseY = k.height() * CONST.LAYOUT.WATER_SURFACE_Y;
      const boatX = k.width() * CONST.LAYOUT.BOAT_X;
      const boat = createBoat(k, boatX, boatBaseY, CONST.Z_LAYERS.BOAT);

      // Boat bobbing animation
      boat.onUpdate(() => {
        boat.pos.y = boatBaseY + Math.sin(k.time() * CONST.MOTION.BOAT_BOB_SPEED) * CONST.MOTION.BOAT_BOB_AMPLITUDE;
        boat.angle = Math.sin(k.time() * CONST.MOTION.BOAT_ROCK_SPEED) * CONST.MOTION.BOAT_ROCK_AMPLITUDE;
      });

      // Diver standing on boat deck
      const diver = k.add([
        k.sprite("diver", { anim: "idle" }),
        k.pos(boatX, boatBaseY - 15),
        k.anchor("center"),
        k.scale(CONST.SCALES.DIVER),
        k.rotate(0),
        k.z(CONST.Z_LAYERS.DIVER),
      ]);

      // Diver follows boat movement
      diver.onUpdate(() => {
        diver.pos.x = boat.pos.x;
        diver.pos.y = boat.pos.y - 15;
        diver.angle = boat.angle * 0.5;
      });

      // Bubbles from diver
      k.loop(0.3, () => {
        if (Math.random() > 0.5) {
          const bubble = k.add([
            k.sprite("bubble", { frame: Math.floor(Math.random() * 10) }),
            k.pos(diver.pos.x + (Math.random() - 0.5) * 30, diver.pos.y),
            k.anchor("center"),
            k.scale(1.5),
            k.opacity(0.8),
            k.z(15),
            k.lifespan(2),
          ]);

          bubble.onUpdate(() => {
            bubble.pos.y -= 40 * k.dt();
            bubble.opacity -= k.dt() * 0.5;
          });
        }
      });

      // Transition to diving with animation when game starts
      let transitionStarted = false;
      k.onUpdate(() => {
        if (isInOceanRef.current && isDivingRef.current && !transitionStarted) {
          transitionStarted = true;
          console.log('[CANVAS] 🤿 Starting dive transition...');

          // Fade to black overlay
          const fadeOverlay = k.add([
            k.rect(k.width(), k.height()),
            k.pos(0, 0),
            k.color(...CONST.COLORS.FADE_BLACK),
            k.opacity(0),
            k.z(200),
          ]);

          // Diver jumps off boat animation
          let jumpProgress = 0;
          const jumpDuration = 1.0; // 1 second jump
          const originalY = diver.pos.y;

          const jumpInterval = k.onUpdate(() => {
            jumpProgress += k.dt() / jumpDuration;

            if (jumpProgress < 1) {
              // Parabolic jump arc
              const arc = Math.sin(jumpProgress * Math.PI) * 50;
              diver.pos.y = originalY - arc;
              diver.pos.x -= 30 * k.dt(); // Move left off boat
              diver.angle = jumpProgress * 90; // Rotate during jump

              // Fade to black
              fadeOverlay.opacity = jumpProgress * 0.8;
            } else {
              // Jump complete, transition to diving scene
              console.log('[CANVAS] ✅ Dive complete, switching scene...');
              jumpInterval.cancel();
              k.go("diving");
            }
          });
        }
      });
    });

    // ===== SURFACING SCENE ===== (Extracted to scenes/SurfacingScene.ts)
    createSurfacingScene({
      k,
      refs: { isDivingRef, survivedRef, shouldSurfaceRef, depthRef, treasureRef, isInOceanRef },
      hexToRgb
    });

    // ===== DIVING/UNDERWATER SCENE =====
    k.scene("diving", () => {
      console.log('[CANVAS] 🤿 Diving scene created!');

      // Get depth zone for colors
      let currentZone = getDepthZone(depth);
      let bgColor = hexToRgb(currentZone.color);
      let lightLevel = currentZone.light;

      // Background
      const bg = k.add([
        k.rect(k.width(), k.height()),
        k.pos(0, 0),
        k.color(bgColor.r * lightLevel, bgColor.g * lightLevel, bgColor.b * lightLevel),
        k.z(0),
      ]);

      // Fade-in overlay (smooth transition from beach)
      const fadeInOverlay = k.add([
        k.rect(k.width(), k.height()),
        k.pos(0, 0),
        k.color(...CONST.COLORS.FADE_BLACK),
        k.opacity(0.8),
        k.z(300),
      ]);

      // Fade in from black
      let fadeInProgress = 0;
      const fadeInDuration = 0.8; // 0.8 seconds
      const fadeInInterval = k.onUpdate(() => {
        fadeInProgress += k.dt() / fadeInDuration;
        if (fadeInProgress >= 1) {
          k.destroy(fadeInOverlay);
          fadeInInterval.cancel();
        } else {
          fadeInOverlay.opacity = 0.8 * (1 - fadeInProgress);
        }
      });

      // Splash effect at start (water entry)
      const splashParticles: any[] = [];
      for (let i = 0; i < 20; i++) {
        const angle = (Math.PI * 2 * i) / 20;
        const splash = k.add([
          k.circle(4 + Math.random() * 3),
          k.pos(k.width() * 0.25, k.height() * 0.3),
          k.color(...CONST.COLORS.SPLASH),
          k.opacity(0.8),
          k.z(250),
        ]);

        splashParticles.push({ obj: splash, angle, speed: 150 + Math.random() * 100 });
      }

      // Animate splash particles
      splashParticles.forEach(({ obj, angle, speed }) => {
        obj.onUpdate(() => {
          obj.pos.x += Math.cos(angle) * speed * k.dt();
          obj.pos.y += Math.sin(angle) * speed * k.dt();
          obj.opacity -= k.dt() * 2;

          if (obj.opacity <= 0) {
            k.destroy(obj);
          }
        });
      });

      // Darkness overlay
      const darknessOverlay = k.add([
        k.rect(k.width(), k.height()),
        k.pos(0, 0),
        k.color(...CONST.COLORS.FADE_BLACK),
        k.opacity(Math.min(depth / 500, 0.6)),
        k.z(1),
      ]);

      // INFINITE PARALLAX SCROLLING LAYERS
      // Based on: https://jslegenddev.substack.com/p/how-to-implement-infinite-parallax
      // Technique: Each layer has 2 parts that loop infinitely

      const CANVAS_HEIGHT = k.height();

      interface ParallaxLayer {
        speed: number;
        parts: Array<{
          container: any; // Container object that holds all sprites
          y: number; // Current Y position
        }>;
      }

      // Parallax layer creation moved to entities/parallax.ts

      const parallaxLayers: ParallaxLayer[] = [
        // Layer 1: Far background - Seaweed (slowest, darkest)
        {
          speed: CONST.PARALLAX.LAYERS[0].speed,
          parts: [
            {
              container: createLayerPart(
                k,
                CANVAS_HEIGHT,
                CONST.PARALLAX.LAYERS[0].sprite,
                CONST.PARALLAX.LAYERS[0].frames,
                CONST.PARALLAX.LAYERS[0].count,
                CONST.PARALLAX.LAYERS[0].scale as [number, number],
                CONST.PARALLAX.LAYERS[0].opacity as [number, number],
                CONST.PARALLAX.LAYERS[0].z,
                0
              ),
              y: 0,
            },
            {
              container: createLayerPart(
                k,
                CANVAS_HEIGHT,
                CONST.PARALLAX.LAYERS[0].sprite,
                CONST.PARALLAX.LAYERS[0].frames,
                CONST.PARALLAX.LAYERS[0].count,
                CONST.PARALLAX.LAYERS[0].scale as [number, number],
                CONST.PARALLAX.LAYERS[0].opacity as [number, number],
                CONST.PARALLAX.LAYERS[0].z,
                -CANVAS_HEIGHT
              ),
              y: -CANVAS_HEIGHT,
            },
          ],
        },
        // Layer 2: Mid background - Corals
        {
          speed: CONST.PARALLAX.LAYERS[1].speed,
          parts: [
            {
              container: createLayerPart(
                k,
                CANVAS_HEIGHT,
                CONST.PARALLAX.LAYERS[1].sprite,
                CONST.PARALLAX.LAYERS[1].frames,
                CONST.PARALLAX.LAYERS[1].count,
                CONST.PARALLAX.LAYERS[1].scale as [number, number],
                CONST.PARALLAX.LAYERS[1].opacity as [number, number],
                CONST.PARALLAX.LAYERS[1].z,
                0
              ),
              y: 0,
            },
            {
              container: createLayerPart(
                k,
                CANVAS_HEIGHT,
                CONST.PARALLAX.LAYERS[1].sprite,
                CONST.PARALLAX.LAYERS[1].frames,
                CONST.PARALLAX.LAYERS[1].count,
                CONST.PARALLAX.LAYERS[1].scale as [number, number],
                CONST.PARALLAX.LAYERS[1].opacity as [number, number],
                CONST.PARALLAX.LAYERS[1].z,
                -CANVAS_HEIGHT
              ),
              y: -CANVAS_HEIGHT,
            },
          ],
        },
        // Layer 3: Foreground - Seaweed (taller, faster)
        {
          speed: CONST.PARALLAX.LAYERS[2].speed,
          parts: [
            {
              container: createLayerPart(
                k,
                CANVAS_HEIGHT,
                CONST.PARALLAX.LAYERS[2].sprite,
                CONST.PARALLAX.LAYERS[2].frames,
                CONST.PARALLAX.LAYERS[2].count,
                CONST.PARALLAX.LAYERS[2].scale as [number, number],
                CONST.PARALLAX.LAYERS[2].opacity as [number, number],
                CONST.PARALLAX.LAYERS[2].z,
                0
              ),
              y: 0,
            },
            {
              container: createLayerPart(
                k,
                CANVAS_HEIGHT,
                CONST.PARALLAX.LAYERS[2].sprite,
                CONST.PARALLAX.LAYERS[2].frames,
                CONST.PARALLAX.LAYERS[2].count,
                CONST.PARALLAX.LAYERS[2].scale as [number, number],
                CONST.PARALLAX.LAYERS[2].opacity as [number, number],
                CONST.PARALLAX.LAYERS[2].z,
                -CANVAS_HEIGHT
              ),
              y: -CANVAS_HEIGHT,
            },
          ],
        },
      ];

      // Debris removed (emojis looked bad) - keeping empty array for compatibility
      const debrisList: any[] = [];

      // Light rays
      const lightRays: any[] = [];
      if (lightLevel > CONST.OPACITY.LIGHT_RAY_MIN) {
        for (let i = 0; i < CONST.SPAWN_RATES.LIGHT_RAY_COUNT; i++) {
          const lightRay = k.add([
            k.polygon([
              k.vec2(0, 0),
              k.vec2(20, 0),
              k.vec2(40, k.height()),
              k.vec2(20, k.height()),
            ]),
            k.pos(i * 180 + 50, 0),
            k.color(...CONST.COLORS.LIGHT_RAY),
            k.opacity(CONST.OPACITY.LIGHT_RAY_BASE * lightLevel),
            k.z(CONST.Z_LAYERS.LIGHT_RAYS),
          ]);
          lightRays.push({ obj: lightRay, offset: i });
        }
      }

      // Surface waves removed (text looked bad with parallax)

      // DIVER (using sprite)
      const diver = k.add([
        k.sprite("diver", { anim: "idle" }),
        k.pos(diverX, diverY),
        k.anchor("center"),
        k.scale(2.5), // Scale up 32x32 sprite to 80x80
        k.opacity(1),
        k.z(20),
      ]);

      // Treasure bag removed - cleaner underwater view with just diver

      // Message display removed - now handled by React overlay

      // Speed lines
      const speedLines: any[] = [];
      for (let i = 0; i < CONST.SPAWN_RATES.SPEED_LINE_COUNT; i++) {
        const line = k.add([
          k.rect(
            CONST.SPEED_LINES.WIDTH_MIN + Math.random() * CONST.SPEED_LINES.WIDTH_RANDOM,
            CONST.SPEED_LINES.HEIGHT_MIN + Math.random() * CONST.SPEED_LINES.HEIGHT_RANDOM
          ),
          k.pos(Math.random() * k.width(), Math.random() * k.height()),
          k.anchor("center"),
          k.color(...CONST.COLORS.SPEED_LINE),
          k.opacity(0),
          k.z(CONST.Z_LAYERS.SPEED_LINES),
        ]);
        speedLines.push(line);
      }

      // Bubbles - USING ANIMATED SPRITES!
      // Bubble creation moved to entities/bubble.ts

      k.loop(CONST.SPAWN_RATES.BUBBLE_INTERVAL, () => {
        if (!isAnimating && Math.random() > CONST.SPAWN_RATES.BUBBLE_CHANCE) {
          createBubble(k, diver.pos, divingSpeed);
        }
      });

      // Fish creation moved to entities/fish.ts

      k.loop(CONST.SPAWN_RATES.FISH_INTERVAL, () => {
        if (Math.random() > CONST.SPAWN_RATES.FISH_CHANCE && lightLevel > CONST.OPACITY.LIGHT_RAY_MIN) {
          createFish(k, lightLevel);
        }
      });

      // Jellyfish creation moved to entities/jellyfish.ts

      k.loop(CONST.SPAWN_RATES.JELLYFISH_INTERVAL, () => {
        if (Math.random() > CONST.SPAWN_RATES.JELLYFISH_CHANCE && lightLevel > CONST.OPACITY.LIGHT_RAY_MIN) {
          createJellyfish(k, lightLevel);
        }
      });

      // Predator creation moved to entities/predator.ts

      // Spawn predators based on depth
      k.loop(6, () => {
        if (depthRef.current > 100 && Math.random() > 0.6) {
          createAmbientPredator(k, depthRef.current, lightLevel);
        }
      });

      // Death animation moved to entities/death.ts

      // ======= CENTRALIZED MAIN UPDATE LOOP =======
      let lastLogTime = 0;

      k.onUpdate(() => {
        const now = Date.now();

        // Log state every 3 seconds (reduced frequency)
        if (now - lastLogTime > 3000) {
          console.log('[CANVAS] 🎮 State update', {
            animation: animationType,
            isAnimating,
            isDiving: isDivingRef.current,
            survived: survivedRef.current,
            depth: `${depthRef.current}m`,
            treasure: `$${treasureRef.current}`,
            divingSpeed: `${divingSpeed.toFixed(0)}px/s`,
            divingProgress: `${((divingElapsed / 2.5) * 100).toFixed(0)}%`
          });
          lastLogTime = now;
        }

        // Update background
        currentZone = getDepthZone(depthRef.current);
        bgColor = hexToRgb(currentZone.color);
        lightLevel = currentZone.light;

        bg.color = k.rgb(
          bgColor.r * lightLevel,
          bgColor.g * lightLevel,
          bgColor.b * lightLevel
        );

        darknessOverlay.opacity = Math.min(0.1 + (depthRef.current / 1000) * 0.7, 0.8);

        // ===== DIVING ANIMATION LOGIC =====
        if (animationType === AnimationType.DIVING) {
          divingElapsed += k.dt();
          const progress = Math.min(divingElapsed / divingDuration, 1);

          // Acceleration curve
          let acceleration;
          if (progress < 0.3) {
            acceleration = progress / 0.3;
          } else if (progress > 0.8) {
            acceleration = (1 - progress) / 0.2;
          } else {
            acceleration = 1;
          }

          const maxSpeed = 400;
          divingSpeed = maxSpeed * acceleration;

          // Update infinite parallax layers
          // Move each layer UP (negative Y) as we dive DOWN
          parallaxLayers.forEach(layer => {
            // Check if first part has scrolled off the TOP (negative Y)
            if (layer.parts[0].y < -CANVAS_HEIGHT) {
              // Move first part below second part
              layer.parts[0].y = layer.parts[1].y + CANVAS_HEIGHT;
              layer.parts[0].container.pos.y = layer.parts[0].y;
              // Swap parts array
              layer.parts.push(layer.parts.shift()!);
            }

            // Move both parts UP (negative direction) based on diving speed and layer speed
            layer.parts[0].y += divingSpeed * (layer.speed / 100) * k.dt();
            layer.parts[1].y += divingSpeed * (layer.speed / 100) * k.dt();
            layer.parts[0].container.pos.y = layer.parts[0].y;
            layer.parts[1].container.pos.y = layer.parts[1].y;
          });

          // Update speed lines
          speedLines.forEach(line => {
            line.opacity = Math.min(divingSpeed / 200, 0.8);
            line.pos.y += (divingSpeed * 1.5) * k.dt();

            if (line.pos.y > k.height() + 50) {
              line.pos.y = -50;
              line.pos.x = Math.random() * k.width();
            }
          });

          // Update debris
          debrisList.forEach(({ obj, driftSpeed }) => {
            obj.pos.y += (divingSpeed * 0.8) * k.dt();
            obj.pos.x += driftSpeed * k.dt();
            obj.angle += 30 * k.dt();

            if (obj.pos.y > k.height() + 100) {
              obj.pos.y = -200 - Math.random() * 200;
              obj.pos.x = Math.random() * k.width();
            }
          });

          // Extra bubbles
          if (Math.random() > 0.8) {
            createBubble(
              k,
              diver.pos,
              divingSpeed,
              diver.pos.x + (Math.random() - 0.5) * 60,
              diver.pos.y + (Math.random() - 0.5) * 40
            );
          }

          // Check completion
          if (progress >= 1) {
            console.log('[CANVAS] ✅ Diving animation complete!');
            isAnimating = false;
            animationType = AnimationType.IDLE;
            divingSpeed = 0;
            divingElapsed = 0;

            speedLines.forEach(line => {
              line.opacity = 0;
            });
          }
        }

        // ===== TREASURE ANIMATION LOGIC =====
        if (animationType === AnimationType.TREASURE) {
          treasurePulseTime += k.dt() * 8;

          if (treasurePulseTime > Math.PI * 4) {
            console.log('[CANVAS] ✅ Treasure animation complete! Staying underwater for next dive...');
            // Stay underwater - don't surface automatically
            isAnimating = false;
            animationType = AnimationType.IDLE;
            treasurePulseTime = 0;
          }
        }

        // ===== IDLE STATE - Gentle bobbing & slow parallax =====
        if (!isAnimating && animationType === AnimationType.IDLE) {
          const bobAmount = Math.sin(k.time() * 2) * 10;
          diver.pos.y = diverY + bobAmount;

          // Slow continuous parallax scroll when idle
          parallaxLayers.forEach(layer => {
            // Check if first part has scrolled off the bottom
            if (layer.parts[1].y > 0) {
              layer.parts[0].y = layer.parts[1].y - CANVAS_HEIGHT;
              layer.parts[0].container.pos.y = layer.parts[0].y;
              layer.parts.push(layer.parts.shift()!);
            }

            // Slow scroll at 10% speed
            const idleSpeed = layer.speed * 0.1;
            layer.parts[0].y += idleSpeed * k.dt();
            layer.parts[1].y += idleSpeed * k.dt();
            layer.parts[0].container.pos.y = layer.parts[0].y;
            layer.parts[1].container.pos.y = layer.parts[1].y;
          });
        }

        // Treasure bag removed - cleaner underwater view

        // Update light rays
        lightRays.forEach(({ obj, offset }) => {
          obj.pos.x = (offset * 180 + 50 + k.time() * 15) % k.width();
          obj.opacity = 0.08 * lightLevel * (1 - divingSpeed / 300);
        });

        // Message fading removed - now handled by React overlay

        // ===== ANIMATION TRIGGERS =====
        // Check for surfacing request (player cashed out)
        if (shouldSurfaceRef.current && !isAnimating && animationType === AnimationType.IDLE) {
          console.log('[CANVAS] 🌊 Player cashed out! Transitioning to surfacing...');
          k.go("surfacing", { treasure: treasureRef.current });
        } else if (isDivingRef.current && !isAnimating && animationType === AnimationType.IDLE) {
          console.log('[CANVAS] 🤿 Starting dive animation (2.5s)');
          isAnimating = true;
          animationType = AnimationType.DIVING;
          divingElapsed = 0;
        } else if (survivedRef.current === true && !isAnimating && animationType === AnimationType.IDLE) {
          console.log('[CANVAS] 💰 Treasure found! Playing success animation');
          isAnimating = true;
          animationType = AnimationType.TREASURE;
          treasurePulseTime = 0;
          createTreasureParticles(k, diver.pos.x, diver.pos.y);
          // Treasure chest animation removed - just showing particles
        } else if (survivedRef.current === false && !isAnimating && animationType === AnimationType.IDLE) {
          console.log('[CANVAS] 💀 Death triggered! Playing attack animation');
          triggerDeathAnimation(
            k,
            diver,
            depthRef.current,
            { isAnimating, animationType, divingSpeed },
            () => k.go("beach")
          );
        }
      });
    });

    // Start at beach scene
    console.log('[CANVAS] 🚀 Starting at beach...');
    k.go("beach");
    console.log('[CANVAS] ✅ Beach scene started!');

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
      console.log('[CANVAS] 🔧 Debug mode enabled');
      (kRef.current as any).debug.inspect = true;
    } else {
      console.log('[CANVAS] 🔧 Debug mode disabled');
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

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
    />
  );
}
