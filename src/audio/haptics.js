/**
 * Haptic feedback + sound cues fallback
 * Single haptic(eventName) function with priority queue
 */
import {
  playCoast, playAnomaly, playEdgeBump, playYearTick, playFanfare,
} from './instruments.js';

const VIBRATION_SUPPORTED = 'vibrate' in navigator;
let vibrationEnabled = true;
let intensityMultiplier = 1.0;

// Priority (higher = wins): beaconFound > anomaly > coast > edge > yearTick > beaconNear > landTexture
const PRIORITY = { beaconFound: 7, anomaly: 6, coast: 5, edge: 4, yearTick: 3, beaconNear: 2, landTexture: 1 };

let currentPriority = 0;
let lastVibTime = 0;

const PATTERNS = {
  start:        [30],
  coast:        [40],
  landTexture:  [8],
  anomaly:      [80, 40, 80],
  beaconNear:   [15],
  beaconFound:  [60, 30, 60, 30, 120],
  yearTick:     [20],
  edge:         [100],
  uiConfirm:    [10],
};

const SOUND_FALLBACKS = {
  anomaly:     () => playAnomaly(220),
  coast:       () => {}, // coast sound always plays
  edge:        () => playEdgeBump(),
  yearTick:    () => playYearTick(),
  beaconFound: () => playFanfare(),
};

export function haptic(eventName) {
  const priority = PRIORITY[eventName] || 0;
  const pattern = PATTERNS[eventName];
  if (!pattern) return;

  const mult = intensityMultiplier;
  const scaledPattern = pattern.map((v, i) => i % 2 === 0 ? Math.round(v * mult) : v);
  const totalDur = scaledPattern.reduce((a, b) => a + b, 0);
  const now = Date.now();

  if (now - lastVibTime < totalDur) return; // Don't interrupt same/higher

  if (priority >= currentPriority) {
    if (VIBRATION_SUPPORTED && vibrationEnabled) {
      navigator.vibrate(scaledPattern);
    } else {
      const fallback = SOUND_FALLBACKS[eventName];
      if (fallback) fallback();
    }

    currentPriority = priority;
    lastVibTime = now;
    setTimeout(() => {
      if (currentPriority === priority) currentPriority = 0;
    }, totalDur + 50);
  }
}

export function setVibrationEnabled(on) { vibrationEnabled = on; }
export function setVibrationIntensity(mult) { intensityMultiplier = mult; }
export function isVibrationSupported() { return VIBRATION_SUPPORTED; }

export function testVibration() {
  if (VIBRATION_SUPPORTED) {
    navigator.vibrate([100, 50, 100]);
    return true;
  }
  return false;
}
