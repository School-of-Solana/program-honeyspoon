/**
 * Sound Manager - Centralized audio playback system
 * 
 * Handles loading, caching, and playing game sounds
 * with volume control and muting support
 */

// Sound file paths (relative to /public)
const SOUND_PATHS = {
  COIN: '/sounds/coin.wav',
  EXPLOSION: '/sounds/explosion.wav',
  BUBBLES: '/sounds/bubbles.wav',
  WATER_LOOP: '/sounds/water-loop.wav',
  BEACH_WAVES: '/sounds/beach-waves.ogg',
} as const;

// Sound type
export type SoundType = keyof typeof SOUND_PATHS;

// Volume settings (0.0 to 1.0)
const DEFAULT_VOLUMES = {
  COIN: 0.5,
  EXPLOSION: 0.4,
  BUBBLES: 0.3,
  WATER_LOOP: 0.2,
  BEACH_WAVES: 0.15,
} as const;

class SoundManager {
  private sounds: Map<SoundType, HTMLAudioElement> = new Map();
  private muted: boolean = false;
  private masterVolume: number = 1.0;
  
  constructor() {
    // Preload sounds
    this.preloadAll();
  }

  /**
   * Preload all sound files
   */
  private preloadAll(): void {
    Object.entries(SOUND_PATHS).forEach(([key, path]) => {
      try {
        const audio = new Audio(path);
        audio.preload = 'auto';
        audio.volume = DEFAULT_VOLUMES[key as SoundType] * this.masterVolume;
        this.sounds.set(key as SoundType, audio);
      } catch (error) {
        console.warn(`[SOUND] Failed to preload ${key}:`, error);
      }
    });
  }

  /**
   * Play a sound effect
   */
  play(soundType: SoundType, options?: { loop?: boolean; volume?: number }): void {
    if (this.muted) return;

    const sound = this.sounds.get(soundType);
    if (!sound) {
      console.warn(`[SOUND] Sound not found: ${soundType}`);
      return;
    }

    try {
      // Clone for overlapping sounds (multiple plays)
      const playSound = sound.cloneNode() as HTMLAudioElement;
      
      // Apply options
      playSound.loop = options?.loop ?? false;
      playSound.volume = (options?.volume ?? DEFAULT_VOLUMES[soundType]) * this.masterVolume;

      // Play
      const playPromise = playSound.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log(`[SOUND] Playing: ${soundType}`);
          })
          .catch(error => {
            console.warn(`[SOUND] Playback error for ${soundType}:`, error);
          });
      }

      // Auto-cleanup for non-looping sounds
      if (!playSound.loop) {
        playSound.addEventListener('ended', () => {
          playSound.remove();
        });
      }
    } catch (error) {
      console.error(`[SOUND] Error playing ${soundType}:`, error);
    }
  }

  /**
   * Stop a specific sound
   */
  stop(soundType: SoundType): void {
    const sound = this.sounds.get(soundType);
    if (sound) {
      sound.pause();
      sound.currentTime = 0;
    }
  }

  /**
   * Stop all sounds
   */
  stopAll(): void {
    this.sounds.forEach(sound => {
      sound.pause();
      sound.currentTime = 0;
    });
  }

  /**
   * Set master volume (0.0 to 1.0)
   */
  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.sounds.forEach((sound, key) => {
      sound.volume = DEFAULT_VOLUMES[key] * this.masterVolume;
    });
  }

  /**
   * Mute all sounds
   */
  mute(): void {
    this.muted = true;
    this.stopAll();
  }

  /**
   * Unmute all sounds
   */
  unmute(): void {
    this.muted = false;
  }

  /**
   * Toggle mute
   */
  toggleMute(): void {
    this.muted = !this.muted;
    if (this.muted) {
      this.stopAll();
    }
  }

  /**
   * Check if muted
   */
  isMuted(): boolean {
    return this.muted;
  }
}

// Singleton instance
let soundManagerInstance: SoundManager | null = null;

/**
 * Get the sound manager instance (singleton)
 */
export function getSoundManager(): SoundManager {
  if (typeof window === 'undefined') {
    // Server-side: return mock
    return {
      play: () => {},
      stop: () => {},
      stopAll: () => {},
      setMasterVolume: () => {},
      mute: () => {},
      unmute: () => {},
      toggleMute: () => {},
      isMuted: () => false,
    } as unknown as SoundManager;
  }

  if (!soundManagerInstance) {
    soundManagerInstance = new SoundManager();
  }

  return soundManagerInstance;
}

/**
 * Convenience function to play a sound
 */
export function playSound(soundType: SoundType, options?: { loop?: boolean; volume?: number }): void {
  getSoundManager().play(soundType, options);
}

/**
 * Convenience function to stop a sound
 */
export function stopSound(soundType: SoundType): void {
  getSoundManager().stop(soundType);
}
