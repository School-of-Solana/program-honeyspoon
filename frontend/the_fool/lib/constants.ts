/**
 * Game constants and configuration
 */

// Core game math (FIXED - provably fair)
export const GAME_CONFIG = {
  HOUSE_EDGE: 0.15, // 15% house edge (FIXED FOREVER)
  TARGET_EV: 0.85, // 0.85 EV every round
  BASE_WIN_PROB: 0.7, // Start at 70% survival rate
  DECAY_CONSTANT: 0.08, // Difficulty curve
  MIN_WIN_PROB: 0.05, // Floor at 5% (always possible)

  // Betting limits
  MIN_BET: 10,
  MAX_BET: 500,
  FIXED_BET: 50, // Single fixed bet amount for simplified gameplay

  // Depth mechanics
  STARTING_DEPTH: 0, // Surface level
  DEPTH_PER_DIVE: 50, // Meters deeper per round
  MAX_VISUAL_DEPTH: 2000, // Visual cap for rendering
} as const;

// Depth zones with visual themes
export const DEPTH_ZONES = {
  SUNLIGHT: { max: 200, color: "#4A90E2", light: 1.0, name: "Sunlight Zone" },
  TWILIGHT: { max: 500, color: "#2E5C8A", light: 0.7, name: "Twilight Zone" },
  MIDNIGHT: { max: 1000, color: "#1A2F4A", light: 0.4, name: "Midnight Zone" },
  ABYSS: { max: 2000, color: "#0A1220", light: 0.1, name: "Abyssal Zone" },
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
  { type: "anglerfish", visual: "🐡", minDepth: 1000, maxDepth: 2000, danger: 2 },
] as const;

// Visual emojis for treasure visualization
export const TREASURE_VISUALS = [
  "💰",
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

export const SHIPWRECK_VISUALS = [
  "🚢",
  "⚓",
  "🏴‍☠️",
  "⛵",
  "🛥️",
] as const;
