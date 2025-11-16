/**
 * Beach Decorations - Additional visual elements for the beach scene
 */

import type { GameObj, KAPLAYCtx } from "kaplay";

/**
 * Create animated cloud
 */
export function createCloud(
  k: KAPLAYCtx,
  x: number,
  y: number,
  speed: number = 10,
): GameObj {
  const cloud = k.add([
    k.rect(80 + Math.random() * 40, 30 + Math.random() * 20),
    k.pos(x, y),
    k.opacity(0.6 + Math.random() * 0.3),
    k.color(k.rgb(255, 255, 255)),
    k.z(1),
    "cloud",
    {
      speed,
    },
  ]);

  cloud.onUpdate(() => {
    cloud.pos.x += cloud.speed * k.dt();

    // Wrap around
    if (cloud.pos.x > k.width() + 100) {
      cloud.pos.x = -100;
    }
  });

  return cloud;
}

/**
 * Create beach umbrella
 */
export function createBeachUmbrella(
  k: KAPLAYCtx,
  x: number,
  groundY: number,
): GameObj {
  const umbrella = k.add([k.pos(x, groundY - 60), k.z(15), "umbrella"]);

  // Pole
  const pole = umbrella.add([
    k.rect(4, 60),
    k.pos(0, 0),
    k.color(k.rgb(139, 90, 43)),
    k.anchor("center"),
  ]);

  // Canopy (triangle-ish)
  const canopy = umbrella.add([
    k.polygon([
      k.vec2(-30, -60),
      k.vec2(30, -60),
      k.vec2(25, -50),
      k.vec2(-25, -50),
    ]),
    k.pos(0, 0),
    k.color(k.rgb(255, 69, 0)),
    k.anchor("center"),
  ]);

  // Gentle sway (rotation not supported on all components, so we skip it)
  let time = Math.random() * Math.PI * 2;
  umbrella.onUpdate(() => {
    time += k.dt() * 0.5;
    // Sway animation would go here if rotation was needed
  });

  return umbrella;
}

/**
 * Create sandcastle
 */
export function createSandcastle(
  k: KAPLAYCtx,
  x: number,
  groundY: number,
): GameObj {
  const castle = k.add([k.pos(x, groundY - 30), k.z(14), "sandcastle"]);

  const sandColor = k.rgb(238, 214, 175);

  // Main tower
  castle.add([
    k.rect(30, 40),
    k.pos(0, 0),
    k.color(sandColor),
    k.anchor("center"),
  ]);

  // Side towers
  castle.add([
    k.rect(15, 25),
    k.pos(-25, 8),
    k.color(sandColor),
    k.anchor("center"),
  ]);

  castle.add([
    k.rect(15, 25),
    k.pos(25, 8),
    k.color(sandColor),
    k.anchor("center"),
  ]);

  // Flags
  castle.add([
    k.rect(2, 15),
    k.pos(0, -20),
    k.color(k.rgb(200, 50, 50)),
    k.anchor("center"),
  ]);

  return castle;
}

/**
 * Create beach ball
 */
export function createBeachBall(
  k: KAPLAYCtx,
  x: number,
  groundY: number,
): GameObj {
  const ball = k.add([
    k.circle(15),
    k.pos(x, groundY - 20),
    k.color(k.rgb(255, 100, 100)),
    k.z(16),
    "beachball",
    {
      bounceTime: Math.random() * Math.PI * 2,
    },
  ]);

  ball.onUpdate(() => {
    ball.bounceTime += k.dt() * 2;
    const bounce = Math.abs(Math.sin(ball.bounceTime)) * 10;
    ball.pos.y = groundY - 20 - bounce;
  });

  return ball;
}

/**
 * Create shore wave (white foam)
 */
export function createShoreWave(
  k: KAPLAYCtx,
  groundY: number,
  waterY: number,
): GameObj {
  const wave = k.add([
    k.rect(k.width(), 8),
    k.pos(0, waterY + 2),
    k.opacity(0.7),
    k.color(k.rgb(255, 255, 255)),
    k.z(11),
    "shorewave",
    {
      baseY: waterY + 2,
      time: 0,
    },
  ]);

  wave.onUpdate(() => {
    wave.time += k.dt();
    const motion = Math.sin(wave.time * 2) * 3;
    wave.pos.y = wave.baseY + motion;
    wave.opacity = 0.5 + Math.sin(wave.time * 2) * 0.2;
  });

  return wave;
}

/**
 * Create footprints in sand
 */
export function createFootprints(
  k: KAPLAYCtx,
  x: number,
  groundY: number,
  count: number = 5,
): GameObj[] {
  const prints: GameObj[] = [];

  for (let i = 0; i < count; i++) {
    const print = k.add([
      k.circle(6),
      k.pos(x + i * 20, groundY - 5 + (i % 2) * 5),
      k.opacity(0.3),
      k.color(k.rgb(180, 150, 120)),
      k.z(10),
      "footprint",
    ]);

    prints.push(print);
  }

  return prints;
}

