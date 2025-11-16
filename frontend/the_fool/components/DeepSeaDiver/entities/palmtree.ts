/**
 * Palm Tree Entity - Creates palm trees for beach scene
 */

import type { GameObj, KAPLAYCtx } from "kaplay";

/**
 * Create a palm tree
 * @param k - Kaplay context
 * @param x - X position
 * @param y - Y position (base of trunk)
 * @param scale - Scale multiplier
 * @param zIndex - Z-index for layering
 * @returns Palm tree game object
 */
export function createPalmTree(
  k: KAPLAYCtx,
  x: number,
  y: number,
  scale: number = 3,
  zIndex: number = 5,
): GameObj {
  const palm = k.add([
    k.sprite("palmtree"),
    k.pos(x, y),
    k.anchor("bot"), // Anchor at bottom of trunk
    k.scale(scale),
    k.rotate(0), // Add rotate component for animation
    k.z(zIndex),
  ]);

  // Add gentle swaying animation
  let swayTime = Math.random() * Math.PI * 2; // Random start phase

  palm.onUpdate(() => {
    swayTime += k.dt() * 0.5;
    palm.angle = Math.sin(swayTime) * 2; // Sway 2 degrees left and right
  });

  return palm;
}
