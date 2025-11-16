/**
 * Scene Constants - All magic numbers extracted for maintainability
 */

// ===== ANIMATION TIMINGS =====
export const ANIMATION_TIMINGS = {
  DIVING_DURATION: 2.5, // seconds
  TREASURE_PULSE_CYCLES: 4, // Math.PI * 4
  DEATH_DELAY: 3.0, // seconds after attack
  FADE_IN_DURATION: 0.8, // seconds
  SURFACING_DURATION: 3.0, // seconds
  JUMP_DURATION: 1.0, // seconds
  CHEST_FADE_IN: 0.1, // opacity increment per interval
  CHEST_OPEN_DELAY: 500, // ms
  CHEST_ANIMATION_DELAY: 400, // ms
  CHEST_FADE_OUT_START: 2000, // ms
  COIN_SPAWN_INTERVAL: 30, // ms between coins
  BUBBLE_SPAWN_INTERVAL: 0.15, // seconds
  FADE_INTERVAL: 50, // ms
} as const;

// ===== SPEEDS & VELOCITIES =====
export const SPEEDS = {
  DIVING_MAX: 400,
  DIVING_ACCELERATION: {
    RAMP_UP: 0.3, // first 30% of dive
    RAMP_DOWN: 0.2, // last 20% of dive
  },
  BUBBLE_RISE: 40,
  BUBBLE_HORIZONTAL: 30,
  BUBBLE_FADE: 0.5,
  FISH_BASE: 50,
  FISH_VERTICAL_WAVE: 15,
  JELLYFISH_VERTICAL: 15,
  JELLYFISH_HORIZONTAL: 30,
  PREDATOR_BASE: 60,
  PREDATOR_FAST: 120, // swordfish
  CREATURE_ATTACK: 300,
  CREATURE_RETREAT: 150,
  DIVER_SINK: 100,
  DIVER_FADE: 0.5,
  SEAGULL_BASE: 50,
  SEAGULL_VERTICAL_WAVE: 20,
  COIN_BASE: 80,
  COIN_RANDOM: 80,
  COIN_UPWARD: 50,
  COIN_FADE: 0.7,
  PARTICLE_BASE: 100,
  PARTICLE_RANDOM: 100,
  SPEED_LINE_MULTIPLIER: 1.5,
} as const;

// ===== Z-INDEX LAYERS =====
// Fixed: No duplicate z-index values, proper layering
export const Z_LAYERS = {
  BACKGROUND: 0,
  SKY: 1,
  BEACH: 2, // Fixed: was 1, now unique
  SUN: 3, // Fixed: was 2, now unique
  PARALLAX_FAR: 4, // Fixed: was 2, now unique
  SEAGULL: 5, // Fixed: was 4
  LIGHT_RAYS: 6, // Fixed: was 3
  JELLYFISH: 7, // Fixed: was 6
  PARALLAX_MID: 8, // Fixed: was 4
  WATER_SURFACE: 9, // Fixed: was 5
  FOAM: 10, // Fixed: was 7
  FISH: 11, // Fixed: was 7, now unique
  PARALLAX_NEAR: 12, // Fixed: was 6
  CORAL_FOREGROUND: 13, // Fixed: was 8
  PREDATOR: 14, // Fixed: was 9
  BUBBLES: 15,
  BOAT: 18,
  CHEST: 18, // Same as boat is OK (both behind diver)
  DIVER: 20,
  SPEED_LINES: 25,
  PARTICLE: 25, // Same as speed lines is OK
  COIN: 26,
  ATTACK_FLASH: 99,
  MESSAGE: 100,
  FADE_OVERLAY: 200,
  TRANSITION_OVERLAY: 300,
} as const;

// ===== LAYOUT POSITIONS (as fractions of screen size) =====
export const LAYOUT = {
  DIVER_X: 0.5, // center horizontally
  DIVER_Y_OFFSET: 100, // pixels from center
  BOAT_X: 0.25, // left side (UI on right)
  SKY_HEIGHT: 0.6,
  SUN_X: 0.8,
  SUN_Y: 0.15,
  BEACH_START_Y: 0.6,
  BEACH_BASE_X: 0.45,
  BEACH_DIAGONAL_WIDTH: 0.15,
  PALM_X: 0.85,
  PALM_Y: 0.63,
  WATER_SURFACE_Y: 0.6,
  SURFACING_START_Y: 0.8,
} as const;

