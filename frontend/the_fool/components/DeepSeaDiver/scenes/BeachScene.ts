/**
 * Beach Scene
 * The starting scene with beach, sky, boat, and decorations
 */

import * as CONST from "../sceneConstants";
import { createBoat } from "../entities/boat";
import { createPalmTree } from "../entities/palmtree";
import { createSeagull } from "../entities/seagull";
import { createCrab } from "../entities/crab";
import { createStarfish } from "../entities/starfish";
import type { SceneConfig } from "./sceneTypes";

export function createBeachScene(config: SceneConfig) {
  const { k, refs } = config;
  const { isInOceanRef, isDivingRef } = refs;

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
    for (let y = beachStartY; y <= k.height(); y += 10) {
      const progress = (y - beachStartY) / (k.height() - beachStartY);
      const baseX = beachBaseX + progress * k.width() * 0.15;
      const waveX = baseX + Math.sin(y * waveFrequency) * waveAmplitude;

      k.add([
        k.circle(3),
        k.pos(waveX, y),
        k.color(...CONST.COLORS.FOAM),
        k.opacity(0.6),
        k.z(CONST.Z_LAYERS.FOAM),
      ]);
    }

    // === BEACH DECORATIONS ===

    // Multiple palm trees across the beach
    CONST.DECORATIONS.PALM_TREES.forEach((palm: any) => {
      createPalmTree(k, k.width() * palm.x, k.height() * palm.y, palm.scale, CONST.Z_LAYERS.LIGHT_RAYS);
    });

    // Rocks on beach
    CONST.DECORATIONS.ROCKS.forEach((rock, index) => {
      k.add([
        k.sprite("beachrock", { frame: index % 4 }),
        k.pos(k.width() * rock.x, k.height() * rock.y),
        k.anchor("center"),
        k.scale(rock.scale),
        k.rotate(Math.random() * 360),
        k.z(CONST.Z_LAYERS.SUN),
      ]);
    });

    // Add pebbles
    CONST.DECORATIONS.PEBBLES.forEach((pebble: any, index: number) => {
      k.add([
        k.sprite("pebbles", { frame: index % 6 }),
        k.pos(k.width() * pebble.x, k.height() * pebble.y),
        k.anchor("center"),
        k.scale(1.5),
        k.z(CONST.Z_LAYERS.SUN),
      ]);
    });

    // Shells on beach
    CONST.DECORATIONS.SHELLS.forEach((shell, index) => {
      k.add([
        k.sprite("shell", { frame: index % 3 }),
        k.pos(k.width() * shell.x, k.height() * shell.y),
        k.anchor("center"),
        k.scale(1.5),
        k.rotate(Math.random() * 360),
        k.z(CONST.Z_LAYERS.SUN),
      ]);
    });

    // Clouds in sky
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

    // Spawn seagulls
    CONST.DECORATIONS.SEAGULLS.forEach(seagull => {
      createSeagull(k, k.width() * seagull.x, k.height() * seagull.y, seagull.speed);
    });

    // Spawn crabs on beach
    CONST.DECORATIONS.CRABS.forEach(crab => {
      createCrab(k, k.width() * crab.x, k.height() * crab.y, crab.direction, crab.speed, CONST.Z_LAYERS.SUN);
    });

    // Spawn starfish on beach
    CONST.DECORATIONS.STARFISH.forEach(starfish => {
      createStarfish(k, k.width() * starfish.x, k.height() * starfish.y, starfish.scale, CONST.Z_LAYERS.SUN);
    });

    // Create boat at water surface
    const boatBaseY = k.height() * CONST.LAYOUT.WATER_SURFACE_Y;
    const boatX = k.width() * CONST.LAYOUT.BOAT_X;
    const boat = createBoat(k, boatX, boatBaseY, CONST.Z_LAYERS.BOAT);

    // Boat bobbing animation
    boat.onUpdate(() => {
      boat.pos.y = boatBaseY + Math.sin(k.time() * CONST.MOTION.BOAT_BOB_SPEED) * CONST.MOTION.BOAT_BOB_AMPLITUDE;
    });

    // Reset refs on beach scene
    refs.depthRef.current = 0;
    refs.survivedRef.current = undefined;
  });
}
