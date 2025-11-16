/**
 * Bubble Entity - Creates animated bubbles that rise from the diver
 */

import type { KAPLAYCtx, GameObj } from "kaplay";
import * as CONST from "../sceneConstants";

/**
 * Create a bubble that rises and fades
 * @param k - Kaplay context
 * @param diverPos - Diver position object with x and y
 * @param divingSpeed - Current diving speed (for bubble offset)
 * @param x - Optional X position (defaults to near diver)
 * @param y - Optional Y position (defaults to below diver)
 * @returns Bubble game object
 */
export function createBubble(
  k: KAPLAYCtx,
  diverPos: { x: number; y: number },
  divingSpeed: number,
  x?: number,
  y?: number
): GameObj {
  const bubbleX =
    x !== undefined
      ? x
      : diverPos.x + (Math.random() - 0.5) * CONST.BUBBLE.SPAWN_OFFSET_X;
  const bubbleY =
    y !== undefined ? y : diverPos.y - CONST.BUBBLE.SPAWN_OFFSET_Y;
  const scale =
    CONST.BUBBLE.SCALE_BASE + Math.random() * CONST.BUBBLE.SCALE_RANDOM;

  const bubble = k.add([
    k.sprite("bubble", {
      frame: Math.floor(Math.random() * CONST.BUBBLE.FRAME_COUNT),
    }),
    k.pos(bubbleX, bubbleY),
    k.anchor("center"),
    k.scale(scale),
    k.opacity(CONST.BUBBLE.OPACITY_INITIAL),
    k.z(CONST.Z_LAYERS.BUBBLES),
    k.lifespan(CONST.BUBBLE.LIFESPAN),
  ]);

  bubble.onUpdate(() => {
    bubble.pos.y -= (CONST.BUBBLE.RISE_BASE_SPEED + divingSpeed) * k.dt();
    bubble.pos.x +=
      Math.sin(k.time() * CONST.BUBBLE.HORIZONTAL_WAVE_SPEED + bubbleY) *
      CONST.BUBBLE.HORIZONTAL_WAVE_AMPLITUDE *
      k.dt();
    bubble.opacity -= k.dt() * CONST.BUBBLE.OPACITY_FADE_RATE;

    // Pop animation when fading out
    if (bubble.opacity < CONST.BUBBLE.OPACITY_POP_THRESHOLD) {
      bubble.play("pop");
    }
  });

  return bubble;
}