// ===== SCALES & SIZES =====
export const SCALES = {
  DIVER: 2.5,
  // Note: BOAT constants moved to BOAT section below (no duplication)
  SUN_RADIUS: 50,
  SUN_RAY_LENGTH: 80,
  SUN_RAY_WIDTH: 8,
  CLOUD_BASE: 20,
  SEAGULL_SIZE: 10,
  // Note: PALM_TREE constants removed (using sprite now)
  SHELL_SIZE: 10,
  ROCK_SIZE: { min: 12, max: 20 },
  WAVE_AMPLITUDE: 40,
  WAVE_FREQUENCY: 0.008,
  BUBBLE_SCALE: { min: 1.5, max: 3 },
  FISH_SCALE_SMALL: 2,
  FISH_SCALE_LARGE: 1.5,
  JELLYFISH_SCALE: 2,
  PREDATOR_SCALE: 2.5,
  CREATURE_SCALE: 3,
  CHEST_SCALE: 3,
  COIN_SCALE: { min: 2, max: 3 },
  LIGHT_CIRCLE: 15,
} as const;

// ===== PARALLAX SETTINGS =====
export const PARALLAX = {
  LAYERS: [
    {
      speed: -30,
      sprite: "seaweed",
      frames: 96,
      count: 10,
      scale: [2, 3],
      opacity: [0.3, 0.5],
      z: Z_LAYERS.PARALLAX_FAR,
    },
    {
      speed: -80,
      sprite: "corals",
      frames: 28,
      count: 12,
      scale: [1.5, 2.5],
      opacity: [0.5, 0.7],
      z: Z_LAYERS.PARALLAX_MID,
    },
    {
      speed: -150,
      sprite: "seaweed",
      frames: 96,
      count: 15,
      scale: [2.5, 3.5],
      opacity: [0.7, 0.9],
      z: Z_LAYERS.PARALLAX_NEAR,
    },
  ],
  IDLE_SPEED_MULTIPLIER: 0.1,
} as const;

// ===== SPAWN RATES & INTERVALS =====
export const SPAWN_RATES = {
  FISH_INTERVAL: 1.5, // seconds
  FISH_CHANCE: 0.3, // 70% chance
  JELLYFISH_INTERVAL: 4, // seconds
  JELLYFISH_CHANCE: 0.5, // 50% chance
  PREDATOR_INTERVAL: 6, // seconds
  PREDATOR_CHANCE: 0.6, // 40% chance
  PREDATOR_MIN_DEPTH: 100, // meters
  BUBBLE_INTERVAL: 0.3, // seconds
  BUBBLE_CHANCE: 0.5, // 50% chance
  COIN_COUNT: 15,
  PARTICLE_COUNT: 30,
  LIGHT_RAY_COUNT: 5,
  SUN_RAY_COUNT: 8,
  SPLASH_PARTICLE_COUNT: 20,
  SPEED_LINE_COUNT: 30,
  CLOUD_COUNT: 3,
  SEAGULL_COUNT: 3,
} as const;

