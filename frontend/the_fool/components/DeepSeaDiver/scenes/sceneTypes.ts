/**
 * Scene Type Definitions
 * Shared interfaces for all game scenes
 *
 * With Zustand, we no longer need refs!
 * Scenes read directly from the store
 */

import type { KAPLAYCtx } from "kaplay";

/**
 * Scene configuration
 * No more refs - scenes use useGameStore directly!
 */
export interface SceneConfig {
  k: KAPLAYCtx;
  hexToRgb: (hex: string) => { r: number; g: number; b: number };
}

/**
 * Scene data passed between scenes
 */
export interface SurfacingSceneData {
  treasure?: number;
}

export interface DivingSceneData {
  initialDepth?: number;
}
