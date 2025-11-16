/**
 * Global Game Color Palette
 * Used consistently across both Kaplay (canvas) and React UI (NES.css)
 * 8-bit retro aesthetic with cohesive theming
 */

export const GAME_COLORS = {
  // Primary Game Colors
  PRIMARY: "#00bfff", // Cyan - depth meter, water
  SECONDARY: "#ffd700", // Gold - treasure, coins
  SUCCESS: "#99ff55", // Green - success states, survival
  DANGER: "#ff0000", // Red - danger, dive button, death
  WARNING: "#ffa500", // Orange - warnings

  // UI Elements
  BACKGROUND_DARK: "#212529", // Dark gray - containers
  BACKGROUND_DARKER: "rgba(33, 37, 41, 0.95)", // Semi-transparent dark
  TEXT_PRIMARY: "#ffffff", // White text
  TEXT_SECONDARY: "#aaaaaa", // Gray text
  BORDER_LIGHT: "#4a5568", // Light borders

  // Game States
  TREASURE_GOLD: "#ffd700",
  TREASURE_LIGHT: "#ffed4e",
  DEPTH_CYAN: "#00bfff",
  DEPTH_DARK: "#0080c0",
  SURVIVAL_GREEN: "#4ade80",
  DANGER_RED: "#ef4444",

  // Canvas/Kaplay Colors (RGB arrays)
  KAPLAY: {
    OCEAN_BG: [20, 40, 80] as [number, number, number],
    SKY: [135, 206, 250] as [number, number, number],
    WATER_SURFACE: [100, 150, 255] as [number, number, number],
    TREASURE_GOLD: [255, 215, 0] as [number, number, number],
    DEPTH_CYAN: [0, 191, 255] as [number, number, number],
    SUCCESS_GREEN: [74, 222, 128] as [number, number, number],
    DANGER_RED: [239, 68, 68] as [number, number, number],
  },
} as const;

// Helper to convert hex to RGB array for Kaplay
export function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : [255, 255, 255];
}

// Helper to convert RGB to hex for React
export function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((x) => {
        const hex = x.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
      })
      .join("")
  );
}
