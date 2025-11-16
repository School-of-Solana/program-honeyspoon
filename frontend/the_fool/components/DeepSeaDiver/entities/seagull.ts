/**
 * Seagull Entity - Creates flying seagulls for beach scene
 */

import type { KAPLAYCtx, GameObj } from "kaplay";
import * as CONST from "../sceneConstants";

/**
 * Create a flying seagull
 * @param k - Kaplay context
 * @param startX - Starting X position
 * @param startY - Starting Y position
 * @param speed - Horizontal flying speed
 * @returns Seagull game object
 */
export function createSeagull(k: KAPLAYCtx, startX: number, startY: number, speed: number): GameObj {
  const seagull = k.add([
    k.polygon([
      k.vec2(0, 0),
      k.vec2(-CONST.SEAGULL.WING_WIDTH, -CONST.SEAGULL.WING_HEIGHT),
      k.vec2(-CONST.SEAGULL.BODY_WIDTH, 0),
      k.vec2(0, -2),
      k.vec2(CONST.SEAGULL.BODY_WIDTH, 0),
      k.vec2(CONST.SEAGULL.WING_WIDTH, -CONST.SEAGULL.WING_HEIGHT),
    ]),
    k.pos(startX, startY),
    k.color(...CONST.COLORS.SEAGULL),
    k.outline(1, k.rgb(...CONST.COLORS.OUTLINE_CLOUD)),
    k.z(CONST.Z_LAYERS.SEAGULL),
  ]);

  seagull.onUpdate(() => {
    seagull.pos.x += speed * k.dt();
    seagull.pos.y += Math.sin(k.time() * CONST.SEAGULL.VERTICAL_WAVE_SPEED + startX) * CONST.SEAGULL.VERTICAL_WAVE_AMPLITUDE * k.dt();

    if (seagull.pos.x > k.width() + CONST.SEAGULL.WRAP_OFFSET) {
      seagull.pos.x = -CONST.SEAGULL.WRAP_OFFSET;
    }
  });

  return seagull;
}
