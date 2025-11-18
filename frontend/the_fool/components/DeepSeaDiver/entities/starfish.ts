/**
 * Starfish Entity - Creates decorative starfish for beach scene
 */

import type { GameObj, KAPLAYCtx } from "kaplay";

/**
 * Create a static starfish decoration
 * @param k - Kaplay context
 * @param x - X position
 * @param y - Y position
 * @param scale - Scale multiplier
 * @param zIndex - Z-index for layering
 * @returns Starfish game object
 */
export function createStarfish(
  k: KAPLAYCtx,
  x: number,
  y: number,
  scale: number = 1.5,
  zIndex: number = 5
): GameObj {
  const starfish = k.add([
    k.sprite("starfish"),
    k.pos(x, y),
    k.anchor("center"),
    k.scale(scale),
    k.rotate(Math.random() * 360), // Random rotation for variety
    k.z(zIndex),
  ]);

  return starfish;
}
