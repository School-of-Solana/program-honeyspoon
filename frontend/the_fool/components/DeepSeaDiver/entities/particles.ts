/**
 * Particle Effects - Creates visual effects for treasure collection
 */

import type { GameObj, KAPLAYCtx } from "kaplay";
import * as CONST from "../sceneConstants";

/**
 * Create a single coin particle that flies out in a random direction
 * @param k - Kaplay context
 * @param x - Starting X position
 * @param y - Starting Y position
 * @returns Coin particle game object
 */
export function createCoinParticle(
  k: KAPLAYCtx,
  x: number,
  y: number,
): GameObj {
  const angle = Math.random() * Math.PI * 2;
  const speed = CONST.COIN.SPEED_MIN + Math.random() * CONST.COIN.SPEED_RANDOM;

  const coin = k.add([
    k.sprite("coin", { anim: "spin" }),
    k.pos(x, y),
    k.anchor("center"),
    k.scale(CONST.COIN.SCALE_MIN + Math.random() * CONST.COIN.SCALE_RANDOM),
    k.opacity(1),
    k.z(CONST.Z_LAYERS.COIN),
    k.lifespan(CONST.COIN.LIFESPAN),
  ]);

  coin.onUpdate(() => {
    coin.pos.x += Math.cos(angle) * speed * k.dt();
    coin.pos.y +=
      Math.sin(angle) * speed * k.dt() - CONST.COIN.UPWARD_BIAS * k.dt();
    coin.opacity -= k.dt() * CONST.COIN.OPACITY_FADE_RATE;
  });

  return coin;
}

/**
 * Create a burst of gold particle circles (visual effect for treasure)
 * @param k - Kaplay context
 * @param x - Center X position
 * @param y - Center Y position
 */
export function createTreasureParticles(
  k: KAPLAYCtx,
  x: number,
  y: number,
): void {
  for (let i = 0; i < CONST.SPAWN_RATES.PARTICLE_COUNT; i++) {
    const angle = (Math.PI * 2 * i) / CONST.SPAWN_RATES.PARTICLE_COUNT;
    const speed =
      CONST.PARTICLE.SPEED_MIN + Math.random() * CONST.PARTICLE.SPEED_RANDOM;

    const particle = k.add([
      k.circle(CONST.PARTICLE.CIRCLE_RADIUS),
      k.pos(x, y),
      k.anchor("center"),
      k.color(...CONST.COLORS.PARTICLE_GOLD),
      k.opacity(1),
      k.z(CONST.Z_LAYERS.PARTICLE),
      k.lifespan(CONST.PARTICLE.LIFESPAN),
    ]);

    particle.onUpdate(() => {
      particle.pos.x += Math.cos(angle) * speed * k.dt();
      particle.pos.y += Math.sin(angle) * speed * k.dt();
      particle.opacity -= k.dt();
    });
  }
}