// ===== COLORS =====
export const COLORS = {
  BACKGROUND_OCEAN: [20, 40, 80] as [number, number, number],
  SKY: [135, 206, 250] as [number, number, number],
  SUN: [255, 220, 100] as [number, number, number],
  SUN_RAY: [255, 240, 150] as [number, number, number],
  WATER_SURFACE: [100, 150, 255] as [number, number, number],
  BEACH: [194, 178, 128] as [number, number, number],
  FOAM: [255, 255, 255] as [number, number, number],
  BOAT_HULL: [101, 67, 33] as [number, number, number],
  BOAT_DECK: [139, 90, 43] as [number, number, number],
  BOAT_FLAG: [200, 50, 50] as [number, number, number],
  ANCHOR_ROPE: [150, 120, 80] as [number, number, number],
  PALM_TRUNK: [101, 67, 33] as [number, number, number],
  PALM_LEAF: [34, 139, 34] as [number, number, number],
  ROCK: [100, 100, 100] as [number, number, number],
  SHELL: [255, 240, 220] as [number, number, number],
  CLOUD: [255, 255, 255] as [number, number, number],
  SEAGULL: [255, 255, 255] as [number, number, number],
  BUBBLE: [150, 200, 255] as [number, number, number],
  LIGHT_RAY: [255, 255, 200] as [number, number, number],
  SPEED_LINE: [150, 200, 255] as [number, number, number],
  SPLASH: [150, 200, 255] as [number, number, number],
  PARTICLE_GOLD: [255, 215, 0] as [number, number, number],
  ATTACK_FLASH: [255, 0, 0] as [number, number, number],
  FADE_BLACK: [0, 0, 0] as [number, number, number],
  GLOW_YELLOW: [255, 255, 150] as [number, number, number],
  // Outline colors
  OUTLINE_BOAT_HULL: [70, 40, 20] as [number, number, number],
  OUTLINE_FLAG: [150, 30, 30] as [number, number, number],
  OUTLINE_ANCHOR: [100, 80, 50] as [number, number, number],
  OUTLINE_ROCK: [70, 70, 70] as [number, number, number],
  OUTLINE_SHELL: [200, 180, 160] as [number, number, number],
  OUTLINE_CLOUD: [200, 200, 200] as [number, number, number],
} as const;

// ===== OPACITY VALUES =====
export const OPACITY = {
  FOAM: 0.6,
  CLOUD: 0.8,
  LIGHT_RAY_BASE: 0.08,
  LIGHT_RAY_MIN: 0.3,
  BUBBLE_BASE: 0.8,
  BUBBLE_POP: 0.3,
  FISH_BASE: 0.8,
  PREDATOR_BASE: 0.8,
  ATTACK_FLASH: 0.8,
  FADE_OVERLAY_START: 0.8,
  GLOW_MIN: 0.4,
  GLOW_RANGE: 0.3,
} as const;

// ===== PHYSICS & MOTION =====
export const MOTION = {
  BOAT_BOB_AMPLITUDE: 8,
  BOAT_BOB_SPEED: 1.5,
  BOAT_ROCK_AMPLITUDE: 2,
  BOAT_ROCK_SPEED: 1.2,
  DIVER_BOB_AMPLITUDE: 10,
  DIVER_BOB_SPEED: 2,
  FISH_WAVE_SPEED: 2,
  JELLYFISH_WAVE_SPEED: 2,
  PREDATOR_WAVE_AMPLITUDE: 20,
  PREDATOR_WAVE_SPEED: 2,
  CREATURE_SHAKE_AMPLITUDE: 10,
  CREATURE_SHAKE_SPEED: 20,
  SUN_RAY_ROTATION_SPEED: 20,
  SEAGULL_WAVE_SPEED: 3,
  JUMP_ARC_HEIGHT: 50,
  JUMP_HORIZONTAL_SPEED: 30,
  JUMP_ROTATION_DEGREES: 90,
  GLOW_PULSE_SPEED: 8,
  GLOW_RADIUS_VARIATION: 5,
} as const;

// ===== DEPTH THRESHOLDS (for predator spawning) =====
export const DEPTH_ZONES = {
  SAFE: 0,
  SHARK_START: 100,
  SHARK_END: 200,
  SAWSHARK_END: 400,
  SWORDFISH_END: 600,
  ABYSS: 600,
} as const;

// ===== DARKNESS PROGRESSION =====
export const DARKNESS = {
  BASE_OPACITY: 0.1,
  DEPTH_DIVISOR: 1000,
  DEPTH_MULTIPLIER: 0.7,
  MAX_OPACITY: 0.8,
} as const;

// ===== BOUNDARIES & WRAP POINTS =====
export const BOUNDARIES = {
  SPAWN_OFFSET: 100, // pixels off-screen
  DESPAWN_OFFSET: 50, // pixels off-screen
  ATTACK_DISTANCE: 50, // pixels
  BUBBLE_WRAP_OFFSET: 50,
  JELLYFISH_WRAP_OFFSET: 50,
} as const;

