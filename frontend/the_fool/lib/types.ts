/**
 * Type definitions for Abyss Fortune game
 */

export interface GameState {
  isPlaying: boolean;
  diveNumber: number;
  currentTreasure: number;
  initialBet: number;
  depth: number;
  oxygenLevel: number;
  sessionId: string;
  discoveredShipwrecks: Shipwreck[];
}

export interface DiveStats {
  diveNumber: number;
  survivalProbability: number;
  multiplier: number;
  expectedValue: number;
  depth: number;
  threshold: number;
  depthZone: DepthZone;
  oxygenRemaining: number;
}

export interface DepthZone {
  name: string;
  color: string;
  light: number;
  max: number;
}

export interface Shipwreck {
  id: string;
  depth: number;
  name: string;
  era: string;
  shipType: string;
  treasureType: string;
  visual: string;
  discovered: boolean;
  treasureValue: number;
}

export interface DiveResult {
  success: boolean;
  randomRoll: number;
  threshold: number;
  survived: boolean;
  newTreasureValue: number;
  totalTreasure: number;
  diveNumber: number;
  depth: number;
  survivalProbability: number;
  multiplier: number;
  timestamp: number;
  shipwreck?: Shipwreck;
}

export interface SeaCreature {
  type: string;
  visual: string;
  minDepth: number;
  maxDepth: number;
  danger: number;
}
