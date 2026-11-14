/**
 * ALL data→sound rules. Spec §9.3–9.4, §9.10
 * This is the single source of truth — no sound logic elsewhere.
 */
import { config } from '../config.js';

// --- Danger Level → tempo BPM ---
export const DANGER_BPM = [60, 72, 88, 104, 120]; // L1–L5

// --- Danger Level → pad chord (intervals above tonic) ---
export const DANGER_CHORDS = [
  [0, 4, 7, 11],  // L1: maj7 (C E G B)
  [0, 2, 4, 7],   // L2: add9 (C D E G)
  [0, 3, 7, 10],  // L3: m7  (C Eb G Bb)
  [0, 5, 7, 8],   // L4: sus4 b6 (C F G Ab)
  [0, 3, 6, 10],  // L5: tritone (C Eb F# Bb)
];

// --- Danger Level → pad cutoff Hz ---
export const DANGER_CUTOFF = [700, 1000, 1400, 1900, 2400];

// --- Danger Level → vibration patterns ---
export const DANGER_VIBRATION = [
  [10], [20], [40], [60, 40, 60], [90, 40, 90, 40, 90],
];

// --- Layer keys and scales ---
export const LAYER_SCALES = {
  temperature: { key: 'C', scale: [0, 2, 4, 7, 9], name: 'C major pentatonic' },
  co2:         { key: 'F', scale: [0, 2, 4, 6, 7, 9, 11], name: 'F lydian' },
  wildfires:   { key: 'A', scale: [0, 3, 5, 7, 10], name: 'A minor pentatonic' },
  storms:      { key: 'D', scale: [0, 2, 3, 5, 7, 9, 10], name: 'D dorian' },
  earthquakes: { key: 'E', scale: [0, 1, 3, 5, 7, 8, 10], name: 'E phrygian' },
  volcanoes:   { key: 'Bb', scale: [0, 2, 3, 5, 7, 8, 10], name: 'Bb minor' },
};

// MIDI note numbers for root keys
const KEY_MIDI = { C: 60, D: 62, E: 64, F: 65, G: 67, A: 69, Bb: 70, B: 71 };

export function scaleNote(layer, degree, octave = 4) {
  const s = LAYER_SCALES[layer] || LAYER_SCALES.temperature;
  const root = KEY_MIDI[s.key] || 60;
  const scale = s.scale;
  degree = Math.max(-6, Math.min(12, degree));
  const len = scale.length;
  const oct = Math.floor(degree / len);
  const idx = ((degree % len) + len) % len;
  return root + scale[idx] + oct * 12 + (octave - 4) * 12;
}

export function midiToFreq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

// --- Danger level calculation per layer ---
export function calcDangerLevel(layer, value) {
  if (value == null) return 1;
  switch (layer) {
    case 'temperature': {
      const v = value;
      if (v < config.tempL1) return 1;
      if (v < config.tempL2) return 2;
      if (v < config.tempL3) return 3;
      if (v < config.tempL4) return 4;
      return 5;
    }
    case 'co2': {
      const v = value;
      if (v < config.co2L1) return 1;
      if (v < config.co2L2) return 2;
      if (v < config.co2L3) return 3;
      if (v < config.co2L4) return 4;
      return 5;
    }
    case 'wildfires': {
      const c = value; // nearby count
      if (c === 0) return 1;
      if (c <= 2) return 2;
      if (c <= 5) return 3;
      if (c <= 10) return 4;
      return 5;
    }
    case 'storms': {
      const kt = value;
      if (kt < 34) return 1;
      if (kt < 64) return 2;
      if (kt < 96) return 3;
      if (kt < 137) return 4;
      return 5;
    }
    case 'earthquakes': {
      const m = value;
      if (m < 5.5) return 1;
      if (m < 6.0) return 2;
      if (m < 6.5) return 3;
      if (m < 7.5) return 4;
      return 5;
    }
    case 'volcanoes': return 3; // base, elevated via config
    default: return 1;
  }
}

// --- Temperature-specific mapping ---
export function tempToMarimbaSettings(anomaly) {
  const steps = Math.round(anomaly * 1.5);
  const baseMidi = scaleNote('temperature', steps, 4);
  const brightness = 800 + (anomaly + 2) * 500;
  const slower = anomaly < 0;
  return { baseMidi, brightness: Math.max(300, Math.min(4000, brightness)), slower };
}

// --- CO2 air mapping ---
export function co2ToAirSettings(ppm) {
  const ratio = Math.max(0, Math.min(1, (ppm - 370) / 55));
  const cutoff = 6000 - ratio * 4800;
  const gainDb = -34 + ratio * 10;
  return { cutoff: Math.max(300, cutoff), gainDb };
}

// --- Storm wind mapping ---
export function windKtToSettings(kt) {
  const gain = -28 + (kt / 140) * 14;
  const panFreq = 0.1 + (kt / 140) * 1.4;
  const baseFreq = 300 + kt * 4;
  return { gain, panFreq, baseFreq: Math.min(baseFreq, 4000) };
}

// --- Wildfire crackle mapping ---
export function fireDensityCrackle(nearbyCount, lat, lon) {
  const seed = Math.round(lat * 10) * 10000 + Math.round(lon * 10);
  const burstPerSec = Math.min(12, nearbyCount * 1.2);
  const gain = -24 + (nearbyCount / 10) * 12;
  return { burstPerSec: Math.max(0, burstPerSec), gain: Math.min(-12, gain), seed };
}

// --- Spatial compass ---
export function spatialPan(lon, centerLon = 0) {
  const diff = ((lon - centerLon + 180) % 360) - 180;
  return Math.max(-1, Math.min(1, diff / 90));
}

export function latPitchShift(lat) {
  return Math.round(lat / 30); // scale steps, north = higher
}

// --- Column height for temperature visualization ---
export function tempColumnHeight(anomaly) {
  if (anomaly < config.tempColumnMinAnomaly) return 0;
  return (anomaly - 0.8) * config.tempColumnScale;
}
