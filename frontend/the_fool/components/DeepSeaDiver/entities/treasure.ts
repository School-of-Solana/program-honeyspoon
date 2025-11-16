/**
 * Treasure Chest Entity
 * Handles animated treasure chest display with opening animation and coin particles
 */

import type { KAPLAYCtx } from "kaplay";
import * as CONST from "../sceneConstants";
import { createCoinParticle } from "./particles";

/**
 * Shows an animated treasure chest that opens and spawns coins
 * @param k - Kaplay context
 * @param x - X position
 * @param y - Y position
 */
export function showTreasureChest(k: KAPLAYCtx, x: number, y: number) {
  const chest = k.add([
    k.sprite("chest", { anim: "closed" }),
    k.pos(x, y + 120), // Position WAY below diver (was 60, now 120)
    k.anchor("center"),
    k.scale(5), // Make it BIGGER (was 3, now 5)
    k.opacity(0),
    k.z(18), // Behind diver (diver is z:20)
  ]);

  // Fade in
  let fadeIn = 0;
  const fadeInInterval = setInterval(() => {
    fadeIn += CONST.ANIMATION_TIMINGS.CHEST_FADE_IN;
    chest.opacity = Math.min(fadeIn, 1);
    if (fadeIn >= 1) clearInterval(fadeInInterval);
  }, CONST.ANIMATION_TIMINGS.FADE_INTERVAL);

  // Opening sequence
  setTimeout(() => {
    chest.play("opening");

    setTimeout(() => {
      chest.play("open");

      // Spawn coin particles
      for (let i = 0; i < CONST.SPAWN_RATES.COIN_COUNT; i++) {
        setTimeout(() => createCoinParticle(k, x, y + 120), i * CONST.ANIMATION_TIMINGS.COIN_SPAWN_INTERVAL);
      }
    }, CONST.ANIMATION_TIMINGS.CHEST_ANIMATION_DELAY);
  }, CONST.ANIMATION_TIMINGS.CHEST_OPEN_DELAY);

  // Fade out after animation
  setTimeout(() => {
    let fadeOut = 1;
    const fadeOutInterval = setInterval(() => {
      fadeOut -= CONST.ANIMATION_TIMINGS.CHEST_FADE_IN;
      chest.opacity = Math.max(fadeOut, 0);
      if (fadeOut <= 0) {
        clearInterval(fadeOutInterval);
        k.destroy(chest);
      }
    }, CONST.ANIMATION_TIMINGS.FADE_INTERVAL);
  }, CONST.ANIMATION_TIMINGS.CHEST_FADE_OUT_START);
}
