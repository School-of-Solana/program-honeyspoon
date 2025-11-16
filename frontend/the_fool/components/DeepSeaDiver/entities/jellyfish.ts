/**
 * Jellyfish Entity - Creates floating jellyfish
 */

import type { GameObj, KAPLAYCtx } from "kaplay";
import * as CONST from "../sceneConstants";

/**
 * Create a floating jellyfish
 * @param k - Kaplay context
 * @param lightLevel - Current light level (0-1)
 * @returns Jellyfish game object
 */
export function createJellyfish(k: KAPLAYCtx, lightLevel: number): GameObj {
  const jellyfishY =
    CONST.JELLYFISH.SPAWN_Y_MIN + Math.random() * CONST.JELLYFISH.SPAWN_Y_RANGE;
  const jellyfishX = Math.random() * k.width();

  const jellyfish = k.add([
    k.sprite("jellyfish", { anim: "float" }),
    k.pos(jellyfishX, jellyfishY),
    k.anchor("center"),
    k.z(CONST.Z_LAYERS.JELLYFISH),
    k.scale(CONST.JELLYFISH.SCALE),
    k.opacity(CONST.JELLYFISH.OPACITY_BASE * lightLevel),
  ]);

  jellyfish.onUpdate(() => {
    jellyfish.pos.y -= CONST.JELLYFISH.VERTICAL_SPEED * k.dt();
    jellyfish.pos.x +=
      Math.sin(k.time() * CONST.JELLYFISH.HORIZONTAL_WAVE_SPEED + jellyfishY) *
      CONST.JELLYFISH.HORIZONTAL_WAVE_AMPLITUDE *
      k.dt();

    if (jellyfish.pos.y < -CONST.JELLYFISH.WRAP_OFFSET) {
      jellyfish.pos.y = k.height() + CONST.JELLYFISH.WRAP_OFFSET;
      jellyfish.pos.x = Math.random() * k.width();
    }
  });

  return jellyfish;
}
