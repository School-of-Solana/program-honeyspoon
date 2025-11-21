import { describe, it, expect } from "vitest";
import { hexToRgb, rgbToHex, GAME_COLORS } from "../gameColors";

describe("gameColors", () => {
  describe("hexToRgb", () => {
    it("should convert valid hex color to RGB array", () => {
      expect(hexToRgb("#ff0000")).toEqual([255, 0, 0]);
      expect(hexToRgb("#00ff00")).toEqual([0, 255, 0]);
      expect(hexToRgb("#0000ff")).toEqual([0, 0, 255]);
    });

    it("should handle hex colors without # prefix", () => {
      expect(hexToRgb("ff0000")).toEqual([255, 0, 0]);
      expect(hexToRgb("00ff00")).toEqual([0, 255, 0]);
    });

    it("should handle lowercase and uppercase hex", () => {
      expect(hexToRgb("#FFFFFF")).toEqual([255, 255, 255]);
      expect(hexToRgb("#ffffff")).toEqual([255, 255, 255]);
      expect(hexToRgb("#FfFfFf")).toEqual([255, 255, 255]);
    });

    it("should handle game color constants", () => {
      expect(hexToRgb(GAME_COLORS.PRIMARY)).toEqual([0, 191, 255]);
      expect(hexToRgb(GAME_COLORS.SECONDARY)).toEqual([255, 215, 0]);
      expect(hexToRgb(GAME_COLORS.DANGER)).toEqual([255, 0, 0]);
    });

    it("should return white for invalid hex strings", () => {
      expect(hexToRgb("invalid")).toEqual([255, 255, 255]);
      expect(hexToRgb("#gggggg")).toEqual([255, 255, 255]);
      expect(hexToRgb("")).toEqual([255, 255, 255]);
    });
  });

  describe("rgbToHex", () => {
    it("should convert RGB values to hex string", () => {
      expect(rgbToHex(255, 0, 0)).toBe("#ff0000");
      expect(rgbToHex(0, 255, 0)).toBe("#00ff00");
      expect(rgbToHex(0, 0, 255)).toBe("#0000ff");
    });

    it("should handle single digit hex values with leading zeros", () => {
      expect(rgbToHex(0, 0, 0)).toBe("#000000");
      expect(rgbToHex(15, 15, 15)).toBe("#0f0f0f");
      expect(rgbToHex(1, 2, 3)).toBe("#010203");
    });

    it("should convert white correctly", () => {
      expect(rgbToHex(255, 255, 255)).toBe("#ffffff");
    });

    it("should handle mid-range values", () => {
      expect(rgbToHex(128, 128, 128)).toBe("#808080");
      expect(rgbToHex(100, 150, 200)).toBe("#6496c8");
    });

    it("should be reversible with hexToRgb", () => {
      const originalHex = "#00bfff";
      const rgb = hexToRgb(originalHex);
      const convertedHex = rgbToHex(rgb[0], rgb[1], rgb[2]);
      expect(convertedHex).toBe(originalHex);
    });

    it("should work with KAPLAY color constants", () => {
      const [r, g, b] = GAME_COLORS.KAPLAY.OCEAN_BG;
      const hex = rgbToHex(r, g, b);
      expect(hex).toBe("#142850");
    });
  });

  describe("GAME_COLORS constants", () => {
    it("should have all required color properties", () => {
      expect(GAME_COLORS.PRIMARY).toBeDefined();
      expect(GAME_COLORS.SECONDARY).toBeDefined();
      expect(GAME_COLORS.SUCCESS).toBeDefined();
      expect(GAME_COLORS.DANGER).toBeDefined();
      expect(GAME_COLORS.WARNING).toBeDefined();
    });

    it("should have KAPLAY color arrays", () => {
      expect(GAME_COLORS.KAPLAY.OCEAN_BG).toEqual([20, 40, 80]);
      expect(GAME_COLORS.KAPLAY.SKY).toEqual([135, 206, 250]);
      expect(GAME_COLORS.KAPLAY.TREASURE_GOLD).toEqual([255, 215, 0]);
    });

    it("should have consistent treasure colors", () => {
      expect(GAME_COLORS.TREASURE_GOLD).toBe("#ffd700");
      expect(GAME_COLORS.SECONDARY).toBe("#ffd700");
      // Verify KAPLAY treasure gold matches
      const [r, g, b] = GAME_COLORS.KAPLAY.TREASURE_GOLD;
      expect(rgbToHex(r, g, b)).toBe("#ffd700");
    });
  });
});
