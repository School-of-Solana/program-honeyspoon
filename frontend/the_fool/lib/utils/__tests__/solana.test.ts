import { describe, it, expect } from "vitest";
import {
  solToLamports,
  lamportsToSol,
  formatSol,
  LAMPORTS_PER_SOL,
} from "../solana";

describe("solana utils", () => {
  describe("solToLamports", () => {
    it("should convert SOL to lamports correctly", () => {
      expect(solToLamports(1)).toBe(1_000_000_000n);
      expect(solToLamports(0.5)).toBe(500_000_000n);
      expect(solToLamports(10)).toBe(10_000_000_000n);
    });

    it("should handle fractional SOL amounts", () => {
      expect(solToLamports(0.001)).toBe(1_000_000n);
      expect(solToLamports(0.0001)).toBe(100_000n);
    });

    it("should handle zero", () => {
      expect(solToLamports(0)).toBe(0n);
    });
  });

  describe("lamportsToSol", () => {
    it("should convert lamports to SOL correctly", () => {
      expect(lamportsToSol(1_000_000_000n)).toBe(1);
      expect(lamportsToSol(500_000_000n)).toBe(0.5);
      expect(lamportsToSol(10_000_000_000n)).toBe(10);
    });

    it("should handle small lamport amounts", () => {
      expect(lamportsToSol(1_000_000n)).toBe(0.001);
      expect(lamportsToSol(100_000n)).toBe(0.0001);
    });

    it("should handle zero", () => {
      expect(lamportsToSol(0n)).toBe(0);
    });

    it("should accept number type as well", () => {
      expect(lamportsToSol(1_000_000_000)).toBe(1);
    });
  });

  describe("formatSol", () => {
    it("should format lamports as SOL string", () => {
      expect(formatSol(1_000_000_000n)).toBe("1.00 SOL");
      expect(formatSol(500_000_000n)).toBe("0.50 SOL");
      expect(formatSol(10_000_000_000n)).toBe("10.00 SOL");
    });

    it("should respect custom decimals", () => {
      expect(formatSol(1_234_567_890n, 4)).toBe("1.2346 SOL");
      expect(formatSol(1_000_000_000n, 0)).toBe("1 SOL");
    });

    it("should handle number type as well", () => {
      expect(formatSol(1_000_000_000)).toBe("1.00 SOL");
    });
  });

  describe("LAMPORTS_PER_SOL", () => {
    it("should equal 1 billion", () => {
      expect(LAMPORTS_PER_SOL).toBe(1_000_000_000);
    });
  });
});
