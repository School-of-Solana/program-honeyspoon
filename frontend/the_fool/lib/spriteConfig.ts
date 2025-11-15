/**
 * Sprite Configuration
 * Auto-generated from SpearFishing Assets Pack folder structure
 * Frame sizes are parsed from folder names (e.g., "Diver-32x32")
 */

export interface SpriteConfig {
  name: string;
  file: string;
  sliceX: number;
  sliceY: number;
  frameSize: { w: number; h: number };
  totalFrames: number;
  anims?: {
    [key: string]: {
      from: number;
      to: number;
      loop?: boolean;
      speed?: number;
    };
  };
}

export const SPRITE_CONFIGS: SpriteConfig[] = [
  {
    name: "diver",
    file: "/sprites/diver.png",
    sliceX: 7,
    sliceY: 4,
    frameSize: { w: 32, h: 32 },
    totalFrames: 28,
    anims: {
      idle: { from: 0, to: 1, loop: true, speed: 3 },
      swim: { from: 7, to: 13, loop: true, speed: 8 },
    },
  },
  {
    name: "shark",
    file: "/sprites/shark.png",
    sliceX: 8,
    sliceY: 2,
    frameSize: { w: 32, h: 32 },
    totalFrames: 16,
    anims: {
      swim: { from: 0, to: 7, loop: true, speed: 8 },
    },
  },
  {
    name: "fish1",
    file: "/sprites/fish1.png",
    sliceX: 8,
    sliceY: 4,
    frameSize: { w: 16, h: 16 },
    totalFrames: 32,
    anims: {
      swim: { from: 0, to: 7, loop: true, speed: 10 },
    },
  },
  {
    name: "fish2",
    file: "/sprites/fish2.png",
    sliceX: 8,
    sliceY: 4,
    frameSize: { w: 32, h: 16 },
    totalFrames: 32,
    anims: {
      swim: { from: 0, to: 7, loop: true, speed: 10 },
    },
  },
  {
    name: "fish3",
    file: "/sprites/fish3.png",
    sliceX: 8,
    sliceY: 4,
    frameSize: { w: 32, h: 16 },
    totalFrames: 32,
    anims: {
      swim: { from: 0, to: 7, loop: true, speed: 10 },
    },
  },
  {
    name: "jellyfish",
    file: "/sprites/jellyfish.png",
    sliceX: 4,
    sliceY: 2,
    frameSize: { w: 32, h: 16 },
    totalFrames: 8,
    anims: {
      float: { from: 0, to: 7, loop: true, speed: 6 },
    },
  },
  {
    name: "sawshark",
    file: "/sprites/sawshark.png",
    sliceX: 8,
    sliceY: 2,
    frameSize: { w: 48, h: 32 },
    totalFrames: 16,
    anims: {
      swim: { from: 0, to: 7, loop: true, speed: 8 },
    },
  },
  {
    name: "seaangler",
    file: "/sprites/seaangler.png",
    sliceX: 8,
    sliceY: 2,
    frameSize: { w: 32, h: 32 },
    totalFrames: 16,
    anims: {
      swim: { from: 0, to: 7, loop: true, speed: 6 },
    },
  },
  {
    name: "swordfish",
    file: "/sprites/swordfish.png",
    sliceX: 8,
    sliceY: 1,
    frameSize: { w: 48, h: 32 },
    totalFrames: 8,
    anims: {
      swim: { from: 0, to: 7, loop: true, speed: 10 },
    },
  },
  {
    name: "seaweed",
    file: "/sprites/seaweed.png",
    sliceX: 12,
    sliceY: 8,
    frameSize: { w: 16, h: 32 },
    totalFrames: 96,
  },
  {
    name: "corals",
    file: "/sprites/corals.png",
    sliceX: 4,
    sliceY: 7,
    frameSize: { w: 16, h: 16 },
    totalFrames: 28,
  },
  {
    name: "tiles",
    file: "/sprites/tiles.png",
    sliceX: 11,
    sliceY: 13,
    frameSize: { w: 16, h: 16 },
    totalFrames: 143,
  },
  {
    name: "bubble",
    file: "/sprites/bubble.png",
    sliceX: 10,
    sliceY: 1,
    frameSize: { w: 8, h: 8 },
    totalFrames: 10,
    anims: {
      pop: { from: 0, to: 9, loop: false, speed: 15 },
    },
  },
  {
    name: "chest",
    file: "/sprites/chest.png",
    sliceX: 3,
    sliceY: 4,
    frameSize: { w: 16, h: 16 },
    totalFrames: 12,
    anims: {
      closed: { from: 0, to: 0, loop: false },
      opening: { from: 0, to: 2, loop: false, speed: 5 },
      open: { from: 3, to: 3, loop: false },
    },
  },
  {
    name: "coin",
    file: "/sprites/coin.png",
    sliceX: 8,
    sliceY: 1,
    frameSize: { w: 16, h: 16 },
    totalFrames: 8,
    anims: {
      spin: { from: 0, to: 7, loop: true, speed: 12 },
    },
  },
];

// Helper function to get sprite config by name
export function getSpriteConfig(name: string): SpriteConfig | undefined {
  return SPRITE_CONFIGS.find((s) => s.name === name);
}

// Helper function to get all creature sprites (fish, sharks, etc.)
export function getCreatureSprites(): SpriteConfig[] {
  return SPRITE_CONFIGS.filter((s) =>
    ["fish1", "fish2", "fish3", "jellyfish", "shark", "sawshark", "seaangler", "swordfish"].includes(s.name)
  );
}

// Helper function to get all environment sprites (seaweed, corals, tiles)
export function getEnvironmentSprites(): SpriteConfig[] {
  return SPRITE_CONFIGS.filter((s) =>
    ["seaweed", "corals", "tiles"].includes(s.name)
  );
}
