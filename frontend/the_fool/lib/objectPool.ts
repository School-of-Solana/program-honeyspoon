/**
 * Object Pool for Performance Optimization
 *
 * Reduces GC pressure by reusing objects instead of creating/destroying them
 */

import type { GameObj, KAPLAYCtx } from "kaplay";

export interface PooledObject {
  obj: GameObj;
  inUse: boolean;
}

export class ObjectPool<T extends GameObj> {
  private pool: PooledObject[] = [];
  private createFn: () => T;
  private resetFn: (obj: T) => void;
  private maxSize: number;

  constructor(
    createFn: () => T,
    resetFn: (obj: T) => void,
    initialSize: number = 10,
    maxSize: number = 100
  ) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.maxSize = maxSize;

    // Pre-create initial objects
    for (let i = 0; i < initialSize; i++) {
      this.pool.push({
        obj: this.createFn() as T,
        inUse: false,
      });
    }
  }

  /**
   * Get an object from the pool
   */
  get(): T | null {
    // Find unused object
    for (const item of this.pool) {
      if (!item.inUse) {
        item.inUse = true;
        this.resetFn(item.obj as T);
        return item.obj as T;
      }
    }

    // Create new if under max size
    if (this.pool.length < this.maxSize) {
      const obj = this.createFn();
      this.pool.push({ obj: obj as GameObj, inUse: true });
      return obj;
    }

    return null; // Pool exhausted
  }

  /**
   * Return object to pool
   */
  release(obj: T): void {
    const item = this.pool.find((item) => item.obj === obj);
    if (item) {
      item.inUse = false;
      // Hide object when returned to pool
      if ("hidden" in obj) {
        (obj as any).hidden = true;
      }
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    const inUse = this.pool.filter((item) => item.inUse).length;
    return {
      total: this.pool.length,
      inUse,
      available: this.pool.length - inUse,
      maxSize: this.maxSize,
    };
  }

  /**
   * Clear all objects
   */
  clear(): void {
    this.pool.forEach((item) => {
      if ("destroy" in item.obj) {
        (item.obj as any).destroy();
      }
    });
    this.pool = [];
  }
}

/**
 * Entity spawn manager with rate limiting
 */
export class SpawnManager {
  private lastSpawnTimes: Map<string, number> = new Map();
  private spawnCounts: Map<string, number> = new Map();

  constructor(_k: KAPLAYCtx) {
    // KAPLAYCtx stored for future use if needed
  }

  /**
   * Check if entity should spawn based on rate limiting
   */
  shouldSpawn(
    entityType: string,
    minInterval: number,
    maxActive: number = Infinity,
    probability: number = 1.0
  ): boolean {
    const now = Date.now();
    const lastSpawn = this.lastSpawnTimes.get(entityType) || 0;
    const currentCount = this.spawnCounts.get(entityType) || 0;

    // Check interval
    if (now - lastSpawn < minInterval * 1000) {
      return false;
    }

    // Check max active
    if (currentCount >= maxActive) {
      return false;
    }

    // Check probability
    if (Math.random() > probability) {
      return false;
    }

    this.lastSpawnTimes.set(entityType, now);
    this.spawnCounts.set(entityType, currentCount + 1);

    return true;
  }

  /**
   * Notify when entity is destroyed
   */
  onDestroy(entityType: string): void {
    const count = this.spawnCounts.get(entityType) || 0;
    this.spawnCounts.set(entityType, Math.max(0, count - 1));
  }

  /**
   * Get spawn statistics
   */
  getStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    this.spawnCounts.forEach((count, type) => {
      stats[type] = count;
    });
    return stats;
  }

  /**
   * Reset all counters
   */
  reset(): void {
    this.lastSpawnTimes.clear();
    this.spawnCounts.clear();
  }
}

/**
 * Performance monitor
 */
export class PerformanceMonitor {
  private frameTimes: number[] = [];
  private maxSamples: number = 60;
  private lastReportTime: number = 0;
  private reportInterval: number = 5000; // 5 seconds

  recordFrame(deltaTime: number): void {
    this.frameTimes.push(deltaTime);
    if (this.frameTimes.length > this.maxSamples) {
      this.frameTimes.shift();
    }
  }

  getStats() {
    if (this.frameTimes.length === 0) {
      return { fps: 0, avgFrameTime: 0, minFps: 0, maxFps: 0 };
    }

    const avg =
      this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    const min = Math.min(...this.frameTimes);
    const max = Math.max(...this.frameTimes);

    return {
      fps: Math.round(1000 / avg),
      avgFrameTime: Math.round(avg * 10) / 10,
      minFps: Math.round(1000 / max),
      maxFps: Math.round(1000 / min),
    };
  }

  shouldReport(): boolean {
    const now = Date.now();
    if (now - this.lastReportTime > this.reportInterval) {
      this.lastReportTime = now;
      return true;
    }
    return false;
  }
}
