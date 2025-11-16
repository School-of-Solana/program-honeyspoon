/**
 * Water Effects - Caustics, light rays, particles
 */

import type { GameObj, KAPLAYCtx } from "kaplay";

/**
 * Create animated caustic light effect (underwater light patterns)
 */
export function createCaustics(
  k: KAPLAYCtx,
  lightLevel: number,
  depth: number,
): GameObj {
  const caustic = k.add([
    k.rect(k.width(), k.height()),
    k.pos(0, 0),
    k.opacity(Math.min(0.15 * lightLevel, 0.3)),
    k.z(5),
    "caustic",
  ]);

  // Animated wave pattern using sine waves
  let time = 0;
  caustic.onUpdate(() => {
    time += k.dt();

    // Fade out with depth
    const depthFade = Math.max(0, 1 - depth / 500);
    caustic.opacity =
      Math.min(0.15 * lightLevel * depthFade, 0.3) *
      (0.8 + Math.sin(time * 0.5) * 0.2);
  });

  return caustic;
}

/**
 * Create floating particles (debris, plankton)
 */
export function createFloatingParticle(
  k: KAPLAYCtx,
  _depth: number,
  lightLevel: number,
): GameObj {
  const x = Math.random() * k.width();
  const y = Math.random() * k.height();
  const size = 1 + Math.random() * 2;
  const speed = 10 + Math.random() * 20;
  const drift = (Math.random() - 0.5) * 30;

  const particle = k.add([
    k.circle(size),
    k.pos(x, y),
    k.opacity(0.2 + Math.random() * 0.3 * lightLevel),
    k.color(k.rgb(200, 200, 255)),
    k.z(15),
    "particle",
    {
      vx: drift,
      vy: -speed,
    },
  ]);

  particle.onUpdate(() => {
    particle.pos.x += particle.vx * k.dt();
    particle.pos.y += particle.vy * k.dt();

    // Wrap around
    if (particle.pos.y < -10) {
      particle.pos.y = k.height() + 10;
    }
    if (particle.pos.x < -10) {
      particle.pos.x = k.width() + 10;
    }
    if (particle.pos.x > k.width() + 10) {
      particle.pos.x = -10;
    }
  });

  // Auto-destroy after some time
  k.wait(10 + Math.random() * 10, () => {
    particle.destroy();
  });

  return particle;
}

/**
 * Create volumetric light shaft
 */
export function createLightShaft(
  k: KAPLAYCtx,
  x: number,
  width: number,
  lightLevel: number,
): GameObj {
  const shaft = k.add([
    k.rect(width, k.height()),
    k.pos(x, 0),
    k.opacity(0.05 * lightLevel),
    k.color(k.rgb(180, 200, 255)),
    k.z(3),
    "lightshaft",
  ]);

  let time = Math.random() * Math.PI * 2;
  shaft.onUpdate(() => {
    time += k.dt() * 0.3;
    shaft.opacity = (0.05 + Math.sin(time) * 0.02) * lightLevel;
  });

  return shaft;
}

/**
 * Create underwater dust motes
 */
export function createDustMote(k: KAPLAYCtx, lightLevel: number): GameObj {
  const x = Math.random() * k.width();
  const y = Math.random() * k.height();
  const size = 0.5 + Math.random();

  const mote = k.add([
    k.circle(size),
    k.pos(x, y),
    k.opacity(0.4 * lightLevel),
    k.color(k.rgb(255, 255, 255)),
    k.z(12),
    "dustmote",
    {
      vx: (Math.random() - 0.5) * 5,
      vy: (Math.random() - 0.5) * 5,
      time: Math.random() * Math.PI * 2,
    },
  ]);

  mote.onUpdate(() => {
    mote.time += k.dt();

    // Brownian motion
    mote.pos.x += mote.vx * k.dt() + Math.sin(mote.time * 2) * 0.5;
    mote.pos.y += mote.vy * k.dt() + Math.cos(mote.time * 3) * 0.5;

    // Pulse opacity
    mote.opacity = (0.3 + Math.sin(mote.time) * 0.1) * lightLevel;

    // Wrap around
    if (mote.pos.x < -10) { mote.pos.x = k.width() + 10; }
    if (mote.pos.x > k.width() + 10) { mote.pos.x = -10; }
    if (mote.pos.y < -10) { mote.pos.y = k.height() + 10; }
    if (mote.pos.y > k.height() + 10) { mote.pos.y = -10; }
  });

  return mote;
}

/**
 * Create water ripple effect at surface
 */
export function createSurfaceRipple(
  k: KAPLAYCtx,
  centerX: number,
  surfaceY: number,
): GameObj {
  const ripple = k.add([
    k.circle(10),
    k.pos(centerX, surfaceY),
    k.outline(2),
    k.opacity(0.8),
    k.color(k.rgb(100, 150, 200)),
    k.z(20),
    "ripple",
    {
      radius: 10,
      maxRadius: 80,
      speed: 100,
    },
  ]);

  ripple.onUpdate(() => {
    ripple.radius += ripple.speed * k.dt();
    ripple.opacity = 0.8 * (1 - ripple.radius / ripple.maxRadius);

    if (ripple.radius >= ripple.maxRadius) {
      ripple.destroy();
    }
  });

  return ripple;
}

/**
 * Create godray effect
 */
export function createGodRays(
  k: KAPLAYCtx,
  count: number,
  lightLevel: number,
): GameObj[] {
  const rays: GameObj[] = [];

  for (let i = 0; i < count; i++) {
    const x = (k.width() / count) * i + Math.random() * 50;
    const width = 40 + Math.random() * 80;
    const ray = createLightShaft(k, x, width, lightLevel);
    rays.push(ray);
  }

  return rays;
}

/**
 * Create underwater fog/haze layers
 */
export function createHazeLayer(
  k: KAPLAYCtx,
  depth: number,
  yPos: number,
): GameObj {
  const haze = k.add([
    k.rect(k.width(), 200),
    k.pos(0, yPos),
    k.opacity(0.1 + (depth / 1000) * 0.2),
    k.color(k.rgb(20, 30, 50)),
    k.z(8),
    "haze",
    {
      baseY: yPos,
      time: Math.random() * Math.PI * 2,
    },
  ]);

  haze.onUpdate(() => {
    haze.time += k.dt() * 0.2;
    haze.pos.y = haze.baseY + Math.sin(haze.time) * 10;
  });

  return haze;
}

/**
 * Spawn water effect particles at regular intervals
 */
export function spawnWaterEffects(
  k: KAPLAYCtx,
  depth: number,
  lightLevel: number,
): void {
  // Spawn floating particles
  k.loop(0.5, () => {
    if (Math.random() > 0.5 && lightLevel > 0.2) {
      createFloatingParticle(k, depth, lightLevel);
    }
  });

  // Spawn dust motes
  k.loop(0.3, () => {
    if (Math.random() > 0.6 && lightLevel > 0.3) {
      createDustMote(k, lightLevel);
    }
  });
}
