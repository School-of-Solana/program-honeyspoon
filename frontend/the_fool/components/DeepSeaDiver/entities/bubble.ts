/**
 * Bubble Entity - Creates animated bubbles that rise from the diver
 * Now with object pooling for improved performance
 */

import { ObjectPool } from "@/lib/objectPool";
import type { GameObj, KAPLAYCtx } from "kaplay";
import * as CONST from "../sceneConstants";

/**
 * Pool-ready bubble interface with reset capability
 */
interface PooledBubble extends GameObj {
  reset: (
    x: number,
    y: number,
    scale: number,
    frame: number,
    initialY: number
  ) => void;
  divingSpeed: number;
  initialY: number;
  lifeTime: number;
}

// Global bubble pool (one per scene)
let bubblePool: ObjectPool<PooledBubble> | null = null;

/**
 * Initialize bubble pool (call once when entering diving scene)
 * @param k - Kaplay context
 */
export function initBubblePool(k: KAPLAYCtx): void {
  if (bubblePool) {
    console.warn("[POOL] ⚠️ Bubble pool already initialized");
    return;
  }

  bubblePool = new ObjectPool<PooledBubble>(
    // Create function - creates a new bubble object
    () => {
      const bubble = k.add([
        k.sprite("bubble", { frame: 0 }),
        k.pos(0, 0),
        k.anchor("center"),
        k.scale(1),
        k.opacity(CONST.BUBBLE.OPACITY_INITIAL),
        k.z(CONST.Z_LAYERS.BUBBLES),
        k.state("idle"),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ]) as any as PooledBubble;

      // Add reset method to reinitialize bubble
      bubble.reset = (
        x: number,
        y: number,
        scale: number,
        frame: number,
        initialY: number
      ) => {
        bubble.pos.x = x;
        bubble.pos.y = y;
        bubble.scale = k.vec2(scale);
        bubble.frame = frame;
        bubble.opacity = CONST.BUBBLE.OPACITY_INITIAL;
        bubble.hidden = false;
        bubble.initialY = initialY;
        bubble.lifeTime = 0;
        bubble.enterState("active");
      };

      // Initialize custom properties
      bubble.divingSpeed = 0;
      bubble.initialY = 0;
      bubble.lifeTime = 0;

      // State management
      bubble.onStateEnter("active", () => {
        bubble.lifeTime = 0;
      });

      // Update loop - only runs when active
      bubble.onUpdate(() => {
        if (bubble.state !== "active") {
          return;
        }

        bubble.lifeTime += k.dt();

        // Rise animation
        bubble.pos.y -=
          (CONST.BUBBLE.RISE_BASE_SPEED + bubble.divingSpeed) * k.dt();
        bubble.pos.x +=
          Math.sin(
            k.time() * CONST.BUBBLE.HORIZONTAL_WAVE_SPEED + bubble.initialY
          ) *
          CONST.BUBBLE.HORIZONTAL_WAVE_AMPLITUDE *
          k.dt();
        bubble.opacity -= k.dt() * CONST.BUBBLE.OPACITY_FADE_RATE;

        // Pop animation when fading
        if (
          bubble.opacity < CONST.BUBBLE.OPACITY_POP_THRESHOLD &&
          bubble.opacity > 0
        ) {
          try {
            bubble.play("pop");
          } catch {
            // Sprite might not have pop animation - ignore
          }
        }

        // Return to pool when lifespan exceeded or off-screen
        if (bubble.lifeTime >= CONST.BUBBLE.LIFESPAN || bubble.pos.y < -100) {
          bubble.hidden = true;
          bubble.enterState("idle");
          if (bubblePool) {
            bubblePool.release(bubble);
          }
        }
      });

      return bubble;
    },
    // Reset function - prepares bubble for reuse
    (bubble) => {
      bubble.hidden = true;
      bubble.enterState("idle");
      bubble.lifeTime = 0;
    },
    20, // Initial pool size (preallocate 20 bubbles)
    100 // Max pool size (up to 100 bubbles can be created)
  );

  console.log("[POOL] ✅ Bubble pool initialized (size: 20, max: 100)");
}

/**
 * Get a bubble from the pool (replaces createBubble for pooled usage)
 * @param k - Kaplay context
 * @param diverPos - Diver position
 * @param divingSpeed - Current diving speed
 * @param x - Optional X position
 * @param y - Optional Y position
 * @returns Pooled bubble or null if pool exhausted
 */
export function getBubbleFromPool(
  k: KAPLAYCtx,
  diverPos: { x: number; y: number },
  divingSpeed: number,
  x?: number,
  y?: number
): PooledBubble | null {
  if (!bubblePool) {
    console.error(
      "[POOL] ❌ Bubble pool not initialized! Call initBubblePool() first."
    );
    return null;
  }

  const bubble = bubblePool.get();
  if (!bubble) {
    console.warn("[POOL] ⚠️ Bubble pool exhausted (max: 100 reached)");
    return null;
  }

  // Calculate position
  const bubbleX =
    x !== undefined
      ? x
      : diverPos.x + (Math.random() - 0.5) * CONST.BUBBLE.SPAWN_OFFSET_X;
  const bubbleY =
    y !== undefined ? y : diverPos.y - CONST.BUBBLE.SPAWN_OFFSET_Y;
  const scale =
    CONST.BUBBLE.SCALE_BASE + Math.random() * CONST.BUBBLE.SCALE_RANDOM;
  const frame = Math.floor(Math.random() * CONST.BUBBLE.FRAME_COUNT);

  // Reset bubble with new parameters
  bubble.reset(bubbleX, bubbleY, scale, frame, bubbleY);
  bubble.divingSpeed = divingSpeed;

  return bubble;
}

/**
 * Destroy bubble pool (call when leaving diving scene)
 */
export function destroyBubblePool(): void {
  if (bubblePool) {
    bubblePool.clear();
    bubblePool = null;
    console.log("[POOL] 🗑️ Bubble pool destroyed");
  }
}

/**
 * Get pool statistics (for debugging/monitoring)
 * @returns Pool stats or zeros if not initialized
 */
export function getBubblePoolStats() {
  return bubblePool?.getStats() || { total: 0, inUse: 0, available: 0 };
}

/**
 * Legacy function - creates a bubble without pooling
 * Kept for backward compatibility
 *
 * @deprecated Use getBubbleFromPool() for better performance
 */
export function createBubble(
  k: KAPLAYCtx,
  diverPos: { x: number; y: number },
  divingSpeed: number,
  x?: number,
  y?: number
): GameObj {
  // Try to use pool if available
  const pooledBubble = bubblePool
    ? getBubbleFromPool(k, diverPos, divingSpeed, x, y)
    : null;

  if (pooledBubble) {
    return pooledBubble;
  }

  // Fallback to direct creation (original implementation)
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
      try {
        bubble.play("pop");
      } catch {
        // Sprite might not have animation - ignore
      }
    }
  });

  return bubble;
}
