/**
 * Death Animation Entity
 * Handles predator attack animations with variety based on depth
 */

import type { KAPLAYCtx, GameObj } from "kaplay";
import { AnimationType } from "@/lib/types";
import * as CONST from "../sceneConstants";
import { getDepthPredator } from "./predator";

interface DeathAnimationState {
  isAnimating: boolean;
  animationType: AnimationType;
  divingSpeed: number;
}

/**
 * Triggers a death animation with a predator attack
 * @param k - Kaplay context
 * @param diver - The diver game object
 * @param depth - Current depth
 * @param state - Animation state object (will be mutated)
 * @param onComplete - Callback when animation completes (resets to beach)
 */
export function triggerDeathAnimation(
  k: KAPLAYCtx,
  diver: GameObj,
  depth: number,
  state: DeathAnimationState,
  onComplete: () => void
) {
  console.log('[CANVAS] Triggering death animation!');
  state.isAnimating = true;
  state.animationType = AnimationType.DEATH;
  state.divingSpeed = 0;

  // Choose predator based on current depth
  const predatorChoice = getDepthPredator(depth) || "shark";

  const direction = Math.random() > 0.5 ? 1 : -1;
  const startX = direction > 0 ? -100 : k.width() + 100;

  const creature = k.add([
    k.sprite(predatorChoice, { anim: "swim" }),
    k.pos(startX, diver.pos.y),
    k.anchor("center"),
    k.z(25),
    k.scale(direction * 3, 3),
  ]);

  // Custom death messages per predator (unused - handled by React overlay)
  const deathMessages: Record<string, string> = {
    shark: "SHARK ATTACK!",
    sawshark: "SAWSHARK!",
    swordfish: "IMPALED!",
    seaangler: "LURED TO DEATH!",
  };

  // Message now handled by React overlay

  let attackComplete = false;
  let deathAnimationComplete = false;
  let deathTimer = 0;

  creature.onUpdate(() => {
    if (attackComplete) {
      // After attack completes, wait 3 seconds then return to beach
      if (!deathAnimationComplete) {
        deathTimer += k.dt();
        if (deathTimer > CONST.DEATH.DELAY_BEFORE_FADE) {
          console.log('[CANVAS] ✅ Death animation complete! Returning to beach...');
          deathAnimationComplete = true;
          // Fade to black then go to beach
          const fadeOverlay = k.add([
            k.rect(k.width(), k.height()),
            k.pos(0, 0),
            k.color(...CONST.COLORS.FADE_BLACK),
            k.opacity(0),
            k.z(CONST.Z_LAYERS.FADE_OVERLAY),
          ]);

          let fadeProgress = 0;
          const fadeInterval = k.onUpdate(() => {
            fadeProgress += k.dt() * CONST.DEATH.FADE_SPEED;
            fadeOverlay.opacity = Math.min(fadeProgress, 1);

            if (fadeProgress >= 1) {
              fadeInterval.cancel();
              // Reset animation state before going to beach
              state.isAnimating = false;
              state.animationType = AnimationType.IDLE;
              onComplete();
            }
          });
        }
      }
      return;
    }

    const speed = CONST.ATTACK.SPEED;
    creature.pos.x += direction * speed * k.dt();
    creature.pos.y = diver.pos.y + Math.sin(k.time() * CONST.ATTACK.SHAKE_SPEED) * CONST.ATTACK.SHAKE_AMPLITUDE;

    if (Math.abs(creature.pos.x - diver.pos.x) < CONST.ATTACK.DISTANCE_THRESHOLD) {
      attackComplete = true;

      k.add([
        k.rect(k.width(), k.height()),
        k.pos(0, 0),
        k.color(...CONST.COLORS.ATTACK_FLASH),
        k.opacity(CONST.OPACITY.ATTACK_FLASH),
        k.z(CONST.Z_LAYERS.ATTACK_FLASH),
        k.lifespan(CONST.ATTACK.FLASH_DURATION),
      ]);

      // Message now handled by React overlay

      diver.onUpdate(() => {
        diver.pos.y += CONST.DEATH.SINK_SPEED * k.dt();
        diver.opacity -= k.dt() * CONST.DEATH.FADE_RATE;
      });

      creature.onUpdate(() => {
        creature.pos.x += direction * CONST.ATTACK.RETREAT_SPEED * k.dt();
        if (Math.abs(creature.pos.x) > k.width() + CONST.ATTACK.RETREAT_DISTANCE) {
          k.destroy(creature);
        }
      });
    }
  });
}
