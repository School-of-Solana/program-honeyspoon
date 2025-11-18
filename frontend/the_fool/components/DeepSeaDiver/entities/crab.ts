/**
 * Crab Entity - Creates animated crabs for beach scene
 */

import type { GameObj, KAPLAYCtx } from "kaplay";

/**
 * Create a walking crab
 * @param k - Kaplay context
 * @param startX - Starting X position
 * @param startY - Starting Y position
 * @param direction - Direction of movement (-1 for left, 1 for right)
 * @param speed - Horizontal walking speed
 * @param zIndex - Z-index for layering
 * @returns Crab game object
 */
export function createCrab(
  k: KAPLAYCtx,
  startX: number,
  startY: number,
  direction: number = 1,
  speed: number = 30,
  zIndex: number = 5
): GameObj {
  const crab = k.add([
    k.sprite("crab", { anim: "walk" }),
    k.pos(startX, startY),
    k.anchor("center"),
    k.scale(2), // Scale up the 16x16 sprite
    k.z(zIndex),
  ]);

  // Store movement properties
  const moveDirection = direction;
  const moveSpeed = speed;
  const minX = -50; // Off-screen left
  const maxX = k.width() + 50; // Off-screen right

  crab.onUpdate(() => {
    // Move horizontally
    crab.pos.x += moveDirection * moveSpeed * k.dt();

    // Flip sprite based on direction
    crab.flipX = moveDirection < 0;

    // Wrap around screen edges
    if (crab.pos.x > maxX) {
      crab.pos.x = minX;
    } else if (crab.pos.x < minX) {
      crab.pos.x = maxX;
    }
  });

  return crab;
}
