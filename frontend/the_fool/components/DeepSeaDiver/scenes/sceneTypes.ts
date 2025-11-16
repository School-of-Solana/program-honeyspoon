/**
 * Scene Type Definitions
 * Shared interfaces for all game scenes
 */

import type { KAPLAYCtx } from "kaplay";
import type { RefObject } from "react";

/**
 * Shared refs that all scenes need access to
 */
export interface SceneRefs {
  isDivingRef: RefObject<boolean>;
  survivedRef: RefObject<boolean | undefined>;
  shouldSurfaceRef: RefObject<boolean>;
  depthRef: RefObject<number>;
  treasureRef: RefObject<number>;
  isInOceanRef: RefObject<boolean>;
}

/**
 * Scene configuration
 */
export interface SceneConfig {
  k: KAPLAYCtx;
  refs: SceneRefs;
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
