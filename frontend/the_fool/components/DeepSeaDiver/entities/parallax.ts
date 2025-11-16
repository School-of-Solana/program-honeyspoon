/**
 * Parallax Background Entity
 * Handles infinite scrolling background layers
 */

import type { GameObj, KAPLAYCtx } from "kaplay";

/**
 * Creates a parallax layer part with random sprites
 * @param k - Kaplay context
 * @param canvasHeight - Height of the canvas
 * @param spriteName - Name of the sprite to use
 * @param frames - Number of frames in the sprite
 * @param count - Number of sprites to create
 * @param scaleRange - Min and max scale values
 * @param opacityRange - Min and max opacity values
 * @param zIndex - Z-index for layering
 * @param yOffset - Y position offset
 * @returns Container object with all sprites
 */
export function createLayerPart(
  k: KAPLAYCtx,
  canvasHeight: number,
  spriteName: string,
  frames: number,
  count: number,
  scaleRange: [number, number],
  opacityRange: [number, number],
  zIndex: number,
  yOffset: number = 0,
): GameObj {
  const container = k.add([k.pos(0, yOffset), k.z(zIndex)]);

  for (let i = 0; i < count; i++) {
    container.add([
      k.sprite(spriteName, { frame: Math.floor(Math.random() * frames) }),
      k.pos(Math.random() * k.width(), Math.random() * canvasHeight),
      k.anchor("center"),
      k.scale(scaleRange[0] + Math.random() * (scaleRange[1] - scaleRange[0])),
      k.opacity(
        opacityRange[0] + Math.random() * (opacityRange[1] - opacityRange[0]),
      ),
    ]);
  }

  return container;
}
