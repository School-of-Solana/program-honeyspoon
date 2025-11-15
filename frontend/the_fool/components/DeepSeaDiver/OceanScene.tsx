"use client";

import { useEffect, useRef } from "react";
import kaplay from "kaplay";
import type { KAPLAYCtx } from "kaplay";
import { getDepthZone } from "@/lib/gameLogic";
import type { Shipwreck } from "@/lib/types";
import { SPRITE_CONFIGS, getSpriteConfig } from "@/lib/spriteConfig";

interface OceanSceneProps {
  depth: number;
  treasureValue: number;
  oxygenLevel: number;
  isDiving: boolean;
  survived?: boolean;
  shouldSurface?: boolean; // NEW: Only surface when player cashes out
  lastShipwreck?: Shipwreck;
  onAnimationComplete?: () => void;
  debugMode?: boolean;
}

export default function OceanScene({
  depth,
  treasureValue,
  isDiving,
  survived,
  shouldSurface = false,
  debugMode = true,
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

  // Update refs when props change
  useEffect(() => {
    const changes = [];
    if (isDivingRef.current !== isDiving) changes.push(`isDiving: ${isDivingRef.current} → ${isDiving}`);
    if (survivedRef.current !== survived) changes.push(`survived: ${survivedRef.current} → ${survived}`);
    if (shouldSurfaceRef.current !== shouldSurface) changes.push(`shouldSurface: ${shouldSurfaceRef.current} → ${shouldSurface}`);
    if (depthRef.current !== depth) changes.push(`depth: ${depthRef.current}m → ${depth}m`);
    if (treasureRef.current !== treasureValue) changes.push(`treasure: $${treasureRef.current} → $${treasureValue}`);

    if (changes.length > 0) {
      console.log('[CANVAS] 📊 Props changed:', changes.join(', '));
    }

    isDivingRef.current = isDiving;
    survivedRef.current = survived;
    shouldSurfaceRef.current = shouldSurface;
    depthRef.current = depth;
    treasureRef.current = treasureValue;
  }, [isDiving, survived, shouldSurface, depth, treasureValue]);

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
      background: [20, 40, 80],
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
      console.log(`[CANVAS] ✅ Loaded ${sprite.name} (${sprite.sliceX}×${sprite.sliceY} = ${sprite.totalFrames} frames)`);
    });

    // Legacy aliases for existing code
    k.loadSprite("fish", "/sprites/fish1.png", {
      sliceX: 8,
      sliceY: 4,
      anims: {
        swim: { from: 0, to: 7, loop: true, speed: 10 },
      },
    });
    k.loadSprite("rock", "/sprites/tiles.png", {
      sliceX: 11,
      sliceY: 13,
    });
    k.loadSprite("coral", "/sprites/corals.png", {
      sliceX: 4,
      sliceY: 7,
    });

    console.log('[CANVAS] ✅ All sprites loaded!');

    // CENTRALIZED Animation state (not per-object!)
    let diverY = k.height() / 2 - 100;
    const diverX = k.width() / 2;
    let isAnimating = false;
    let animationType: 'idle' | 'diving' | 'treasure' | 'death' = 'idle';
    let messageOpacity = 0;
    let divingSpeed = 0;

    // Diving animation timing (centralized)
    let divingElapsed = 0;
    const divingDuration = 2.5;

    // Treasure animation timing
    let treasurePulseTime = 0;

    // Helper function to create a boat using shapes
    function createBoat(x: number, y: number, zIndex: number = 10) {
      const boat = k.add([
        k.pos(x, y),
        k.anchor("center"),
        k.rotate(0),
        k.opacity(1),
        k.z(zIndex),
      ]);

      // Boat hull (brown wooden boat)
      const hull = boat.add([
        k.polygon([
          k.vec2(-60, 0),   // Left top
          k.vec2(-70, 20),  // Left bottom (wider)
          k.vec2(70, 20),   // Right bottom
          k.vec2(60, 0),    // Right top
        ]),
        k.pos(0, 0),
        k.color(101, 67, 33), // Dark brown
        k.outline(3, k.rgb(70, 40, 20)),
      ]);

      // Deck planks (lighter wood)
      for (let i = -50; i < 60; i += 15) {
        boat.add([
          k.rect(12, 5),
          k.pos(i, -2),
          k.color(139, 90, 43), // Lighter brown
          k.anchor("center"),
        ]);
      }

      // Boat rail on left
      boat.add([
        k.rect(3, 25),
        k.pos(-55, -10),
        k.color(101, 67, 33),
        k.anchor("center"),
      ]);

      // Boat rail on right
      boat.add([
        k.rect(3, 25),
        k.pos(55, -10),
        k.color(101, 67, 33),
        k.anchor("center"),
      ]);

      // Mast (thin pole) - fixed anchor point
      boat.add([
        k.rect(4, 50),
        k.pos(-20, -25), // Position at bottom of mast
        k.color(101, 67, 33),
        k.anchor("bot"), // Anchor at bottom of mast
      ]);

      // Small flag/sail (triangular) - positioned at top of mast
      boat.add([
        k.polygon([
          k.vec2(0, 0),
          k.vec2(30, 10),
          k.vec2(0, 20),
        ]),
        k.pos(-20, -75), // At top of mast (-25 -50 = -75)
        k.color(200, 50, 50), // Red flag
        k.outline(1, k.rgb(150, 30, 30)),
      ]);

      // Anchor rope coil (decorative circle)
      boat.add([
        k.circle(5),
        k.pos(30, -5),
        k.color(150, 120, 80),
        k.outline(2, k.rgb(100, 80, 50)),
      ]);

      return boat;
    }

    // ===== BEACH/SURFACE SCENE =====
    k.scene("beach", () => {
      console.log('[CANVAS] 🏖️ Beach scene created!');
      
      // Sky gradient
      k.add([
        k.rect(k.width(), k.height() * 0.6),
        k.pos(0, 0),
        k.color(135, 206, 250), // Sky blue
        k.z(0),
      ]);
      
      // Sun
      const sun = k.add([
        k.circle(50),
        k.pos(k.width() * 0.8, k.height() * 0.15),
        k.color(255, 220, 100),
        k.z(2),
      ]);
      
      // Rotating sun rays
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8;
        const rayLength = 80;
        const sunRay = k.add([
          k.rect(8, rayLength),
          k.pos(sun.pos.x, sun.pos.y),
          k.anchor("bot"),
          k.rotate(angle * (180 / Math.PI)),
          k.color(255, 240, 150),
          k.opacity(0.6),
          k.z(2),
        ]);
        
        sunRay.onUpdate(() => {
          sunRay.angle += 20 * k.dt();
        });
      }
      
      // Water surface line (matches beach top edge)
      const waterSurfaceY = k.height() * 0.6;
      k.add([
        k.rect(k.width(), 4),
        k.pos(0, waterSurfaceY),
        k.color(100, 150, 255),
        k.z(5),
      ]);
      
      // Beach/sand - DIAGONAL with WAVY LEFT EDGE (more water, less beach)
      // Create wavy shoreline using polygon with sine wave on LEFT EDGE
      const beachPoints: any[] = [];
      const waveAmplitude = 40; // Wave depth (horizontal)
      const waveFrequency = 0.008; // Wave density (vertical)
      const beachStartY = waterSurfaceY; // Beach starts at SAME height as water surface
      const beachBaseX = k.width() * 0.45; // Base position (45% from left)
      
      // Top-right corner (start of beach) - at water surface level
      beachPoints.push(k.vec2(beachBaseX + waveAmplitude, beachStartY));
      
      // Wavy LEFT EDGE (water side) - vertical sine wave
      for (let y = beachStartY; y <= k.height(); y += 10) {
        const progress = (y - beachStartY) / (k.height() - beachStartY);
        // Diagonal: beach edge moves right as we go down
        const baseX = beachBaseX + progress * k.width() * 0.15; // Diagonal from 45% to 60%
        const waveX = baseX + Math.sin(y * waveFrequency) * waveAmplitude; // Add wave
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
        k.color(194, 178, 128), // Sandy color
        k.z(1),
      ]);
      
      // Add foam/wave line along beach LEFT edge (decorative white dots)
      for (let y = beachStartY; y <= k.height(); y += 10) {
        const progress = (y - beachStartY) / (k.height() - beachStartY);
        const baseX = beachBaseX + progress * k.width() * 0.15;
        const waveX = baseX + Math.sin(y * waveFrequency) * waveAmplitude;
        
        k.add([
          k.circle(3),
          k.pos(waveX, y),
          k.color(255, 255, 255),
          k.opacity(0.6),
          k.z(7),
        ]);
      }
      
      // === BEACH DECORATIONS (on diagonal beach) ===
      
      // Palm tree on far right (on beach)
      const palmX = k.width() * 0.85;
      const palmY = k.height() * 0.63; // Adjusted for diagonal beach
      
      // Palm trunk
      k.add([
        k.rect(15, 80),
        k.pos(palmX, palmY),
        k.anchor("top"),
        k.color(101, 67, 33),
        k.z(3),
      ]);
      
      // Palm leaves (6 leaves in circle) - using stretched rectangles
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * 2 * i) / 6;
        k.add([
          k.rect(40, 15),
          k.pos(palmX + Math.cos(angle) * 20, palmY + Math.sin(angle) * 20),
          k.anchor("center"),
          k.rotate(angle * (180 / Math.PI)),
          k.color(34, 139, 34), // Forest green
          k.z(3),
        ]);
      }
      
      // Rocks on beach (scattered on diagonal beach)
      const rockPositions = [
        { x: 0.50, y: 0.68, size: 20 },
        { x: 0.62, y: 0.75, size: 15 },
        { x: 0.75, y: 0.78, size: 18 },
        { x: 0.88, y: 0.82, size: 12 },
      ];
      
      rockPositions.forEach(rock => {
        k.add([
          k.circle(rock.size),
          k.pos(k.width() * rock.x, k.height() * rock.y),
          k.color(100, 100, 100),
          k.outline(2, k.rgb(70, 70, 70)),
          k.z(2),
        ]);
      });
      
      // Shells on beach (small decorative, on diagonal beach)
      const shellPositions = [
        { x: 0.52, y: 0.65 },
        { x: 0.64, y: 0.70 },
        { x: 0.72, y: 0.76 },
        { x: 0.80, y: 0.80 },
        { x: 0.92, y: 0.85 },
      ];
      
      shellPositions.forEach(shell => {
        k.add([
          k.polygon([
            k.vec2(0, 0),
            k.vec2(8, -3),
            k.vec2(10, 4),
            k.vec2(5, 8),
            k.vec2(0, 6),
          ]),
          k.pos(k.width() * shell.x, k.height() * shell.y),
          k.color(255, 240, 220),
          k.outline(1, k.rgb(200, 180, 160)),
          k.z(2),
        ]);
      });
      
      // Clouds in sky (fluffy)
      const cloudPositions = [
        { x: 0.2, y: 0.15, scale: 1 },
        { x: 0.5, y: 0.25, scale: 0.8 },
        { x: 0.75, y: 0.12, scale: 1.2 },
      ];
      
      cloudPositions.forEach(cloud => {
        // Cloud made of 3 circles
        const cloudX = k.width() * cloud.x;
        const cloudY = k.height() * cloud.y;
        
        k.add([
          k.circle(20 * cloud.scale),
          k.pos(cloudX, cloudY),
          k.color(255, 255, 255),
          k.opacity(0.8),
          k.z(1),
        ]);
        k.add([
          k.circle(25 * cloud.scale),
          k.pos(cloudX + 15 * cloud.scale, cloudY),
          k.color(255, 255, 255),
          k.opacity(0.8),
          k.z(1),
        ]);
        k.add([
          k.circle(18 * cloud.scale),
          k.pos(cloudX + 30 * cloud.scale, cloudY),
          k.color(255, 255, 255),
          k.opacity(0.8),
          k.z(1),
        ]);
      });
      
      // Flying seagulls
      function createSeagull(startX: number, startY: number, speed: number) {
        const seagull = k.add([
          k.polygon([
            k.vec2(0, 0),
            k.vec2(-10, -5),
            k.vec2(-8, 0),
            k.vec2(0, -2),
            k.vec2(8, 0),
            k.vec2(10, -5),
          ]),
          k.pos(startX, startY),
          k.color(255, 255, 255),
          k.outline(1, k.rgb(200, 200, 200)),
          k.z(4),
        ]);
        
        seagull.onUpdate(() => {
          seagull.pos.x += speed * k.dt();
          seagull.pos.y += Math.sin(k.time() * 3 + startX) * 20 * k.dt();
          
          // Wrap around screen
          if (seagull.pos.x > k.width() + 50) {
            seagull.pos.x = -50;
          }
        });
        
        return seagull;
      }
      
      // Spawn 3 seagulls
      createSeagull(k.width() * 0.3, k.height() * 0.2, 50);
      createSeagull(k.width() * 0.6, k.height() * 0.15, 60);
      createSeagull(k.width() * 0.1, k.height() * 0.25, 45);
      
      // Animated waves at water surface
      for (let i = 0; i < 5; i++) {
        const baseY = k.height() * 0.6;
        const wave = k.add([
          k.rect(k.width() / 5 + 50, 3),
          k.pos(i * (k.width() / 5), baseY),
          k.color(80, 140, 255),
          k.opacity(0.7),
          k.z(6),
        ]);
        
        wave.onUpdate(() => {
          wave.pos.y = baseY + Math.sin(k.time() * 2 + i * 0.5) * 5;
        });
      }
      
      // Create boat at water surface (LEFT SIDE - UI is on right)
      const boatBaseY = k.height() * 0.6;
      const boatX = k.width() * 0.25; // 25% from left (leaves right side clear for UI)
      const boat = createBoat(boatX, boatBaseY, 18);
      
      // Boat bobbing animation (follows wave motion)
      boat.onUpdate(() => {
        boat.pos.y = boatBaseY + Math.sin(k.time() * 1.5) * 8;
        boat.angle = Math.sin(k.time() * 1.2) * 2; // Gentle rocking
      });
      
      // Ripples around boat hull
      k.loop(0.8, () => {
        const ripple = k.add([
          k.circle(10),
          k.pos(boatX + (Math.random() - 0.5) * 100, boatBaseY + 15),
          k.anchor("center"),
          k.outline(2, k.rgb(100, 150, 255)),
          k.opacity(0.6),
          k.z(7),
        ]);
        
        ripple.onUpdate(() => {
          ripple.radius += 40 * k.dt();
          ripple.opacity -= k.dt() * 0.5;
          if (ripple.opacity <= 0) {
            k.destroy(ripple);
          }
        });
      });
      
      // Diver standing on boat deck
      const diver = k.add([
        k.sprite("diver", { anim: "idle" }),
        k.pos(boatX, boatBaseY - 15), // Standing on deck
        k.anchor("center"),
        k.scale(2),
        k.rotate(0),
        k.z(20),
      ]);
      
      // Diver follows boat movement
      diver.onUpdate(() => {
        diver.pos.x = boat.pos.x; // Follow boat X (in case it moves)
        diver.pos.y = boat.pos.y - 15; // Stay on deck
        diver.angle = boat.angle * 0.5; // Slight lean with boat
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
        if (isDivingRef.current && !transitionStarted) {
          transitionStarted = true;
          console.log('[CANVAS] 🤿 Starting dive transition...');
          
          // Fade to black overlay
          const fadeOverlay = k.add([
            k.rect(k.width(), k.height()),
            k.pos(0, 0),
            k.color(0, 0, 0),
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

    // ===== SURFACING SCENE =====
    k.scene("surfacing", (data: { treasure?: number } = {}) => {
      console.log('[CANVAS] 🌊 Surfacing scene created! Treasure:', data.treasure);
      
      let surfacingProgress = 0;
      const surfacingDuration = 3.0; // 3 seconds to surface
      
      // Start with underwater colors, transition to surface
      const underwaterColor = hexToRgb(getDepthZone(depthRef.current).color);
      const surfaceColor = { r: 135, g: 206, b: 250 };
      
      const bg = k.add([
        k.rect(k.width(), k.height()),
        k.pos(0, 0),
        k.color(underwaterColor.r, underwaterColor.g, underwaterColor.b),
        k.z(0),
      ]);
      
      // Sky (starts hidden)
      const sky = k.add([
        k.rect(k.width(), k.height() * 0.6),
        k.pos(0, 0),
        k.color(135, 206, 250),
        k.opacity(0),
        k.z(1),
      ]);
      
      // Sun (starts hidden)
      const sun = k.add([
        k.circle(50),
        k.pos(k.width() * 0.8, k.height() * 0.15),
        k.color(255, 220, 100),
        k.opacity(0),
        k.z(2),
      ]);
      
      // Beach (starts hidden) - DIAGONAL with WAVY LEFT EDGE (matching beach scene)
      const beachPoints: any[] = [];
      const waveAmplitude = 40;
      const waveFrequency = 0.008;
      const waterSurfaceY = k.height() * 0.6; // Match water surface
      const beachStartY = waterSurfaceY; // Beach top edge at water level
      const beachBaseX = k.width() * 0.45;
      
      // Create wavy shoreline polygon (same as beach scene)
      beachPoints.push(k.vec2(beachBaseX + waveAmplitude, beachStartY));
      for (let y = beachStartY; y <= k.height(); y += 10) {
        const progress = (y - beachStartY) / (k.height() - beachStartY);
        const baseX = beachBaseX + progress * k.width() * 0.15;
        const waveX = baseX + Math.sin(y * waveFrequency) * waveAmplitude;
        beachPoints.push(k.vec2(waveX, y));
      }
      beachPoints.push(k.vec2(k.width(), k.height()));
      beachPoints.push(k.vec2(k.width(), beachStartY));
      
      const beach = k.add([
        k.polygon(beachPoints),
        k.pos(0, 0),
        k.color(194, 178, 128),
        k.opacity(0),
        k.z(1),
      ]);
      
      // Boat waiting at surface (LEFT SIDE - in water, starts hidden, fades in)
      const boatBaseY = k.height() * 0.6;
      const boatX = k.width() * 0.25; // 25% from left (in water)
      const boat = createBoat(boatX, boatBaseY, 18);
      boat.opacity = 0;
      
      // Boat bobbing animation
      boat.onUpdate(() => {
        boat.pos.y = boatBaseY + Math.sin(k.time() * 1.5) * 8;
        boat.angle = Math.sin(k.time() * 1.2) * 2;
      });
      
      // Diver rising from underwater (LEFT SIDE - toward boat)
      const diver = k.add([
        k.sprite("diver", { anim: "swim" }),
        k.pos(boatX, k.height() * 0.8),
        k.anchor("center"),
        k.scale(2),
        k.z(20),
      ]);
      
      // Treasure bag removed - cleaner surfacing animation with just diver
      
      // Message
      const message = k.add([
        k.text("SURFACING!", { size: 48 }),
        k.pos(k.width() / 2, k.height() / 2 - 100),
        k.anchor("center"),
        k.color(100, 255, 200),
        k.opacity(1),
        k.z(100),
      ]);
      
      // Bubble trail
      k.loop(0.1, () => {
        const bubble = k.add([
          k.sprite("bubble", { frame: Math.floor(Math.random() * 10) }),
          k.pos(diver.pos.x + (Math.random() - 0.5) * 40, diver.pos.y + 30),
          k.anchor("center"),
          k.scale(2),
          k.opacity(0.8),
          k.z(15),
          k.lifespan(2),
        ]);
        
        bubble.onUpdate(() => {
          bubble.pos.y += 150 * k.dt(); // Bubbles move down relative to diver
          bubble.opacity -= k.dt() * 0.5;
        });
      });
      
      // Speed lines
      const speedLines: any[] = [];
      for (let i = 0; i < 30; i++) {
        const line = k.add([
          k.rect(2 + Math.random() * 3, 20 + Math.random() * 40),
          k.pos(Math.random() * k.width(), Math.random() * k.height()),
          k.anchor("center"),
          k.color(150, 200, 255),
          k.opacity(0.6),
          k.z(25),
        ]);
        speedLines.push(line);
      }
      
      k.onUpdate(() => {
        surfacingProgress += k.dt() / surfacingDuration;
        
        // Move diver upward toward boat
        const targetY = boatBaseY - 15; // Climbing onto boat deck
        const startY = k.height() * 0.8;
        diver.pos.y = startY + (targetY - startY) * surfacingProgress;
        // Treasure bag removed - just diver climbing back
        
        // Fade in surface elements
        sky.opacity = surfacingProgress;
        sun.opacity = surfacingProgress;
        beach.opacity = surfacingProgress;
        boat.opacity = surfacingProgress; // Boat fades in as diver surfaces
        
        // Blend background colors
        bg.color = k.rgb(
          underwaterColor.r * (1 - surfacingProgress) + surfaceColor.r * surfacingProgress,
          underwaterColor.g * (1 - surfacingProgress) + surfaceColor.g * surfacingProgress,
          underwaterColor.b * (1 - surfacingProgress) + surfaceColor.b * surfacingProgress
        );
        
        // Fade message
        message.opacity = 1 - surfacingProgress;
        
        // Move speed lines
        speedLines.forEach(line => {
          line.pos.y += 300 * k.dt();
          line.opacity = 0.6 * (1 - surfacingProgress);
          
          if (line.pos.y > k.height() + 50) {
            line.pos.y = -50;
            line.pos.x = Math.random() * k.width();
          }
        });
        
        // Complete surfacing
        if (surfacingProgress >= 1) {
          console.log('[CANVAS] ✅ Surfacing complete! Returning to beach...');
          k.go("beach");
        }
      });
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
        k.color(0, 0, 0),
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
          k.color(150, 200, 255),
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
        k.color(0, 0, 0),
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
      
      // Helper: Create a container with random sprites
      function createLayerPart(
        spriteName: string,
        frames: number,
        count: number,
        scaleRange: [number, number],
        opacityRange: [number, number],
        zIndex: number,
        yOffset: number = 0
      ) {
        const container = k.add([
          k.pos(0, yOffset),
          k.z(zIndex),
        ]);
        
        for (let i = 0; i < count; i++) {
          const sprite = container.add([
            k.sprite(spriteName, { frame: Math.floor(Math.random() * frames) }),
            k.pos(Math.random() * k.width(), Math.random() * CANVAS_HEIGHT),
            k.anchor("center"),
            k.scale(scaleRange[0] + Math.random() * (scaleRange[1] - scaleRange[0])),
            k.opacity(opacityRange[0] + Math.random() * (opacityRange[1] - opacityRange[0])),
          ]);
        }
        
        return container;
      }

      const parallaxLayers: ParallaxLayer[] = [
        // Layer 1: Far background - Rocks (slowest, darkest)
        {
          speed: -20,
          parts: [
            {
              container: createLayerPart("rock", 143, 6, [2, 3.5], [0.3, 0.4], 2, 0),
              y: 0,
            },
            {
              container: createLayerPart("rock", 143, 6, [2, 3.5], [0.3, 0.4], 2, -CANVAS_HEIGHT),
              y: -CANVAS_HEIGHT,
            },
          ],
        },
        // Layer 2: Mid background - Seaweed
        {
          speed: -50,
          parts: [
            {
              container: createLayerPart("seaweed", 96, 8, [1.5, 2.5], [0.5, 0.7], 4, 0),
              y: 0,
            },
            {
              container: createLayerPart("seaweed", 96, 8, [1.5, 2.5], [0.5, 0.7], 4, -CANVAS_HEIGHT),
              y: -CANVAS_HEIGHT,
            },
          ],
        },
        // Layer 3: Near mid - Rocks (smaller, faster)
        {
          speed: -100,
          parts: [
            {
              container: createLayerPart("rock", 143, 10, [1, 2], [0.5, 0.6], 6, 0),
              y: 0,
            },
            {
              container: createLayerPart("rock", 143, 10, [1, 2], [0.5, 0.6], 6, -CANVAS_HEIGHT),
              y: -CANVAS_HEIGHT,
            },
          ],
        },
        // Layer 4: Foreground - Corals (fastest, brightest)
        {
          speed: -200,
          parts: [
            {
              container: createLayerPart("coral", 28, 12, [1.5, 2.5], [0.7, 0.9], 8, 0),
              y: 0,
            },
            {
              container: createLayerPart("coral", 28, 12, [1.5, 2.5], [0.7, 0.9], 8, -CANVAS_HEIGHT),
              y: -CANVAS_HEIGHT,
            },
          ],
        },
      ];

      // Debris removed (emojis looked bad) - keeping empty array for compatibility
      const debrisList: any[] = [];

      // Light rays
      const lightRays: any[] = [];
      if (lightLevel > 0.3) {
        for (let i = 0; i < 5; i++) {
          const lightRay = k.add([
            k.polygon([
              k.vec2(0, 0),
              k.vec2(20, 0),
              k.vec2(40, k.height()),
              k.vec2(20, k.height()),
            ]),
            k.pos(i * 180 + 50, 0),
            k.color(255, 255, 200),
            k.opacity(0.08 * lightLevel),
            k.z(3),
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
        k.scale(2), // Scale up 32x32 sprite to 64x64
        k.opacity(1),
        k.z(20),
      ]);

      // Treasure bag removed - cleaner underwater view with just diver

      // Message display
      const messageDisplay = k.add([
        k.text("", { size: 48 }),
        k.pos(k.width() / 2, k.height() / 2 - 100),
        k.anchor("center"),
        k.color(255, 255, 255),
        k.opacity(0),
        k.z(100),
      ]);

      // Speed lines
      const speedLines: any[] = [];
      for (let i = 0; i < 30; i++) {
        const line = k.add([
          k.rect(2 + Math.random() * 3, 20 + Math.random() * 40),
          k.pos(Math.random() * k.width(), Math.random() * k.height()),
          k.anchor("center"),
          k.color(150, 200, 255),
          k.opacity(0),
          k.z(25),
        ]);
        speedLines.push(line);
      }

      // Bubbles - USING ANIMATED SPRITES!
      function createBubble(x?: number, y?: number) {
        const bubbleX = x !== undefined ? x : diver.pos.x + (Math.random() - 0.5) * 30;
        const bubbleY = y !== undefined ? y : diver.pos.y - 10;
        const scale = 1.5 + Math.random() * 1.5;

        const bubble = k.add([
          k.sprite("bubble", { frame: Math.floor(Math.random() * 10) }), // Random bubble frame
          k.pos(bubbleX, bubbleY),
          k.anchor("center"),
          k.scale(scale),
          k.opacity(0.8),
          k.z(15),
          k.lifespan(3),
        ]);

        bubble.onUpdate(() => {
          bubble.pos.y -= (60 + divingSpeed) * k.dt();
          bubble.pos.x += Math.sin(k.time() * 3 + bubbleY) * 30 * k.dt();
          bubble.opacity -= k.dt() * 0.27;
          
          // Pop animation when fading out
          if (bubble.opacity < 0.3) {
            bubble.play("pop");
          }
        });
      }

      k.loop(0.15, () => {
        if (!isAnimating && Math.random() > 0.3) {
          createBubble();
        }
      });

      // Fish (using sprites) - WITH VARIETY!
      function createFish() {
        // Use all 3 fish types for variety
        const fishTypes = ["fish1", "fish2", "fish3"];
        const fishType = fishTypes[Math.floor(Math.random() * fishTypes.length)];
        
        const fishY = 100 + Math.random() * 400;
        const direction = Math.random() > 0.5 ? 1 : -1;
        const startX = direction > 0 ? -50 : k.width() + 50;
        
        // fish2 and fish3 are larger (32px vs 16px)
        const scaleMultiplier = fishType === "fish1" ? 2 : 1.5;

        const fish = k.add([
          k.sprite(fishType, { anim: "swim" }),
          k.pos(startX, fishY),
          k.anchor("center"),
          k.z(7),
          k.scale(direction > 0 ? scaleMultiplier : -scaleMultiplier, scaleMultiplier),
          k.opacity(lightLevel * 0.8),
        ]);

        fish.onUpdate(() => {
          fish.pos.x += direction * 50 * k.dt();
          fish.pos.y += Math.sin(k.time() * 2 + fishY) * 15 * k.dt();

          if (
            (direction > 0 && fish.pos.x > k.width() + 50) ||
            (direction < 0 && fish.pos.x < -50)
          ) {
            k.destroy(fish);
          }
        });
      }

      k.loop(1.5, () => {
        if (Math.random() > 0.3 && lightLevel > 0.2) {
          createFish();
        }
      });

      // Jellyfish (floating creatures)
      function createJellyfish() {
        const jellyfishY = 100 + Math.random() * 400;
        const jellyfishX = Math.random() * k.width();
        
        const jellyfish = k.add([
          k.sprite("jellyfish", { anim: "float" }),
          k.pos(jellyfishX, jellyfishY),
          k.anchor("center"),
          k.z(6),
          k.scale(2),
          k.opacity(0.7 * lightLevel),
        ]);
        
        jellyfish.onUpdate(() => {
          // Slow vertical drift + sine wave horizontal
          jellyfish.pos.y -= 15 * k.dt();
          jellyfish.pos.x += Math.sin(k.time() * 2 + jellyfishY) * 30 * k.dt();
          
          // Wrap around top
          if (jellyfish.pos.y < -50) {
            jellyfish.pos.y = k.height() + 50;
            jellyfish.pos.x = Math.random() * k.width();
          }
        });
      }

      // Spawn jellyfish periodically
      k.loop(4, () => {
        if (Math.random() > 0.5 && lightLevel > 0.2) {
          createJellyfish();
        }
      });

      // Depth-based predators
      function getDepthPredator(depth: number): string | null {
        if (depth < 100) return null; // Safe zone
        if (depth < 200) return "shark"; // Already used for death
        if (depth < 400) return "sawshark"; // Mid-depth menace
        if (depth < 600) return "swordfish"; // Deep hunter (fast!)
        return "seaangler"; // Abyss zone (glowing lure)
      }

      function createAmbientPredator() {
        const predator = getDepthPredator(depthRef.current);
        if (!predator || predator === "shark") return; // Skip shark (used for death)
        
        const direction = Math.random() > 0.5 ? 1 : -1;
        const startX = direction > 0 ? -100 : k.width() + 100;
        const predatorY = 100 + Math.random() * 400;
        
        const creature = k.add([
          k.sprite(predator, { anim: "swim" }),
          k.pos(startX, predatorY),
          k.anchor("center"),
          k.z(9),
          k.scale(direction * 2.5, 2.5),
          k.opacity(0.8 * lightLevel),
        ]);
        
        // Add glowing light for seaangler
        if (predator === "seaangler") {
          const light = creature.add([
            k.circle(15),
            k.pos(direction > 0 ? 20 : -20, -10), // Lure position
            k.color(255, 255, 150),
            k.opacity(0.6),
          ]);
          
          // Pulsing glow
          light.onUpdate(() => {
            light.opacity = 0.4 + Math.sin(k.time() * 8) * 0.3;
            light.radius = 15 + Math.sin(k.time() * 8) * 5;
          });
        }
        
        creature.onUpdate(() => {
          const speed = predator === "swordfish" ? 120 : 60;
          creature.pos.x += direction * speed * k.dt();
          creature.pos.y += Math.sin(k.time() * 2 + predatorY) * 20 * k.dt();
          
          if (
            (direction > 0 && creature.pos.x > k.width() + 100) ||
            (direction < 0 && creature.pos.x < -100)
          ) {
            k.destroy(creature);
          }
        });
      }

      // Spawn predators based on depth
      k.loop(6, () => {
        if (depthRef.current > 100 && Math.random() > 0.6) {
          createAmbientPredator();
        }
      });

      // Treasure Chest System
      function showTreasureChest(x: number, y: number) {
        const chest = k.add([
          k.sprite("chest", { anim: "closed" }),
          k.pos(x, y + 40),
          k.anchor("center"),
          k.scale(3),
          k.opacity(0),
          k.z(25),
        ]);
        
        // Fade in
        let fadeIn = 0;
        const fadeInInterval = setInterval(() => {
          fadeIn += 0.1;
          chest.opacity = Math.min(fadeIn, 1);
          if (fadeIn >= 1) clearInterval(fadeInInterval);
        }, 50);
        
        // Opening sequence
        setTimeout(() => {
          chest.play("opening");
          
          setTimeout(() => {
            chest.play("open");
            
            // Spawn coin particles
            for (let i = 0; i < 15; i++) {
              setTimeout(() => createCoinParticle(x, y + 40), i * 30);
            }
          }, 400);
        }, 500);
        
        // Fade out after animation
        setTimeout(() => {
          let fadeOut = 1;
          const fadeOutInterval = setInterval(() => {
            fadeOut -= 0.1;
            chest.opacity = Math.max(fadeOut, 0);
            if (fadeOut <= 0) {
              clearInterval(fadeOutInterval);
              k.destroy(chest);
            }
          }, 50);
        }, 2000);
      }

      function createCoinParticle(x: number, y: number) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 80 + Math.random() * 80;
        
        const coin = k.add([
          k.sprite("coin", { anim: "spin" }), // Use spin animation!
          k.pos(x, y),
          k.anchor("center"),
          k.scale(2 + Math.random()), // Vary size
          k.opacity(1),
          k.z(26),
          k.lifespan(1.5),
        ]);
        
        coin.onUpdate(() => {
          coin.pos.x += Math.cos(angle) * speed * k.dt();
          coin.pos.y += Math.sin(angle) * speed * k.dt() - 50 * k.dt(); // Upward bias
          coin.opacity -= k.dt() * 0.7;
        });
      }

      // Particle effects (legacy gold circles)
      function createTreasureParticles(x: number, y: number) {
        for (let i = 0; i < 30; i++) {
          const angle = (Math.PI * 2 * i) / 30;
          const speed = 100 + Math.random() * 100;
          
          const particle = k.add([
            k.circle(3),
            k.pos(x, y),
            k.anchor("center"),
            k.color(255, 215, 0),
            k.opacity(1),
            k.z(25),
            k.lifespan(1),
          ]);

          particle.onUpdate(() => {
            particle.pos.x += Math.cos(angle) * speed * k.dt();
            particle.pos.y += Math.sin(angle) * speed * k.dt();
            particle.opacity -= k.dt();
          });
        }

        // Sparkles removed (emoji looked bad) - coin particles are better
      }

      // Death animation - WITH VARIETY!
      function triggerDeathAnimation() {
        console.log('[CANVAS] Triggering death animation!');
        isAnimating = true;
        animationType = 'death';
        divingSpeed = 0;

        // Choose predator based on current depth
        const predatorChoice = getDepthPredator(depthRef.current) || "shark";
        
        const direction = Math.random() > 0.5 ? 1 : -1;
        const startX = direction > 0 ? -100 : k.width() + 100;

        const creature = k.add([
          k.sprite(predatorChoice, { anim: "swim" }),
          k.pos(startX, diver.pos.y),
          k.anchor("center"),
          k.z(25),
          k.scale(direction * 3, 3),
        ]);

        // Custom death messages per predator
        const deathMessages: Record<string, string> = {
          shark: "SHARK ATTACK!",
          sawshark: "SAWSHARK!",
          swordfish: "IMPALED!",
          seaangler: "LURED TO DEATH!",
        };
        
        messageDisplay.text = deathMessages[predatorChoice] || "DANGER!";
        messageDisplay.color = k.rgb(255, 50, 50);
        messageOpacity = 1;

        let attackComplete = false;
        creature.onUpdate(() => {
          if (attackComplete) return;

          const speed = 300;
          creature.pos.x += direction * speed * k.dt();
          creature.pos.y = diver.pos.y + Math.sin(k.time() * 20) * 10;

          if (Math.abs(creature.pos.x - diver.pos.x) < 50) {
            attackComplete = true;

            k.add([
              k.rect(k.width(), k.height()),
              k.pos(0, 0),
              k.color(255, 0, 0),
              k.opacity(0.8),
              k.z(99),
              k.lifespan(0.3),
            ]);

            messageDisplay.text = "DROWNED!";
            messageOpacity = 1;

            diver.onUpdate(() => {
              diver.pos.y += 100 * k.dt();
              diver.opacity -= k.dt() * 0.5;
            });
            // Treasure bag removed - cleaner view

            creature.onUpdate(() => {
              creature.pos.x += direction * 150 * k.dt();
              if (Math.abs(creature.pos.x) > k.width() + 200) {
                k.destroy(creature);
              }
            });
          }
        });
      }

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
        if (animationType === 'diving') {
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
              diver.pos.x + (Math.random() - 0.5) * 60,
              diver.pos.y + (Math.random() - 0.5) * 40
            );
          }

          // Check completion
          if (progress >= 1) {
            console.log('[CANVAS] ✅ Diving animation complete!');
            isAnimating = false;
            animationType = 'idle';
            messageOpacity = 0;
            divingSpeed = 0;
            divingElapsed = 0;

            speedLines.forEach(line => {
              line.opacity = 0;
            });
          }
        }

        // ===== TREASURE ANIMATION LOGIC =====
        if (animationType === 'treasure') {
          treasurePulseTime += k.dt() * 8;

          if (treasurePulseTime > Math.PI * 4) {
            console.log('[CANVAS] ✅ Treasure animation complete! Staying underwater for next dive...');
            // Stay underwater - don't surface automatically
            isAnimating = false;
            animationType = 'idle';
            messageOpacity = 0;
            treasurePulseTime = 0;
          }
        }

        // ===== IDLE STATE - Gentle bobbing & slow parallax =====
        if (!isAnimating && animationType === 'idle') {
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

        // Fade message
        if (messageOpacity > 0) {
          messageDisplay.opacity = messageOpacity;
          messageOpacity -= k.dt() * 0.4;
        } else {
          messageDisplay.opacity = 0;
        }

        // ===== ANIMATION TRIGGERS =====
        // Check for surfacing request (player cashed out)
        if (shouldSurfaceRef.current && !isAnimating && animationType === 'idle') {
          console.log('[CANVAS] 🌊 Player cashed out! Transitioning to surfacing...');
          k.go("surfacing", { treasure: treasureRef.current });
        } else if (isDivingRef.current && !isAnimating && animationType === 'idle') {
          console.log('[CANVAS] 🤿 Starting dive animation (2.5s)');
          isAnimating = true;
          animationType = 'diving';
          divingElapsed = 0;
          messageDisplay.text = "DIVING...";
          messageDisplay.color = k.rgb(100, 200, 255);
          messageOpacity = 1;
        } else if (survivedRef.current === true && !isAnimating && animationType === 'idle') {
          console.log('[CANVAS] 💰 Treasure found! Playing success animation');
          isAnimating = true;
          animationType = 'treasure';
          treasurePulseTime = 0;
          messageDisplay.text = "TREASURE!";
          messageDisplay.color = k.rgb(255, 215, 0);
          messageOpacity = 1;
          createTreasureParticles(diver.pos.x, diver.pos.y);
          showTreasureChest(diver.pos.x, diver.pos.y); // Show animated chest!
        } else if (survivedRef.current === false && !isAnimating && animationType === 'idle') {
          console.log('[CANVAS] 💀 Death triggered! Playing attack animation');
          triggerDeathAnimation();
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
