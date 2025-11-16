/**
 * Fish Entity - Creates animated fish that swim horizontally
 */

import type { GameObj, KAPLAYCtx } from "kaplay";
import * as CONST from "../sceneConstants";

/**
 * Create a swimming fish
 * @param k - Kaplay context
 * @param lightLevel - Current light level (0-1)
 * @returns Fish game object
 */
export function createFish(k: KAPLAYCtx, lightLevel: number): GameObj {
  const fishType =
    CONST.FISH.TYPES[Math.floor(Math.random() * CONST.FISH.TYPES.length)];
  const fishY =
    CONST.FISH.SPAWN_Y_MIN + Math.random() * CONST.FISH.SPAWN_Y_RANGE;
  const direction = Math.random() > 0.5 ? 1 : -1;
  const startX =
    direction > 0
      ? -CONST.FISH.SPAWN_OFFSET
      : k.width() + CONST.FISH.SPAWN_OFFSET;
  const scaleMultiplier =
    fishType === "fish1" ? CONST.FISH.SCALE_SMALL : CONST.FISH.SCALE_LARGE;

  const fish = k.add([
    k.sprite(fishType, { anim: "swim" }),
    k.pos(startX, fishY),
    k.anchor("center"),
    k.z(CONST.Z_LAYERS.FISH),
    k.scale(
      direction > 0 ? scaleMultiplier : -scaleMultiplier,
      scaleMultiplier,
    ),
    k.opacity(lightLevel * CONST.FISH.OPACITY_BASE),
  ]);

  fish.onUpdate(() => {
    fish.pos.x += direction * CONST.FISH.HORIZONTAL_SPEED * k.dt();
    fish.pos.y +=
      Math.sin(k.time() * CONST.FISH.VERTICAL_WAVE_SPEED + fishY) *
      CONST.FISH.VERTICAL_WAVE_AMPLITUDE *
      k.dt();

    if (
      (direction > 0 && fish.pos.x > k.width() + CONST.FISH.DESPAWN_OFFSET) ||
      (direction < 0 && fish.pos.x < -CONST.FISH.DESPAWN_OFFSET)
    ) {
      k.destroy(fish);
    }
  });

  return fish;
}
