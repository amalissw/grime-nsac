/**
 * Data → Sound mapping rules (SINGLE SOURCE OF TRUTH)
 * This file is also used to generate the "How it sounds" page
 */

export const MAPPING = {
  ocean: {
    role: 'Ocean',
    description: 'Smooth FM pad with low-pass filter. Value controls bass note (tonic/fifth), brightness controls volume, latitude controls filter cutoff.',
    valueToNote: (value01) => value01, // used by instruments
    latToFilter: (lat) => 200 + Math.abs(lat) / 90 * 1200, // 200–1400 Hz
    brightnessToVolume: (b) => -30 + b * 20,
  },

  land: {
    role: 'Land',
    description: 'Plucked synth (marimba-like). Value maps to scale note (2 octaves), brightness controls volume, touch speed controls note density.',
    valueToNoteIndex: (value01) => value01, // 0–1 → scale index
    brightnessToVolume: (b) => -24 + b * 16,
    maxNotesPerSec: 8,
  },

  fire: {
    role: 'Fire / Bright pixels',
    description: 'Noise crackle. Density of bright pixels in 20px radius controls crackle rate.',
    densityToRate: (density) => density * 12, // events per second
    filterFreq: 2000,
  },

  anomaly: {
    role: 'Anomaly (above threshold)',
    description: 'Minor dissonance added quietly above base sound. Tritone played softly when value exceeds theme anomalyThreshold.',
    tritoneSemitones: 6,
    volume: -28,
  },

  coast: {
    role: 'Coastline',
    description: 'Dry short click when crossing land/ocean boundary.',
    duration: 0.025, // 25ms
    frequency: 220,
  },

  beacon: {
    role: 'Guide Beacon',
    description: 'Pure sine bell. Pans left/right by bearing to anomaly, pitch rises when anomaly is north, lowers when south. Pulses faster as you approach.',
    baseFreq: 880,
    panByBearing: true,
    pitchByLat: true,
    minInterval: 0.15,
    maxInterval: 1.0,
  },

  yearTick: {
    role: 'Year tick (Jukebox)',
    description: 'Soft metallic tick on each frame change.',
    frequency: 1200,
    duration: 0.04,
    volume: -38,
  },

  yearMood: {
    role: 'Year mood (Jukebox)',
    description: 'Chord progression shifts with global frame value. Low → I–V calm, high → vi–IV tense with sus2.',
    volume: -26,
    attackTime: 0.8,
  },

  ui: {
    role: 'UI feedback',
    description: 'Very quiet sine blips on button press, so screen reader users know the press was accepted.',
    frequency: 660,
    duration: 0.03,
    volume: -40,
  },
};

export function getMappingTable() {
  return Object.entries(MAPPING).map(([id, m]) => ({
    id,
    role: m.role,
    description: m.description,
  }));
}