// ===== DECORATIVE ELEMENTS POSITIONS =====
export const DECORATIONS = {
  ROCKS: [
    { x: 0.5, y: 0.68, scale: 2.5 },
    { x: 0.62, y: 0.75, scale: 2.0 },
    { x: 0.75, y: 0.78, scale: 2.3 },
    { x: 0.88, y: 0.82, scale: 1.8 },
    { x: 0.56, y: 0.72, scale: 2.2 },
    { x: 0.7, y: 0.79, scale: 1.9 },
  ],
  PEBBLES: [
    { x: 0.53, y: 0.66 },
    { x: 0.59, y: 0.69 },
    { x: 0.66, y: 0.74 },
    { x: 0.73, y: 0.77 },
    { x: 0.82, y: 0.81 },
    { x: 0.9, y: 0.83 },
    { x: 0.95, y: 0.86 },
  ],
  PALM_TREES: [
    { x: 0.88, y: 0.7, scale: 4 }, // Main palm (far right)
    { x: 0.7, y: 0.68, scale: 3.5 }, // Medium palm
    { x: 0.55, y: 0.65, scale: 3.2 }, // Smaller palm
    { x: 0.82, y: 0.73, scale: 3.8 }, // Another palm
    { x: 0.95, y: 0.75, scale: 3.0 }, // Small palm far right
  ],
  SHELLS: [
    { x: 0.52, y: 0.65 },
    { x: 0.64, y: 0.7 },
    { x: 0.72, y: 0.76 },
    { x: 0.8, y: 0.8 },
    { x: 0.92, y: 0.85 },
  ],
  CLOUDS: [
    { x: 0.2, y: 0.15, scale: 1 },
    { x: 0.5, y: 0.25, scale: 0.8 },
    { x: 0.75, y: 0.12, scale: 1.2 },
  ],
  SEAGULLS: [
    { x: 0.3, y: 0.2, speed: 50 },
    { x: 0.6, y: 0.15, speed: 60 },
    { x: 0.1, y: 0.25, speed: 45 },
  ],
  CRABS: [
    { x: 0.55, y: 0.67, direction: 1, speed: 30 },
    { x: 0.68, y: 0.73, direction: -1, speed: 25 },
    { x: 0.85, y: 0.82, direction: 1, speed: 35 },
  ],
  STARFISH: [
    { x: 0.58, y: 0.71, scale: 1.8 },
    { x: 0.76, y: 0.77, scale: 1.5 },
    { x: 0.9, y: 0.84, scale: 2.0 },
  ],
} as const;

// ===== SPEED LINE SETTINGS =====
export const SPEED_LINES = {
  WIDTH_MIN: 2,
  WIDTH_RANDOM: 3,
  HEIGHT_MIN: 20,
  HEIGHT_RANDOM: 40,
  OPACITY_DIVISOR: 200,
  MAX_OPACITY: 0.8,
} as const;

// ===== BUBBLE SETTINGS =====
export const BUBBLE = {
  SPAWN_OFFSET_X: 30, // pixels left/right of diver
  SPAWN_OFFSET_Y: 10, // pixels below diver
  SCALE_BASE: 1.5,
  SCALE_RANDOM: 1.5,
  OPACITY_INITIAL: 0.8,
  OPACITY_FADE_RATE: 0.27,
  OPACITY_POP_THRESHOLD: 0.3,
  LIFESPAN: 3, // seconds
  RISE_BASE_SPEED: 60,
  HORIZONTAL_WAVE_SPEED: 3,
  HORIZONTAL_WAVE_AMPLITUDE: 30,
  FRAME_COUNT: 10,
} as const;

// ===== FISH SETTINGS =====
export const FISH = {
  SPAWN_Y_MIN: 100,
  SPAWN_Y_RANGE: 400,
  SPAWN_OFFSET: 50, // pixels off-screen
  DESPAWN_OFFSET: 50,
  TYPES: ["fish1", "fish2", "fish3"] as const,
  SCALE_SMALL: 2, // fish1
  SCALE_LARGE: 1.5, // fish2/3
  OPACITY_BASE: 0.8,
  HORIZONTAL_SPEED: 50,
  VERTICAL_WAVE_AMPLITUDE: 15,
  VERTICAL_WAVE_SPEED: 2,
} as const;