/**
 * Create beach sign (e.g., "DANGER: DEEP WATER")
 */
export function createBeachSign(
  k: KAPLAYCtx,
  x: number,
  groundY: number,
  text: string,
): GameObj {
  const sign = k.add([k.pos(x, groundY - 80), k.z(15), "sign"]);

  // Post
  sign.add([
    k.rect(6, 60),
    k.pos(0, 20),
    k.color(k.rgb(139, 90, 43)),
    k.anchor("center"),
  ]);

  // Sign board
  const board = sign.add([
    k.rect(100, 40),
    k.pos(0, 0),
    k.color(k.rgb(255, 200, 0)),
    k.outline(2),
    k.anchor("center"),
  ]);

  // Text
  board.add([
    k.text(text, {
      size: 8,
      width: 90,
      align: "center",
    }),
    k.pos(0, 0),
    k.color(k.rgb(0, 0, 0)),
    k.anchor("center"),
  ]);

  // Slight sway (disabled due to rotation limitations)
  let time = Math.random() * Math.PI * 2;
  sign.onUpdate(() => {
    time += k.dt() * 0.8;
    // Rotation would go here
  });

  return sign;
}

/**
 * Create tide pool with small creatures
 */
export function createTidePool(
  k: KAPLAYCtx,
  x: number,
  groundY: number,
): GameObj {
  const pool = k.add([
    k.circle(30),
    k.pos(x, groundY - 10),
    k.color(k.rgb(100, 150, 200)),
    k.opacity(0.6),
    k.z(10),
    "tidepool",
  ]);

  // Add small creatures
  for (let i = 0; i < 3; i++) {
    const creature = pool.add([
      k.circle(2),
      k.pos((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 15),
      k.color(k.rgb(255, 180, 100)),
      k.anchor("center"),
      {
        time: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 0.5,
      },
    ]);

    creature.onUpdate(() => {
      creature.time += k.dt() * creature.speed;
      creature.pos.x = Math.sin(creature.time) * 15;
      creature.pos.y = Math.cos(creature.time * 0.7) * 8;
    });
  }

  return pool;
}

/**
 * Create driftwood
 */
export function createDriftwood(
  k: KAPLAYCtx,
  x: number,
  groundY: number,
): GameObj {
  const wood = k.add([
    k.rect(60 + Math.random() * 40, 8 + Math.random() * 4),
    k.pos(x, groundY - 10),
    k.color(k.rgb(101, 67, 33)),
    k.rotate(Math.random() * 30 - 15),
    k.z(12),
    "driftwood",
  ]);

  return wood;
}

/**
 * Create flying bird (distant)
 */
export function createDistantBird(k: KAPLAYCtx, x: number, y: number): GameObj {
  const bird = k.add([
    k.text("v", { size: 12 }),
    k.pos(x, y),
    k.color(k.rgb(50, 50, 50)),
    k.opacity(0.7),
    k.z(2),
    "bird",
    {
      speed: 30 + Math.random() * 20,
      bobTime: Math.random() * Math.PI * 2,
    },
  ]);

  const baseY = y;
  bird.onUpdate(() => {
    bird.pos.x += bird.speed * k.dt();
    bird.bobTime += k.dt() * 3;
    bird.pos.y = baseY + Math.sin(bird.bobTime) * 5;

    // Wrap around
    if (bird.pos.x > k.width() + 50) {
      bird.pos.x = -50;
      bird.pos.y = 50 + Math.random() * 150;
    }
  });

  return bird;
}

/**
 * Spawn multiple beach decorations
 */
export function spawnBeachDecorations(
  k: KAPLAYCtx,
  groundY: number,
  waterY: number,
): void {
  const width = k.width();

  // Clouds
  for (let i = 0; i < 5; i++) {
    createCloud(
      k,
      Math.random() * width,
      30 + Math.random() * 100,
      5 + Math.random() * 15,
    );
  }

  // Beach items (spread across beach)
  const beachItems = [
    () => createBeachUmbrella(k, width * 0.7, groundY),
    () => createSandcastle(k, width * 0.8, groundY),
    () => createBeachBall(k, width * 0.65, groundY),
    () => createBeachSign(k, width * 0.3, groundY, "DEEP\nWATER"),
    () => createTidePool(k, width * 0.4, groundY),
    () => createDriftwood(k, width * 0.5, groundY),
    () => createDriftwood(k, width * 0.85, groundY),
  ];

  beachItems.forEach((createFn) => createFn());

  // Footprints
  createFootprints(k, width * 0.55, groundY, 8);

  // Distant birds
  for (let i = 0; i < 3; i++) {
    createDistantBird(k, Math.random() * width, 50 + Math.random() * 100);
  }

  // Shore waves
  createShoreWave(k, groundY, waterY);
}
