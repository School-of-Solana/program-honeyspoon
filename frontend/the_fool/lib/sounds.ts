/**
 * Sound Manager - Using Howler.js
 *
 * Simplified audio playback system with preloading and volume control
 */

import { Howl, Howler } from "howler";

// Sound configuration
const SOUNDS = {
  COIN: { src: "/sounds/coin.wav", volume: 0.6 },
  EXPLOSION: { src: "/sounds/explosion.wav", volume: 0.5 },
  BUBBLES: { src: "/sounds/bubbles.wav", volume: 0.4 },
  SURFACE: { src: "/sounds/surface.wav", volume: 0.5 },
  DIVE: { src: "/sounds/dive.wav", volume: 0.5 },
  WATER_LOOP: { src: "/sounds/water-loop.wav", volume: 0.15 },
  BEACH_WAVES: { src: "/sounds/beach-waves.ogg", volume: 0.12 },
  BUTTON_CLICK: { src: "/sounds/button-click.wav", volume: 0.3 },
} as const;

export type SoundType = keyof typeof SOUNDS;

// Sound instances cache
const soundInstances = new Map<SoundType, Howl>();

// Initialize sounds
function initSound(type: SoundType): Howl {
  if (soundInstances.has(type)) {
    return soundInstances.get(type)!;
  }

  const config = SOUNDS[type];
  const howl = new Howl({
    src: [config.src],
    volume: config.volume,
    preload: true,
  });

  soundInstances.set(type, howl);
  return howl;
}

// Preload all sounds
export function preloadSounds(): void {
  if (typeof window === "undefined") return;

  Object.keys(SOUNDS).forEach((key) => {
    initSound(key as SoundType);
  });
}

// Play a sound
export function playSound(
  type: SoundType,
  options?: { loop?: boolean; volume?: number }
): number | undefined {
  if (typeof window === "undefined") return;

  const sound = initSound(type);

  if (options?.loop !== undefined) {
    sound.loop(options.loop);
  }

  if (options?.volume !== undefined) {
    sound.volume(options.volume);
  }

  return sound.play();
}

// Stop a specific sound
export function stopSound(type: SoundType): void {
  const sound = soundInstances.get(type);
  if (sound) {
    sound.stop();
  }
}

// Stop all sounds
export function stopAllSounds(): void {
  soundInstances.forEach((sound) => sound.stop());
}

// Global volume control
export function setMasterVolume(volume: number): void {
  Howler.volume(Math.max(0, Math.min(1, volume)));
}

// Mute/unmute
export function mute(): void {
  Howler.mute(true);
}

export function unmute(): void {
  Howler.mute(false);
}

let _isMuted = false;

export function toggleMute(): void {
  _isMuted = !_isMuted;
  Howler.mute(_isMuted);
}

export function isMuted(): boolean {
  return _isMuted;
}

// Legacy compatibility - export old interface
export function getSoundManager() {
  return {
    play: playSound,
    stop: stopSound,
    stopAll: stopAllSounds,
    setMasterVolume,
    mute,
    unmute,
    toggleMute,
    isMuted,
  };
}