// ===== JELLYFISH SETTINGS =====
export const JELLYFISH = {
  SPAWN_Y_MIN: 100,
  SPAWN_Y_RANGE: 400,
  SCALE: 2,
  OPACITY_BASE: 0.7,
  VERTICAL_SPEED: 15, // upward drift
  HORIZONTAL_WAVE_SPEED: 2,
  HORIZONTAL_WAVE_AMPLITUDE: 30,
  WRAP_OFFSET: 50,
} as const;

// ===== PREDATOR SETTINGS =====
export const PREDATOR = {
  SPAWN_OFFSET: 100,
  SPAWN_Y_MIN: 100,
  SPAWN_Y_RANGE: 400,
  SCALE: 2.5,
  OPACITY: 0.8,
  SPEED_NORMAL: 60,
  SPEED_FAST: 120, // swordfish
  WAVE_AMPLITUDE: 20,
  WAVE_SPEED: 2,
  GLOW_RADIUS: 15,
  GLOW_RADIUS_VARIATION: 5,
  GLOW_OPACITY_MIN: 0.4,
  GLOW_OPACITY_RANGE: 0.3,
  GLOW_PULSE_SPEED: 8,
  GLOW_OFFSET_X: 20, // seaangler lure
  GLOW_OFFSET_Y: -10,
} as const;

// ===== BOAT SETTINGS =====
export const BOAT = {
  HULL_WIDTH_LEFT: 60,
  HULL_WIDTH_RIGHT: 70,
  HULL_HEIGHT: 20,
  DECK_PLANK_WIDTH: 12,
  DECK_PLANK_HEIGHT: 5,
  DECK_PLANK_SPACING: 15,
  DECK_PLANK_START: -50,
  DECK_PLANK_END: 60,
  RAIL_WIDTH: 3,
  RAIL_HEIGHT: 25,
  RAIL_OFFSET_X: 55,
  RAIL_OFFSET_Y: -10,
  MAST_WIDTH: 4,
  MAST_HEIGHT: 80, // Taller mast
  MAST_OFFSET_X: -20,
  MAST_OFFSET_Y: 0, // Fixed: mast bottom at deck level (0)
  FLAG_WIDTH: 30,
  FLAG_HEIGHT: 20,
  FLAG_OFFSET_Y: -82, // Adjusted to match taller mast
  ANCHOR_ROPE_RADIUS: 5,
  ANCHOR_ROPE_X: 30,
  ANCHOR_ROPE_Y: -5,
  OUTLINE_WIDTH: 3,
  OUTLINE_WIDTH_THIN: 2,
  OUTLINE_WIDTH_FLAG: 1,
} as const;

// ===== SEAGULL SETTINGS =====
export const SEAGULL = {
  WING_WIDTH: 10,
  WING_HEIGHT: 5,
  BODY_WIDTH: 8,
  VERTICAL_WAVE_AMPLITUDE: 20,
  VERTICAL_WAVE_SPEED: 3,
  WRAP_OFFSET: 50,
} as const;

// ===== COIN SETTINGS =====
export const COIN = {
  SCALE_MIN: 2,
  SCALE_RANDOM: 1,
  SPEED_MIN: 80,
  SPEED_RANDOM: 80,
  UPWARD_BIAS: 50,
  OPACITY_FADE_RATE: 0.7,
  LIFESPAN: 1.5,
} as const;

// ===== PARTICLE SETTINGS =====
export const PARTICLE = {
  CIRCLE_RADIUS: 3,
  SPEED_MIN: 100,
  SPEED_RANDOM: 100,
  LIFESPAN: 1,
} as const;

// ===== ATTACK SETTINGS =====
export const ATTACK = {
  SPEED: 300,
  SHAKE_AMPLITUDE: 10,
  SHAKE_SPEED: 20,
  DISTANCE_THRESHOLD: 50,
  FLASH_DURATION: 0.3,
  RETREAT_SPEED: 150,
  RETREAT_DISTANCE: 200,
} as const;

// ===== DEATH ANIMATION SETTINGS =====
export const DEATH = {
  DELAY_BEFORE_FADE: 3.0,
  FADE_SPEED: 2,
  SINK_SPEED: 100,
  FADE_RATE: 0.5,
} as const;
