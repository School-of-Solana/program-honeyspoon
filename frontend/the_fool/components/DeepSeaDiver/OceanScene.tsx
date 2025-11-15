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
  lastShipwreck?: Shipwreck;
  onAnimationComplete?: () => void;
  debugMode?: boolean;
}

export default function OceanScene({
  depth,
  treasureValue,
  isDiving,
  survived,
  debugMode = false,
}: OceanSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const kRef = useRef<KAPLAYCtx | null>(null);
  const initializedRef = useRef<boolean>(false);
  
  // Use refs to track prop changes inside Kaplay closures
  const isDivingRef = useRef(isDiving);
  const survivedRef = useRef(survived);
  const depthRef = useRef(depth);
  const treasureRef = useRef(treasureValue);
  
  // Update refs when props change
  useEffect(() => {
    const changes = [];
    if (isDivingRef.current !== isDiving) changes.push(`isDiving: ${isDivingRef.current} → ${isDiving}`);
    if (survivedRef.current !== survived) changes.push(`survived: ${survivedRef.current} → ${survived}`);
    if (depthRef.current !== depth) changes.push(`depth: ${depthRef.current}m → ${depth}m`);
    if (treasureRef.current !== treasureValue) changes.push(`treasure: $${treasureRef.current} → $${treasureValue}`);
    
    if (changes.length > 0) {
      console.log('[CANVAS] 📊 Props changed:', changes.join(', '));
    }
    
    isDivingRef.current = isDiving;
    survivedRef.current = survived;
    depthRef.current = depth;
    treasureRef.current = treasureValue;
  }, [isDiving, survived, depth, treasureValue]);

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

    // Create main scene
    k.scene("ocean", () => {
      console.log('[CANVAS] 🎮 Ocean scene created!');
      
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

      // Darkness overlay
      const darknessOverlay = k.add([
        k.rect(k.width(), k.height()),
        k.pos(0, 0),
        k.color(0, 0, 0),
        k.opacity(Math.min(depth / 500, 0.6)),
        k.z(1),
      ]);

      // PARALLAX LAYERS
      const parallaxLayers: { objects: any[], speed: number }[] = [];

      // Get sprite configs for correct frame counts
      const tilesConfig = SPRITE_CONFIGS.find(s => s.name === 'tiles');
      const seaweedConfig = SPRITE_CONFIGS.find(s => s.name === 'seaweed');
      const coralsConfig = SPRITE_CONFIGS.find(s => s.name === 'corals');

      // Far Layer - Rocks (using sprites)
      const farLayer = { objects: [] as any[], speed: 0.3 };
      const totalRockFrames = tilesConfig?.totalFrames || 143;
      for (let i = 0; i < 8; i++) {
        const rock = k.add([
          k.sprite("rock", { frame: Math.floor(Math.random() * totalRockFrames) }),
          k.pos(Math.random() * k.width(), Math.random() * k.height() * 2 - k.height()),
          k.anchor("center"),
          k.scale(2 + Math.random() * 2),
          k.opacity(0.4),
          k.z(2),
        ]);
        farLayer.objects.push(rock);
      }
      parallaxLayers.push(farLayer);

      // Mid Layer - Seaweed (using sprites)
      const midLayer = { objects: [] as any[], speed: 0.6 };
      const totalSeaweedFrames = seaweedConfig?.totalFrames || 96; // ✅ Fixed: was 12*16=192, now 96
      for (let i = 0; i < 12; i++) {
        const kelp = k.add([
          k.sprite("seaweed", { frame: Math.floor(Math.random() * totalSeaweedFrames) }),
          k.pos(Math.random() * k.width(), Math.random() * k.height() * 2 - k.height()),
          k.anchor("top"),
          k.scale(2 + Math.random()),
          k.opacity(0.6),
          k.z(5),
        ]);
        midLayer.objects.push(kelp);
      }
      parallaxLayers.push(midLayer);

      // Fore Layer - Coral (using sprites)
      const foreLayer = { objects: [] as any[], speed: 1.2 };
      const totalCoralFrames = coralsConfig?.totalFrames || 28;
      for (let i = 0; i < 15; i++) {
        const coral = k.add([
          k.sprite("coral", { frame: Math.floor(Math.random() * totalCoralFrames) }),
          k.pos(Math.random() * k.width(), Math.random() * k.height() * 2 - k.height()),
          k.anchor("center"),
          k.scale(1.5 + Math.random()),
          k.opacity(0.7 + Math.random() * 0.3),
          k.z(8),
        ]);
        foreLayer.objects.push(coral);
      }
      parallaxLayers.push(foreLayer);

      // Debris
      const debrisTypes = ["🍂", "💀", "⚓", "🏺", "📦", "🔱"];
      const debrisList: any[] = [];
      for (let i = 0; i < 20; i++) {
        const debris = k.add([
          k.text(debrisTypes[Math.floor(Math.random() * debrisTypes.length)], { size: 16 + Math.random() * 12 }),
          k.pos(Math.random() * k.width(), Math.random() * k.height() - 100),
          k.anchor("center"),
          k.opacity(0.5 + Math.random() * 0.3),
          k.rotate(Math.random() * 360),
          k.z(6),
        ]);
        debrisList.push({ obj: debris, driftSpeed: (Math.random() - 0.5) * 20 });
      }

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

      // Surface waves
      const surfaceWaves = k.add([
        k.text("~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~", { size: 24 }),
        k.pos(k.width() / 2, 30),
        k.anchor("center"),
        k.color(100, 150, 255),
        k.opacity(1 - depth / 200),
        k.z(10),
      ]);

      // DIVER (using sprite)
      const diver = k.add([
        k.sprite("diver", { anim: "idle" }),
        k.pos(diverX, diverY),
        k.anchor("center"),
        k.scale(2), // Scale up 32x32 sprite to 64x64
        k.opacity(1),
        k.z(20),
      ]);

      const treasureBag = k.add([
        k.circle(15),
        k.pos(diverX, diverY + 30),
        k.anchor("center"),
        k.color(255, 215, 0),
        k.outline(2, k.rgb(200, 170, 0)),
        k.opacity(1),
        k.rotate(0),
        k.z(20),
      ]);

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

      // Bubbles
      function createBubble(x?: number, y?: number) {
        const bubbleX = x !== undefined ? x : diver.pos.x + (Math.random() - 0.5) * 30;
        const bubbleY = y !== undefined ? y : diver.pos.y - 10;
        const size = 2 + Math.random() * 6;

        const bubble = k.add([
          k.circle(size),
          k.pos(bubbleX, bubbleY),
          k.anchor("center"),
          k.color(150, 200, 255),
          k.opacity(0.7),
          k.outline(1, k.rgb(200, 230, 255)),
          k.z(15),
          k.lifespan(3),
        ]);

        bubble.onUpdate(() => {
          bubble.pos.y -= (60 + divingSpeed) * k.dt();
          bubble.pos.x += Math.sin(k.time() * 3 + bubbleY) * 30 * k.dt();
          bubble.opacity -= k.dt() * 0.3;
        });
      }

      k.loop(0.15, () => {
        if (!isAnimating && Math.random() > 0.3) {
          createBubble();
        }
      });

      // Fish (using sprites)
      function createFish() {
        const fishY = 100 + Math.random() * 400;
        const direction = Math.random() > 0.5 ? 1 : -1;
        const startX = direction > 0 ? -50 : k.width() + 50;

        const fish = k.add([
          k.sprite("fish", { anim: "swim" }),
          k.pos(startX, fishY),
          k.anchor("center"),
          k.z(7),
          k.scale(direction > 0 ? 2 : -2, 2),
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

      // Particle effects
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

        for (let i = 0; i < 10; i++) {
          setTimeout(() => {
            const sparkle = k.add([
              k.text("✨", { size: 24 }),
              k.pos(x + (Math.random() - 0.5) * 100, y + (Math.random() - 0.5) * 100),
              k.anchor("center"),
              k.opacity(1),
              k.z(26),
              k.lifespan(0.5),
            ]);

            sparkle.onUpdate(() => {
              sparkle.pos.y -= 50 * k.dt();
              sparkle.opacity -= k.dt() * 2;
            });
          }, i * 50);
        }
      }

      // Death animation
      function triggerDeathAnimation() {
        console.log('[CANVAS] Triggering death animation!');
        isAnimating = true;
        animationType = 'death';
        divingSpeed = 0;

        const direction = Math.random() > 0.5 ? 1 : -1;
        const startX = direction > 0 ? -100 : k.width() + 100;

        const creature = k.add([
          k.sprite("shark", { anim: "swim" }),
          k.pos(startX, diver.pos.y),
          k.anchor("center"),
          k.z(25),
          k.scale(direction * 3, 3),
        ]);

        messageDisplay.text = "⚠️ DANGER!";
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

            messageDisplay.text = "💀 DROWNED!";
            messageOpacity = 1;

            diver.onUpdate(() => {
              diver.pos.y += 100 * k.dt();
              diver.opacity -= k.dt() * 0.5;
            });
            treasureBag.onUpdate(() => {
              treasureBag.pos.y += 150 * k.dt();
              treasureBag.angle += 360 * k.dt();
              treasureBag.opacity -= k.dt() * 0.5;
            });

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

          // Update parallax layers
          parallaxLayers.forEach(layer => {
            layer.objects.forEach(obj => {
              obj.pos.y += divingSpeed * layer.speed * k.dt();
              
              if (obj.pos.y > k.height() + 200) {
                obj.pos.y = -200;
                obj.pos.x = Math.random() * k.width();
              }
            });
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
          const baseSize = 15;
          const sizeMultiplier = 1 + Math.min(treasureRef.current / 1000, 2);
          treasureBag.radius = (baseSize * sizeMultiplier) + Math.sin(treasurePulseTime) * 5;

          if (treasurePulseTime > Math.PI * 4) {
            console.log('[CANVAS] ✅ Treasure animation complete!');
            treasureBag.radius = baseSize * sizeMultiplier;
            isAnimating = false;
            animationType = 'idle';
            messageOpacity = 0;
            treasurePulseTime = 0;
          }
        }

        // ===== IDLE STATE - Gentle bobbing =====
        if (!isAnimating && animationType === 'idle') {
          const bobAmount = Math.sin(k.time() * 2) * 10;
          diver.pos.y = diverY + bobAmount;
          treasureBag.pos.y = diverY + 30 + bobAmount;
        }

        // Update treasure bag size
        if (animationType !== 'treasure') {
          const baseSize = 15;
          const sizeMultiplier = 1 + Math.min(treasureRef.current / 1000, 2);
          treasureBag.radius = baseSize * sizeMultiplier;
        }

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
        if (isDivingRef.current && !isAnimating && animationType === 'idle') {
          console.log('[CANVAS] 🤿 Starting dive animation (2.5s)');
          isAnimating = true;
          animationType = 'diving';
          divingElapsed = 0;
          messageDisplay.text = "⬇️ DIVING...";
          messageDisplay.color = k.rgb(100, 200, 255);
          messageOpacity = 1;
        } else if (survivedRef.current === true && !isAnimating && animationType === 'idle') {
          console.log('[CANVAS] 💰 Treasure found! Playing success animation');
          isAnimating = true;
          animationType = 'treasure';
          treasurePulseTime = 0;
          messageDisplay.text = "💰 TREASURE!";
          messageDisplay.color = k.rgb(255, 215, 0);
          messageOpacity = 1;
          createTreasureParticles(diver.pos.x, diver.pos.y);
        } else if (survivedRef.current === false && !isAnimating && animationType === 'idle') {
          console.log('[CANVAS] 💀 Death triggered! Playing attack animation');
          triggerDeathAnimation();
        }
      });
    });

    // Start scene
    console.log('[CANVAS] 🚀 Starting ocean scene...');
    k.go("ocean");
    console.log('[CANVAS] ✅ Ocean scene started!');

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
