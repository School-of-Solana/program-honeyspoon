/**
 * Game constants and configuration
 */

// Debug flags
export const DEBUG_FLAGS = {
  CANVAS: false, // Set to true to enable canvas debug logging
  GAME: false, // Set to true to enable game logic debug logging
  WALLET: false, // Set to true to enable wallet debug logging
} as const;

// Core game math (FIXED - provably fair)
// CRITICAL: These values MUST match LocalGameChain.gameConfig
export const GAME_CONFIG = {
  // === Core Gameplay ===
  FIXED_BET: 0.05 as number, // SOL - Fixed bet amount for simplified gameplay (0.05 SOL = 50M lamports)
  BASE_SURVIVAL_PROBABILITY: 0.7 as number, // 70% at dive 1 (matches on-chain config)
  DECAY_CONSTANT: 0.08 as number, // -8% per dive (matches on-chain decay_per_dive_ppm: 8000 / 100000)
  MIN_WIN_PROB: 0.05 as number, // 5% minimum win probability floor (matches on-chain min_survival_ppm)

  // === Treasure Multipliers ===
  TREASURE_MULTIPLIER: 1.9 as number, // 1.9x multiplier per dive (for 5% house edge)
  HOUSE_EDGE: 0.05 as number, // 5% house edge (built into treasure multiplier)

  // === Limits ===
  MAX_PAYOUT_MULTIPLIER: 100 as number, // Maximum payout is 100x bet (0.05 SOL bet = 5 SOL max)
  MAX_DIVES: 5 as number, // Maximum number of dives (reduced from 50 to 5)

  // === Display ===
  LAMPORTS_PER_SOL: 1_000_000_000 as number, // For conversions
  INITIAL_WALLET_BALANCE: 1000 as number, // Starting wallet balance (SOL) for LOCAL mode only

  // === Legacy/Deprecated (keeping for compatibility) ===
  TARGET_EV: 0.95 as number, // 0.95 EV every round (player-friendly)
  BASE_WIN_PROB: 0.7 as number, // Alias for BASE_SURVIVAL_PROBABILITY
  MIN_BET: 0.05 as number, // Updated to match FIXED_BET (0.05 SOL = 50M lamports)
  MAX_BET: 0.1 as number, // Updated: 0.1 SOL max (100M lamports)
  STARTING_DEPTH: 0 as number, // Surface level
  DEPTH_PER_DIVE: 50 as number, // Meters deeper per round
  MAX_VISUAL_DEPTH: 2000 as number, // Visual cap for rendering
  SESSION_TIMEOUT_MS: (30 * 60 * 1000) as number, // 30 minutes (sessions expire after inactivity)
};

// Depth zones with visual themes
export const DEPTH_ZONES = {
  SUNLIGHT: { max: 200, color: "#4A90E2", light: 1.0, name: "Sunlight Zone" },
  TWILIGHT: { max: 1000, color: "#2E5C8A", light: 0.7, name: "Twilight Zone" },
  MIDNIGHT: { max: 4000, color: "#1A2F4A", light: 0.4, name: "Midnight Zone" },
  ABYSS: { max: 6000, color: "#0A1220", light: 0.1, name: "Abyssal Zone" },
  HADAL: { max: Infinity, color: "#000000", light: 0.05, name: "Hadal Zone" },
} as const;

// Procedural generation pools (roguelike elements)
export const SHIP_TYPES = [
  "Galleon",
  "Frigate",
  "Schooner",
  "Brigantine",
  "Caravel",
  "Clipper",
  "Man-o'-War",
  "Sloop",
  "Barque",
  "Corvette",
  "Yacht",
  "Steamship",
  "Longship",
  "Trireme",
  "Junk",
  "Dhow",
] as const;

export const ERAS = [
  { name: "Ancient", period: "800 BC - 500 AD", prefix: "Ancient" },
  { name: "Viking Age", period: "800 - 1066 AD", prefix: "Norse" },
  { name: "Medieval", period: "1066 - 1500", prefix: "Medieval" },
  { name: "Age of Discovery", period: "1500 - 1650", prefix: "Explorer" },
  { name: "Golden Age of Piracy", period: "1650 - 1730", prefix: "Pirate" },
  { name: "Colonial Era", period: "1730 - 1800", prefix: "Colonial" },
  { name: "Industrial Age", period: "1800 - 1900", prefix: "Victorian" },
  { name: "World War I", period: "1914 - 1918", prefix: "WWI" },
  { name: "World War II", period: "1939 - 1945", prefix: "WWII" },
  { name: "Modern Era", period: "1945 - Present", prefix: "Modern" },
] as const;

export const TREASURE_TYPES = [
  "Gold Doubloons",
  "Silver Pieces of Eight",
  "Jeweled Crowns",
  "Ancient Artifacts",
  "Cursed Gems",
  "Royal Regalia",
  "Ming Dynasty Porcelain",
  "Ivory Carvings",
  "Lost Manuscripts",
  "Diamond Necklaces",
  "Platinum Ingots",
  "Emerald Idols",
  "Ruby Goblets",
  "Sapphire Rings",
  "Pearl Strands",
  "Bronze Statues",
  "Gold Bullion",
  "Treasure Maps",
  "Ancient Coins",
  "Crystal Skulls",
] as const;

export const SHIP_NAME_PREFIXES = [
  "The",
  "HMS",
  "SS",
  "USS",
  "RMS",
  "Le",
  "La",
] as const;

export const SHIP_NAME_ADJECTIVES = [
  "Golden",
  "Black",
  "Crimson",
  "Shadow",
  "Cursed",
  "Lost",
  "Eternal",
  "Forgotten",
  "Phantom",
  "Sunken",
  "Ancient",
  "Doomed",
  "Vengeful",
  "Spectral",
  "Mysterious",
] as const;

export const SHIP_NAME_NOUNS = [
  "Pearl",
  "Serpent",
  "Kraken",
  "Leviathan",
  "Fortune",
  "Vengeance",
  "Destiny",
  "Dragon",
  "Phoenix",
  "Tempest",
  "Maelstrom",
  "Abyss",
  "Tide",
  "Storm",
  "Horizon",
  "Odyssey",
  "Mariner",
  "Voyager",
  "Explorer",
  "Treasure",
] as const;

// Sea creatures for ambiance
export const SEA_CREATURES = [
  { type: "fish", visual: "🐟", minDepth: 0, maxDepth: 500, danger: 0 },
  { type: "tropical", visual: "🐠", minDepth: 0, maxDepth: 300, danger: 0 },
  { type: "jellyfish", visual: "🪼", minDepth: 0, maxDepth: 800, danger: 1 },
  { type: "octopus", visual: "🐙", minDepth: 200, maxDepth: 1000, danger: 2 },
  { type: "shark", visual: "🦈", minDepth: 100, maxDepth: 1500, danger: 3 },
  { type: "whale", visual: "🐋", minDepth: 0, maxDepth: 2000, danger: 0 },
  { type: "squid", visual: "🦑", minDepth: 500, maxDepth: 2000, danger: 4 },
  {
    type: "anglerfish",
    visual: "🐡",
    minDepth: 1000,
    maxDepth: 2000,
    danger: 2,
  },
] as const;

// Visual emojis for treasure visualization
export const TREASURE_VISUALS = [
  "Amount:",
  "💎",
  "👑",
  "🏺",
  "📿",
  "🗿",
  "⚱️",
  "🔱",
  "💍",
  "📜",
] as const;

export const SHIPWRECK_VISUALS = ["🚢", "⚓", "🏴‍☠️", "⛵", "🛥️"] as const;
