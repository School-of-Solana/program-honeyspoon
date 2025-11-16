/**
 * Diving Scene
 * The main underwater gameplay scene with parallax scrolling and creature spawning
 *
 * Refactored to use Zustand store - no more refs!
 */

import { getDepthZone } from "@/lib/gameLogic";
import { AnimationType } from "@/lib/types";
import * as CONST from "../sceneConstants";
import { createBubble } from "../entities/bubble";
import { createFish } from "../entities/fish";
import { createJellyfish } from "../entities/jellyfish";
import { createAmbientPredator } from "../entities/predator";
import { createTreasureParticles } from "../entities/particles";
import { triggerDeathAnimation } from "../entities/death";
import { createLayerPart } from "../entities/parallax";
import type { SceneConfig } from "./sceneTypes";
import { useGameStore } from "@/lib/gameStore";

/**
 * Shared animation state for diving scene
 */
export interface DivingSceneState {
  diverY: number;
  diverX: number;
  isAnimating: boolean;
  animationType: AnimationType;
  divingSpeed: number;
  divingElapsed: number;
  divingDuration: number;
  treasurePulseTime: number;
}

/**
 * Create diving scene with all underwater gameplay
 */
export function createDivingScene(
  config: SceneConfig,
  state: DivingSceneState
) {
  const { k, hexToRgb } = config;

  k.scene("diving", () => {
    console.log("[CANVAS] 🤿 Diving scene created!");

    // Get depth zone for colors
    let currentZone = getDepthZone(useGameStore.getState().depth);
    let bgColor = hexToRgb(currentZone.color);
    let lightLevel = currentZone.light;

    // Background
    const bg = k.add([
      k.rect(k.width(), k.height()),
      k.pos(0, 0),
      k.color(
        bgColor.r * lightLevel,
        bgColor.g * lightLevel,
        bgColor.b * lightLevel
      ),
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

      splashParticles.push({
        obj: splash,
        angle,
        speed: 150 + Math.random() * 100,
      });
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
      k.opacity(Math.min(useGameStore.getState().depth / 500, 0.6)),
      k.z(1),
    ]);

    // INFINITE PARALLAX SCROLLING LAYERS
    const CANVAS_HEIGHT = k.height();

    interface ParallaxLayer {
      speed: number;
      parts: Array<{
        container: any;
        y: number;
      }>;
    }

    const parallaxLayers: ParallaxLayer[] = [
      // Layer 1: Far background - Seaweed
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
      // Layer 3: Foreground - Seaweed
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

    // Debris removed (emojis looked bad)
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

    // DIVER (using sprite)
    const diver = k.add([
      k.sprite("diver", { anim: "idle" }),
      k.pos(state.diverX, state.diverY),
      k.anchor("center"),
      k.scale(2.5),
      k.opacity(1),
      k.z(20),
    ]);

    // Speed lines
    const speedLines: any[] = [];
    for (let i = 0; i < CONST.SPAWN_RATES.SPEED_LINE_COUNT; i++) {
      const line = k.add([
        k.rect(
          CONST.SPEED_LINES.WIDTH_MIN +
            Math.random() * CONST.SPEED_LINES.WIDTH_RANDOM,
          CONST.SPEED_LINES.HEIGHT_MIN +
            Math.random() * CONST.SPEED_LINES.HEIGHT_RANDOM
        ),
        k.pos(Math.random() * k.width(), Math.random() * k.height()),
        k.anchor("center"),
        k.color(...CONST.COLORS.SPEED_LINE),
        k.opacity(0),
        k.z(CONST.Z_LAYERS.SPEED_LINES),
      ]);
      speedLines.push(line);
    }

    // Spawn bubbles
    k.loop(CONST.SPAWN_RATES.BUBBLE_INTERVAL, () => {
      if (
        !state.isAnimating &&
        Math.random() > CONST.SPAWN_RATES.BUBBLE_CHANCE
      ) {
        createBubble(k, diver.pos, state.divingSpeed);
      }
    });

    // Spawn fish
    k.loop(CONST.SPAWN_RATES.FISH_INTERVAL, () => {
      if (
        Math.random() > CONST.SPAWN_RATES.FISH_CHANCE &&
        lightLevel > CONST.OPACITY.LIGHT_RAY_MIN
      ) {
        createFish(k, lightLevel);
      }
    });

    // Spawn jellyfish
    k.loop(CONST.SPAWN_RATES.JELLYFISH_INTERVAL, () => {
      if (
        Math.random() > CONST.SPAWN_RATES.JELLYFISH_CHANCE &&
        lightLevel > CONST.OPACITY.LIGHT_RAY_MIN
      ) {
        createJellyfish(k, lightLevel);
      }
    });

    // Spawn predators
    k.loop(6, () => {
      if (useGameStore.getState().depth > 100 && Math.random() > 0.6) {
        createAmbientPredator(k, useGameStore.getState().depth, lightLevel);
      }
    });

    // Main update loop
    let lastLogTime = 0;

    k.onUpdate(() => {
      const now = Date.now();

      // Log state every 3 seconds
      if (now - lastLogTime > 3000) {
        console.log("[CANVAS] 🎮 State update", {
          animation: state.animationType,
          isAnimating: state.isAnimating,
          depth: `${useGameStore.getState().depth}m`,
          treasure: `$${useGameStore.getState().treasureValue}`,
          divingSpeed: `${state.divingSpeed.toFixed(0)}px/s`,
        });
        lastLogTime = now;
      }

      // Update background
      currentZone = getDepthZone(useGameStore.getState().depth);
      bgColor = hexToRgb(currentZone.color);
      lightLevel = currentZone.light;

      bg.color = k.rgb(
        bgColor.r * lightLevel,
        bgColor.g * lightLevel,
        bgColor.b * lightLevel
      );

      darknessOverlay.opacity = Math.min(
        0.1 + (useGameStore.getState().depth / 1000) * 0.7,
        0.8
      );

      // Diving animation logic
      if (state.animationType === AnimationType.DIVING) {
        state.divingElapsed += k.dt();
        const progress = Math.min(
          state.divingElapsed / state.divingDuration,
          1
        );

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
        state.divingSpeed = maxSpeed * acceleration;

        // Update parallax layers
        parallaxLayers.forEach((layer) => {
          if (layer.parts[0].y < -CANVAS_HEIGHT) {
            layer.parts[0].y = layer.parts[1].y + CANVAS_HEIGHT;
            layer.parts[0].container.pos.y = layer.parts[0].y;
            layer.parts.push(layer.parts.shift()!);
          }

          layer.parts[0].y += state.divingSpeed * (layer.speed / 100) * k.dt();
          layer.parts[1].y += state.divingSpeed * (layer.speed / 100) * k.dt();
          layer.parts[0].container.pos.y = layer.parts[0].y;
          layer.parts[1].container.pos.y = layer.parts[1].y;
        });

        // Update speed lines
        speedLines.forEach((line) => {
          line.opacity = Math.min(state.divingSpeed / 200, 0.8);
          line.pos.y += state.divingSpeed * 1.5 * k.dt();

          if (line.pos.y > k.height() + 50) {
            line.pos.y = -50;
            line.pos.x = Math.random() * k.width();
          }
        });

        // Update debris
        debrisList.forEach(({ obj, driftSpeed }) => {
          obj.pos.y += state.divingSpeed * 0.8 * k.dt();
          obj.pos.x += driftSpeed * k.dt();
          obj.angle += 30 * k.dt();

          if (obj.pos.y > k.height() + 100) {
            obj.pos.y = -200 - Math.random() * 200;
            obj.pos.x = Math.random() * k.width();
          }
        });

        // Extra bubbles during diving
        if (Math.random() > 0.8) {
          createBubble(
            k,
            diver.pos,
            state.divingSpeed,
            diver.pos.x + (Math.random() - 0.5) * 60,
            diver.pos.y + (Math.random() - 0.5) * 40
          );
        }

        // Complete diving animation
        if (progress >= 1) {
          state.animationType = AnimationType.IDLE;
          state.isAnimating = false;
          state.divingSpeed = 0;
          state.divingElapsed = 0;
          useGameStore.getState().endDiveAnimation(); // Clear isDiving flag
          console.log("[CANVAS] ✅ Diving animation complete");
        }
      }

      // Check for surfacing request (player cashed out)
      if (
        useGameStore.getState().shouldSurface &&
        !state.isAnimating &&
        state.animationType === AnimationType.IDLE
      ) {
        console.log(
          "[CANVAS] 🌊 Player cashed out! Transitioning to surfacing..."
        );
        // Immediately set to animating to prevent duplicate triggers
        state.isAnimating = true;
        k.go("surfacing", { treasure: useGameStore.getState().treasureValue });
      } else if (
        useGameStore.getState().isDiving &&
        !state.isAnimating &&
        state.animationType === AnimationType.IDLE
      ) {
        console.log("[CANVAS] 🤿 Starting dive animation (2.5s)");
        state.isAnimating = true;
        state.animationType = AnimationType.DIVING;
        state.divingElapsed = 0;
      }

      // Treasure collection animation
      if (
        useGameStore.getState().survived === true &&
        !state.isAnimating &&
        state.animationType === AnimationType.IDLE
      ) {
        console.log("[CANVAS] 💰 Treasure collected! Playing celebration");
        state.isAnimating = true;
        state.animationType = AnimationType.TREASURE;
        state.treasurePulseTime = 0;
        createTreasureParticles(k, diver.pos.x, diver.pos.y);
        // Treasure chest animation removed - just showing particles
      } else if (
        useGameStore.getState().survived === false &&
        !state.isAnimating &&
        state.animationType === AnimationType.IDLE
      ) {
        console.log("[CANVAS] 💀 Death triggered! Playing attack animation");
        // Immediately set to animating to prevent duplicate triggers
        state.isAnimating = true;
        state.animationType = AnimationType.DEATH;
        triggerDeathAnimation(
          k,
          diver,
          useGameStore.getState().depth,
          {
            isAnimating: true,
            animationType: AnimationType.DEATH,
            divingSpeed: state.divingSpeed,
          },
          () => {
            useGameStore.getState().returnToBeach(); // Reset ocean flag so we can dive again
            k.go("beach");
          }
        );
      }
    });
  });
}
