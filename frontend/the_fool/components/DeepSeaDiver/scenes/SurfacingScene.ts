/**
 * Surfacing Scene
 * Handles the animation when the diver returns to the surface
 */

import { getDepthZone } from "@/lib/gameLogic";
import * as CONST from "../sceneConstants";
import { createBoat } from "../entities/boat";
import type { SceneConfig, SurfacingSceneData } from "./sceneTypes";
import { useGameStore } from "@/lib/gameStore";

/**
 * Create surfacing scene
 * Shows diver rising from depth back to surface with transition
 */
export function createSurfacingScene(config: SceneConfig) {
  const { k, hexToRgb } = config;

  k.scene("surfacing", (data: SurfacingSceneData = {}) => {
    console.log(
      "[CANVAS] 🌊 Surfacing scene created! Treasure:",
      data.treasure
    );

    let surfacingProgress = 0;
    const surfacingDuration = 3.0; // 3 seconds to surface

    // Start with underwater colors, transition to surface
    const underwaterColor = hexToRgb(
      getDepthZone(useGameStore.getState().depth).color
    );
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
      k.color(...CONST.COLORS.SKY),
      k.opacity(0),
      k.z(1),
    ]);

    // Sun (starts hidden)
    const sun = k.add([
      k.circle(50),
      k.pos(k.width() * 0.8, k.height() * 0.15),
      k.color(...CONST.COLORS.SUN),
      k.opacity(0),
      k.z(2),
    ]);

    // Beach (starts hidden) - DIAGONAL with WAVY LEFT EDGE
    const beachPoints: any[] = [];
    const waveAmplitude = 40;
    const waveFrequency = 0.008;
    const waterSurfaceY = k.height() * 0.6;
    const beachStartY = waterSurfaceY;
    const beachBaseX = k.width() * 0.45;

    // Create wavy shoreline polygon
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
      k.color(...CONST.COLORS.BEACH),
      k.opacity(0),
      k.z(1),
    ]);

    // Boat waiting at surface
    const boatBaseY = k.height() * 0.6;
    const boatX = k.width() * 0.25;
    const boat = createBoat(k, boatX, boatBaseY, 18);
    boat.opacity = 0;

    // Boat bobbing animation
    boat.onUpdate(() => {
      boat.pos.y = boatBaseY + Math.sin(k.time() * 1.5) * 8;
      boat.angle = Math.sin(k.time() * 1.2) * 2;
    });

    // Diver rising from underwater
    const diver = k.add([
      k.sprite("diver", { anim: "swim" }),
      k.pos(boatX, k.height() * 0.8),
      k.anchor("center"),
      k.scale(2.5),
      k.z(20),
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
        bubble.pos.y += 150 * k.dt();
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
        k.color(...CONST.COLORS.SPEED_LINE),
        k.opacity(0.6),
        k.z(25),
      ]);
      speedLines.push(line);
    }

    k.onUpdate(() => {
      surfacingProgress += k.dt() / surfacingDuration;

      // Move diver upward toward boat
      const targetY = boatBaseY - 15;
      const startY = k.height() * 0.8;
      diver.pos.y = startY + (targetY - startY) * surfacingProgress;

      // Fade in surface elements
      sky.opacity = surfacingProgress;
      sun.opacity = surfacingProgress;
      beach.opacity = surfacingProgress;
      boat.opacity = surfacingProgress;

      // Blend background colors
      bg.color = k.rgb(
        underwaterColor.r * (1 - surfacingProgress) +
          surfaceColor.r * surfacingProgress,
        underwaterColor.g * (1 - surfacingProgress) +
          surfaceColor.g * surfacingProgress,
        underwaterColor.b * (1 - surfacingProgress) +
          surfaceColor.b * surfacingProgress
      );

      // Move speed lines
      speedLines.forEach((line) => {
        line.pos.y += 300 * k.dt();
        line.opacity = 0.6 * (1 - surfacingProgress);

        if (line.pos.y > k.height() + 50) {
          line.pos.y = -50;
          line.pos.x = Math.random() * k.width();
        }
      });

      // Complete surfacing
      if (surfacingProgress >= 1) {
        console.log("[CANVAS] ✅ Surfacing complete! Returning to beach...");
        useGameStore.getState().returnToBeach(); // Reset ocean flag so we can dive again
        k.go("beach");
      }
    });
  });
}
