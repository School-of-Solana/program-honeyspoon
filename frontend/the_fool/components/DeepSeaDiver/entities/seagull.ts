/**
 * Seagull Entity - Creates flying seagulls for beach scene
 * NOW USING ANIMATED SPRITES!
 */

import type { GameObj, KAPLAYCtx } from "kaplay";
import * as CONST from "../sceneConstants";

/**
 * Create a flying seagull with animated sprite
 * @param k - Kaplay context
 * @param startX - Starting X position
 * @param startY - Starting Y position
 * @param speed - Horizontal flying speed
 * @returns Seagull game object
 */
export function createSeagull(
  k: KAPLAYCtx,
  startX: number,
  startY: number,
  speed: number,
): GameObj {
  const seagull = k.add([
    k.sprite("seagull", { anim: "fly" }),
    k.pos(startX, startY),
    k.anchor("center"),
    k.scale(2), // Scale up the 16x16 sprite
    k.z(CONST.Z_LAYERS.SEAGULL),
  ]);

  seagull.onUpdate(() => {
    seagull.pos.x += speed * k.dt();
    seagull.pos.y +=
      Math.sin(k.time() * CONST.SEAGULL.VERTICAL_WAVE_SPEED + startX) *
      CONST.SEAGULL.VERTICAL_WAVE_AMPLITUDE *
      k.dt();

    // Flip sprite based on direction
    seagull.flipX = speed < 0;

    if (seagull.pos.x > k.width() + CONST.SEAGULL.WRAP_OFFSET) {
      seagull.pos.x = -CONST.SEAGULL.WRAP_OFFSET;
    }
    if (seagull.pos.x < -CONST.SEAGULL.WRAP_OFFSET) {
      seagull.pos.x = k.width() + CONST.SEAGULL.WRAP_OFFSET;
    }
  });

  return seagull;
}
