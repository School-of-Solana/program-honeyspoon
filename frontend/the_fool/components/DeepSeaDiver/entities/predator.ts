/**
 * Predator Entity - Creates depth-based predator fish
 */

import type { GameObj, KAPLAYCtx } from "kaplay";
import * as CONST from "../sceneConstants";

/**
 * Get the appropriate predator type for a given depth
 * @param depth - Current depth in meters
 * @returns Predator sprite name or null if safe zone
 */
export function getDepthPredator(depth: number): string | null {
  if (depth < 100) {
    return null;
  } // Safe zone
  if (depth < 200) {
    return "shark";
  } // Already used for death
  if (depth < 400) {
    return "sawshark";
  } // Mid-depth menace
  if (depth < 600) {
    return "swordfish";
  } // Deep hunter (fast!)
  return "seaangler"; // Abyss zone (glowing lure)
}

/**
 * Create an ambient predator fish based on current depth
 * @param k - Kaplay context
 * @param currentDepth - Current depth in meters
 * @param lightLevel - Current light level (0-1)
 * @returns Predator game object or undefined if none spawned
 */
export function createAmbientPredator(
  k: KAPLAYCtx,
  currentDepth: number,
  lightLevel: number
): GameObj | undefined {
  const predator = getDepthPredator(currentDepth);
  if (!predator || predator === "shark") {
    return;
  } // Skip shark (used for death)

  const direction = Math.random() > 0.5 ? 1 : -1;
  const startX = direction > 0 ? -100 : k.width() + 100;
  const predatorY = 100 + Math.random() * 400;

  const creature = k.add([
    k.sprite(predator, { anim: "swim" }),
    k.pos(startX, predatorY),
    k.anchor("center"),
    k.z(CONST.Z_LAYERS.PREDATOR),
    k.scale(direction * 2.5, 2.5),
    k.opacity(CONST.PREDATOR.OPACITY * lightLevel),
  ]);

  // Add glowing light for seaangler
  if (predator === "seaangler") {
    const light = creature.add([
      k.circle(CONST.PREDATOR.GLOW_RADIUS),
      k.pos(direction > 0 ? 20 : -20, -10), // Lure position
      k.color(...CONST.COLORS.GLOW_YELLOW),
      k.opacity(CONST.PREDATOR.GLOW_OPACITY_MIN),
    ]);

    // Pulsing glow
    light.onUpdate(() => {
      light.opacity =
        CONST.OPACITY.GLOW_MIN +
        Math.sin(k.time() * CONST.MOTION.GLOW_PULSE_SPEED) *
          CONST.OPACITY.GLOW_RANGE;
      light.radius =
        CONST.PREDATOR.GLOW_RADIUS +
        Math.sin(k.time() * CONST.MOTION.GLOW_PULSE_SPEED) *
          CONST.MOTION.GLOW_RADIUS_VARIATION;
    });
  }

  creature.onUpdate(() => {
    const speed =
      predator === "swordfish"
        ? CONST.SPEEDS.PREDATOR_FAST
        : CONST.SPEEDS.PREDATOR_BASE;
    creature.pos.x += direction * speed * k.dt();
    creature.pos.y +=
      Math.sin(k.time() * CONST.MOTION.PREDATOR_WAVE_SPEED + predatorY) *
      CONST.MOTION.PREDATOR_WAVE_AMPLITUDE *
      k.dt();

    if (
      (direction > 0 &&
        creature.pos.x > k.width() + CONST.BOUNDARIES.SPAWN_OFFSET) ||
      (direction < 0 && creature.pos.x < -CONST.BOUNDARIES.SPAWN_OFFSET)
    ) {
      k.destroy(creature);
    }
  });

  return creature;
}
