/**
 * Earth Jukebox — Standalone Sound Engine
 * =========================================
 * All sound rules, instrument definitions, and playback functions
 * in one place. Import from here — never duplicate sound logic elsewhere.
 *
 * Architecture (Spec §9):
 *   ① Chord    — danger level → pad harmony + filter cutoff
 *   ② Pulse    — danger level → BPM heartbeat drum
 *   ③ Texture  — layer-specific ambient sound (marimba, air, crackle, wind, thump, hum)
 *   ④ Spatial  — lon → stereo pan, lat → pitch shift
 *
 * Continents page adds:
 *   ⑤ Birds    — FMSynth flock, density driven by birds formula
 *   ⑥ Hum      — CO₂ drone
 */

import * as Tone from 'tone';

// ─────────────────────────────────────────────────────────────────────────────
// § DANGER LEVEL TABLES  (Spec §9.3)
// ─────────────────────────────────────────────────────────────────────────────

/** Beats per minute per danger level L1–L5 */
export const DANGER_BPM = [60, 72, 88, 104, 120];

/** Pad chord semitone intervals above tonic, per danger level */
export const DANGER_CHORDS = [
  [0, 4, 7, 11],  // L1: maj7      — C E G B
  [0, 2, 4, 7],   // L2: add9      — C D E G
  [0, 3, 7, 10],  // L3: m7        — C Eb G Bb
  [0, 5, 7, 8],   // L4: sus4♭6   — C F G Ab
  [0, 3, 6, 10],  // L5: tritone   — C Eb F# Bb
];

/** Pad low-pass cutoff Hz per danger level */
export const DANGER_CUTOFF = [700, 1000, 1400, 1900, 2400];

/** Vibration patterns (ms on/off) per danger level */
export const DANGER_VIBRATION = [
  [10], [20], [40], [60, 40, 60], [90, 40, 90, 40, 90],
];

/** CSS colour for each danger level */
export const DANGER_COLORS = ['#22C55E', '#A3E635', '#FACC15', '#F97316', '#DC2626'];

// ─────────────────────────────────────────────────────────────────────────────
// § LAYER MUSICAL SCALES  (Spec §9.5)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Each layer plays in its own key / scale mode.
 * scale = semitone offsets from root within one octave.
 */
export const LAYER_SCALES = {
  temperature: { key: 'C',  scale: [0, 2, 4, 7, 9],           name: 'C major pentatonic' },
  co2:         { key: 'F',  scale: [0, 2, 4, 6, 7, 9, 11],    name: 'F lydian + drone'   },
  wildfires:   { key: 'A',  scale: [0, 3, 5, 7, 10],          name: 'A minor pentatonic' },
  storms:      { key: 'D',  scale: [0, 2, 3, 5, 7, 9, 10],    name: 'D dorian'           },
  earthquakes: { key: 'E',  scale: [0, 1, 3, 5, 7, 8, 10],    name: 'E phrygian (low)'   },
  volcanoes:   { key: 'Bb', scale: [0, 2, 3, 5, 7, 8, 10],    name: 'Bb minor (low)'     },
};

/** Continents page — each continent's home key (major pentatonic) */
export const CONTINENT_KEYS = {
  africa:       'D',
  asia:         'E',
  europe:       'G',
  northAmerica: 'C',
  southAmerica: 'A',
  oceania:      'F',
};

// ─────────────────────────────────────────────────────────────────────────────
// § MIDI / FREQUENCY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const KEY_MIDI = { C: 60, D: 62, E: 64, F: 65, G: 67, A: 69, Bb: 70, B: 71 };

/** Resolve a scale degree (can be negative) to MIDI note number */
export function scaleNote(layer, degree, octave = 4) {
  const s = LAYER_SCALES[layer] || LAYER_SCALES.temperature;
  const root = KEY_MIDI[s.key] ?? 60;
  const scale = s.scale;
  degree = Math.max(-6, Math.min(12, degree));
  const len = scale.length;
  const oct = Math.floor(degree / len);
  const idx = ((degree % len) + len) % len;
  return root + scale[idx] + oct * 12 + (octave - 4) * 12;
}

export function midiToFreq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

function midiToNote(midi) { return Tone.Frequency(midi, 'midi').toNote(); }

// ─────────────────────────────────────────────────────────────────────────────
// § DANGER LEVEL CALCULATION  (Spec §9.3)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map a raw data value → danger level 1–5.
 * @param {string} layer  - one of the LAYER_SCALES keys
 * @param {number} value  - raw measurement value
 * @returns {number} 1–5
 */
export function calcDangerLevel(layer, value) {
  if (value == null) return 1;
  switch (layer) {
    case 'temperature': {
      if (value < 0.5)  return 1;
      if (value < 1.0)  return 2;
      if (value < 1.5)  return 3;
      if (value < 2.5)  return 4;
      return 5;
    }
    case 'co2': {
      if (value < 380)  return 1;
      if (value < 395)  return 2;
      if (value < 410)  return 3;
      if (value < 420)  return 4;
      return 5;
    }
    case 'wildfires': {
      const c = value;
      if (c === 0)      return 1;
      if (c <= 2)       return 2;
      if (c <= 5)       return 3;
      if (c <= 10)      return 4;
      return 5;
    }
    case 'storms': {
      // Wind speed knots (Beaufort → Saffir-Simpson)
      if (value < 34)   return 1;
      if (value < 64)   return 2;
      if (value < 96)   return 3;
      if (value < 137)  return 4;
      return 5;
    }
    case 'earthquakes': {
      if (value < 5.5)  return 1;
      if (value < 6.0)  return 2;
      if (value < 6.5)  return 3;
      if (value < 7.5)  return 4;
      return 5;
    }
    case 'volcanoes':
      return 3; // baseline — elevated by nearby event count
    default:
      return 1;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § LAYER-SPECIFIC MAPPING FUNCTIONS  (Spec §9.3-9.10)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Temperature → marimba note + brightness.
 * baseNote = C4 + round(anomaly × 1.5) scale steps.
 * brightness = 800 + (anomaly + 2) × 500 Hz.
 */
export function tempToMarimbaSettings(anomaly) {
  const steps = Math.round(anomaly * 1.5);
  const baseMidi = scaleNote('temperature', steps, 4);
  const brightness = Math.max(300, Math.min(4000, 800 + (anomaly + 2) * 500));
  return { baseMidi, brightness, note: midiToNote(baseMidi) };
}

/**
 * CO₂ ppm → air filter cutoff + gain.
 * cutoff = 6000 − ((ppm−370)/55) × 4800  Hz (clamp 300–6000)
 * gain   = −34   + ((ppm−370)/55) × 10   dB
 */
export function co2ToAirSettings(ppm) {
  const ratio = Math.max(0, Math.min(1, (ppm - 370) / 55));
  const cutoff = Math.max(300, 6000 - ratio * 4800);
  const gainDb = -34 + ratio * 10;
  return { cutoff, gainDb, ratio };
}

/**
 * Storm wind speed knots → wind synth settings.
 * gain     = −28 + (kt/140) × 14  dB
 * panFreq  = 0.1 + (kt/140) × 1.4 Hz
 * baseFreq = 300 + kt × 4         Hz (clamped to 4000)
 */
export function windKtToSettings(kt) {
  const gain    = Math.min(-6, -28 + (kt / 140) * 14);
  const panFreq = 0.1 + (kt / 140) * 1.4;
  const baseFreq = Math.min(4000, 300 + kt * 4);
  return { gain, panFreq, baseFreq };
}

/**
 * Wildfire nearby count + position → crackle settings.
 * burstPerSec = min(12, count × 1.2)
 * gain = −24 + (count/10) × 12 dB
 */
export function fireDensityCrackle(nearbyCount, lat, lon) {
  const burstPerSec = Math.max(0, Math.min(12, nearbyCount * 1.2));
  const gain = Math.max(-36, Math.min(-12, -24 + (nearbyCount / 10) * 12));
  const seed = Math.round(lat * 10) * 10000 + Math.round(lon * 10);
  return { burstPerSec, gain, seed };
}

/**
 * Column height for temperature visualization on the globe.
 * height = max(0, (anomaly − 0.8) × 0.028)
 */
export function tempColumnHeight(anomaly) {
  if (anomaly < 1.0) return 0;
  return Math.max(0, (anomaly - 0.8) * 0.028);
}

// ─────────────────────────────────────────────────────────────────────────────
// § SPATIAL COMPASS  (Spec §9.10)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Longitude → stereo pan −1 (west) … +1 (east).
 * Center around globe's current lon; wrap to −180..180.
 */
export function spatialPan(lon, centerLon = 0) {
  const diff = ((lon - centerLon + 180) % 360) - 180;
  return Math.max(-1, Math.min(1, diff / 90));
}

/**
 * Latitude → pitch shift in scale steps.
 * North = higher pitch (positive), south = lower.
 */
export function latPitchShift(lat) {
  return Math.round(lat / 30);
}

// ─────────────────────────────────────────────────────────────────────────────
// § CONTINENTS — BIRDS FORMULA  (Spec §8.2)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Number of birds in the chorus.
 * b = clamp(round(8 − 2.2×max(0,a) − 3×(c−370)/55), 1, 8)
 * @param {number} a  temperature anomaly °C
 * @param {number} c  CO₂ ppm
 * @returns {number} 1–8
 */
export function birdsCount(a, c) {
  const raw = 8 - 2.2 * Math.max(0, a) - 3 * (c - 370) / 55;
  return Math.max(1, Math.min(8, Math.round(raw)));
}

/**
 * Birds melody: upward glide from base note, +12 semitones in 60ms.
 * Uses continent's key as root (major pentatonic).
 */
export function birdNoteForContinent(continent, degree) {
  const key = CONTINENT_KEYS[continent] || 'C';
  const scale = [0, 2, 4, 7, 9]; // major pentatonic
  const root = (KEY_MIDI[key] ?? 60) + 12; // octave 5
  degree = ((degree % 5) + 5) % 5;
  return root + scale[degree];
}

// ─────────────────────────────────────────────────────────────────────────────
// § MASTER CHAIN BUILDER  (Spec §9.1)
// ─────────────────────────────────────────────────────────────────────────────

let _master = null;
let _reverb = null;
let _duckGain = null;

/** Build or return the master signal chain. Call once at boot. */
export function buildMasterChain() {
  if (_master) return { master: _master, reverb: _reverb, duckGain: _duckGain };

  // Shared reverb (connected before master)
  _reverb = new Tone.Reverb({ decay: 3.5, wet: 0.18 });
  _reverb.generate();

  // Duck gain for voice-over ducking
  _duckGain = new Tone.Volume(0);
  _duckGain.connect(Tone.getDestination());

  // Compressor → Limiter → Volume → destination
  const comp  = new Tone.Compressor(-24, 3);
  const limit = new Tone.Limiter(-1);
  const vol   = new Tone.Volume(-12);

  comp.connect(limit);
  limit.connect(vol);
  vol.connect(_duckGain);

  _reverb.connect(comp);
  _master = comp;

  return { master: _master, reverb: _reverb, duckGain: _duckGain };
}

export function getMasterChain() { return _master; }
export function getReverb()      { return _reverb; }

/** Duck music volume by dB for TTS playback */
export function duckMusic(duckDb = -14, attackMs = 150) {
  if (!_duckGain) return;
  _duckGain.volume.rampTo(duckDb, attackMs / 1000);
}

/** Restore music volume after TTS */
export function unduckMusic(releaseMs = 400) {
  if (!_duckGain) return;
  _duckGain.volume.rampTo(0, releaseMs / 1000);
}

// ─────────────────────────────────────────────────────────────────────────────
// § INSTRUMENT FACTORY  (Spec §9.2)
// ─────────────────────────────────────────────────────────────────────────────

let _inst = null;

/**
 * Create all synthesized instruments and wire to master chain.
 * Returns the instrument object — call getInstruments() after.
 */
export function buildInstruments() {
  if (_inst) return _inst;
  const { master, reverb } = buildMasterChain();

  // ── pad — danger level chord ────────────────────────────────────────────────
  const pad = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 1.5,
    modulationIndex: 2,
    envelope: { attack: 1.2, release: 3 },
  });
  const padFilter = new Tone.Filter(700, 'lowpass');
  pad.connect(padFilter);
  padFilter.connect(reverb);
  pad.volume.value = -24;

  // ── pulse — BPM heartbeat drum ──────────────────────────────────────────────
  const pulse = new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 2, envelope: { decay: 0.25 } });
  pulse.connect(master);
  pulse.volume.value = -16;

  // ── marimba — temperature melody ───────────────────────────────────────────
  const marimba = new Tone.PluckSynth({ attackNoise: 1.5, dampening: 4000, resonance: 0.95 });
  marimba.connect(reverb);
  marimba.volume.value = -18;

  // ── crackle — wildfire texture ──────────────────────────────────────────────
  const crackleFilter = new Tone.Filter({ frequency: 2500, type: 'bandpass', Q: 1.2 });
  crackleFilter.connect(master);
  const crackle = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.03, sustain: 0 },
  });
  crackle.connect(crackleFilter);
  crackle.volume.value = -24;

  // ── wind — storm texture ────────────────────────────────────────────────────
  const windPanner = new Tone.AutoPanner({ frequency: 0.3, depth: 1 }).start();
  windPanner.connect(reverb);
  const windFilter = new Tone.AutoFilter({ frequency: 0.2, baseFrequency: 400, octaves: 2.5 }).start();
  windFilter.connect(windPanner);
  const wind = new Tone.Noise('pink');
  wind.connect(windFilter);
  wind.volume.value = -28;

  // ── thump — earthquake impulse ──────────────────────────────────────────────
  const thump = new Tone.MembraneSynth({ pitchDecay: 0.1, octaves: 6, envelope: { decay: 0.8 } });
  thump.connect(reverb);
  thump.volume.value = -18;

  // ── rumble — earthquake/volcano sustain ────────────────────────────────────
  const rumbleEnv = new Tone.AmplitudeEnvelope({ attack: 0.3, decay: 3, sustain: 0, release: 1 });
  rumbleEnv.connect(master);
  const rumbleFilter = new Tone.Filter(200, 'lowpass');
  rumbleFilter.connect(rumbleEnv);
  const rumble = new Tone.Noise('brown');
  rumble.connect(rumbleFilter);
  rumble.start();
  rumble.volume.value = -20;

  // ── air — CO₂ "thick air" ──────────────────────────────────────────────────
  const airFilter = new Tone.Filter(6000, 'lowpass');
  airFilter.connect(master);
  const air = new Tone.Noise('pink');
  air.connect(airFilter);
  air.volume.value = -30;
  air.start();

  // ── birds — continents page flock (FMSynth + upward glide) ─────────────────
  const birds = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 3.01,
    modulationIndex: 10,
    envelope: { attack: 0.005, decay: 0.08, sustain: 0 },
  });
  birds.connect(reverb);
  birds.volume.value = -14;

  // ── hum — continents CO₂ drone (osc + noise → low-pass) ───────────────────
  const humFilter = new Tone.Filter(300, 'lowpass');
  humFilter.connect(master);
  const humOsc = new Tone.Oscillator(55, 'sine');
  humOsc.connect(humFilter);
  const humNoise = new Tone.Noise('pink');
  humNoise.connect(humFilter);
  humOsc.start();
  humNoise.start();
  const humVol = new Tone.Volume(-40);
  humVol.connect(master);

  // ── welcome chord ───────────────────────────────────────────────────────────
  const welcome = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.1, decay: 0.5, sustain: 0.4, release: 1.5 },
  });
  welcome.connect(reverb);
  welcome.volume.value = -20;

  // ── earcon blip ─────────────────────────────────────────────────────────────
  const earcon = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 },
  });
  earcon.connect(master);
  earcon.volume.value = -32;

  _inst = {
    pad, padFilter,
    pulse,
    marimba,
    crackle, crackleFilter,
    wind, windFilter, windPanner,
    thump,
    rumble, rumbleFilter, rumbleEnv,
    air, airFilter,
    birds,
    hum: humVol, humOsc, humNoise, humFilter,
    welcome,
    earcon,
    _pulseLoop: null,
  };
  return _inst;
}

export function getInstruments() { return _inst; }

// ─────────────────────────────────────────────────────────────────────────────
// § PLAYBACK FUNCTIONS  (Spec §9.3-9.10)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Play all 4 sound parts for a data point.
 * @param {{value, level, layer, place, nearby}} pt  — from getPointData()
 * @param {number} lat
 * @param {number} lon
 * @param {string} layer
 */
export function playPoint(pt, lat, lon, layer) {
  const inst = _inst; if (!inst) return;

  const level = pt.level ?? 1;
  const pan   = spatialPan(lon);

  // ① Set global transport BPM
  Tone.getTransport().bpm.value = DANGER_BPM[level - 1] ?? 72;

  // ② Chord
  playChord(level, layer);

  // ③ Pulse
  startPulse(level);

  // ④ Texture
  playTexture(pt, lat, lon, layer);

  // ⑤ Spatial pan + pitch
  applyPanAndPitch(pan, lat);
}

/**
 * Trigger the pad chord for a danger level.
 * @param {number} level  1–5
 * @param {string} layer  determines root key
 */
export function playChord(level, layer = 'temperature') {
  const inst = _inst; if (!inst?.pad) return;
  try {
    const chord    = DANGER_CHORDS[level - 1] ?? [0, 4, 7];
    const scale    = LAYER_SCALES[layer] ?? LAYER_SCALES.temperature;
    const rootMidi = (KEY_MIDI[scale.key] ?? 60) + 48; // octave 4
    const notes    = chord.map(i => midiToNote(rootMidi + i));

    inst.pad.releaseAll();
    inst.pad.triggerAttack(notes, Tone.now());

    const cutoff = DANGER_CUTOFF[level - 1] ?? 1000;
    if (inst.padFilter) inst.padFilter.frequency.rampTo(cutoff, 0.3);
  } catch {}
}

/**
 * Start or restart the pulse (kick drum) loop.
 * @param {number} level  1–5 (determines BPM)
 */
export function startPulse(level) {
  const inst = _inst; if (!inst?.pulse) return;
  if (inst._pulseLoop) { try { inst._pulseLoop.dispose(); } catch {} }

  const bpm = DANGER_BPM[level - 1] ?? 72;
  const intervalMs = Math.round(60000 / bpm);

  try {
    inst._pulseLoop = new Tone.Loop(time => {
      inst.pulse.triggerAttackRelease('C1', '8n', time);
    }, `${intervalMs}i`).start(0);
    Tone.getTransport().start();
  } catch {}
}

/** Stop the pulse loop and silence the pad */
export function stopPulse() {
  const inst = _inst; if (!inst) return;
  try {
    if (inst._pulseLoop) { inst._pulseLoop.dispose(); inst._pulseLoop = null; }
    inst.pad?.releaseAll();
    Tone.getTransport().stop();
  } catch {}
}

/**
 * Play the layer-specific texture sound (③ in the 4-part engine).
 * @param {object} pt    — point data {value, level, layer}
 * @param {number} lat
 * @param {number} lon
 * @param {string} layer
 */
export function playTexture(pt, lat, lon, layer) {
  const inst = _inst; if (!inst) return;
  const { value } = pt;

  try {
    switch (layer) {
      case 'temperature': {
        const s = tempToMarimbaSettings(value ?? 0);
        inst.marimba?.triggerAttackRelease(s.note, '4n');
        break;
      }
      case 'co2': {
        const s = co2ToAirSettings(value ?? 400);
        inst.airFilter?.frequency.rampTo(s.cutoff, 0.5);
        // Adjust gain (airFilter is downstream of air noise)
        break;
      }
      case 'wildfires': {
        const s = fireDensityCrackle(value ?? 0, lat, lon);
        if (s.burstPerSec > 0) {
          inst.crackle?.volume.rampTo(s.gain, 0.3);
          // Trigger bursts
          for (let i = 0; i < Math.min(5, Math.round(s.burstPerSec * 0.5)); i++) {
            setTimeout(() => { try { inst.crackle?.triggerAttackRelease('16n'); } catch {} }, i * 120);
          }
        }
        break;
      }
      case 'storms': {
        const s = windKtToSettings(value ?? 0);
        inst.wind?.volume.rampTo(s.gain, 0.5);
        if (inst.windFilter) inst.windFilter.baseFrequency = s.baseFreq;
        if (inst.windPanner) inst.windPanner.frequency.value = s.panFreq;
        break;
      }
      case 'earthquakes': {
        if (value && value >= 5.5) {
          const freq = Tone.Frequency(Math.max(30, 80 - value * 5), 'hz').toNote();
          inst.thump?.triggerAttackRelease(freq, '2n');
        }
        if (pt.level >= 4) {
          inst.rumbleEnv?.triggerAttack(Tone.now());
          setTimeout(() => { try { inst.rumbleEnv?.triggerRelease(); } catch {} }, 2500);
        }
        break;
      }
      case 'volcanoes': {
        const vol = pt.level >= 3 ? -20 : -40;
        if (inst.humOsc) inst.humFilter?.frequency.rampTo(300, 0.5);
        if (inst.hum) inst.hum.volume.rampTo(vol, 0.5);
        break;
      }
    }
  } catch (e) {
    console.warn('[se] texture error', e);
  }
}

/**
 * Apply stereo pan from longitude and pitch detune from latitude.
 * @param {number} pan   −1..+1 from spatialPan()
 * @param {number} lat   −90..90
 */
export function applyPanAndPitch(pan, lat) {
  const inst = _inst; if (!inst) return;
  // Detune marimba by latitude (north = higher)
  const detuneCents = latPitchShift(lat) * 100;
  try { inst.marimba?.set?.({ detune: detuneCents }); } catch {}
  // Pan applied to master chain via panner — wired in engine.js
}

// ─────────────────────────────────────────────────────────────────────────────
// § CONTINENTS PAGE  (Spec §8)
// ─────────────────────────────────────────────────────────────────────────────

let _birdsLoop = null;
let _birdDegree = 0;

/**
 * Play the continent bird chorus for one year step.
 * @param {string} continent
 * @param {number} anomaly   temperature anomaly °C
 * @param {number} ppm       CO₂ ppm
 */
export function playBirdChorus(continent, anomaly, ppm) {
  const inst = _inst; if (!inst?.birds) return;
  const count = birdsCount(anomaly, ppm);

  try {
    for (let i = 0; i < count; i++) {
      const delay = i * 80;
      const midi  = birdNoteForContinent(continent, _birdDegree + i);
      const note  = midiToNote(midi);
      const noteHigh = midiToNote(midi + 12);

      setTimeout(() => {
        try {
          inst.birds.triggerAttackRelease(note, '32n', Tone.now());
          // Upward glide simulation: re-trigger at +12 after 60ms
          setTimeout(() => {
            try { inst.birds.triggerAttackRelease(noteHigh, '64n', Tone.now()); } catch {}
          }, 60);
        } catch {}
      }, delay);
    }
    _birdDegree = (_birdDegree + 1) % 5;
  } catch {}
}

/**
 * Update the CO₂ hum drone for the continents page.
 * @param {number} ppm
 */
export function updateHum(ppm) {
  const inst = _inst; if (!inst?.hum) return;
  const { ratio } = co2ToAirSettings(ppm);
  const vol = -40 + ratio * 20;
  try { inst.hum.volume.rampTo(vol, 1.0); } catch {}
}

/** Stop all continents sounds */
export function stopContinents() {
  if (_birdsLoop) { try { _birdsLoop.stop(); _birdsLoop.dispose(); } catch {} _birdsLoop = null; }
  const inst = _inst; if (!inst) return;
  try { inst.hum?.volume.rampTo(-40, 0.5); } catch {}
  stopPulse();
}

// ─────────────────────────────────────────────────────────────────────────────
// § EARCONS  (Spec §9.9)
// ─────────────────────────────────────────────────────────────────────────────

let _earconBusy = false;

/**
 * Play a short earcon sound for UI feedback.
 * @param {'select'|'layerChange'|'yearTick'|'micStart'|'micStop'|'error'|'pageChange'|'thinking'} type
 */
export function playEarcon(type) {
  const inst = _inst; if (!inst?.earcon || _earconBusy) return;
  _earconBusy = true;
  const now = Tone.now();

  try {
    switch (type) {
      case 'select':
        inst.earcon.triggerAttackRelease('E6', '32n', now); break;
      case 'layerChange':
        inst.earcon.triggerAttackRelease('C5', '16n', now);
        inst.earcon.triggerAttackRelease('E5', '16n', now + 0.12); break;
      case 'yearTick':
        inst.earcon.triggerAttackRelease('C6', '64n', now); break;
      case 'micStart':
        inst.earcon.triggerAttackRelease('C5', '16n', now);
        inst.earcon.triggerAttackRelease('E5', '16n', now + 0.1); break;
      case 'micStop':
        inst.earcon.triggerAttackRelease('E5', '16n', now);
        inst.earcon.triggerAttackRelease('C5', '16n', now + 0.1); break;
      case 'error':
        inst.earcon.triggerAttackRelease('C3', '8n', now);
        inst.earcon.triggerAttackRelease('C3', '8n', now + 0.15); break;
      case 'pageChange':
        inst.earcon.triggerAttackRelease('G5', '16n', now); break;
      case 'thinking':
        inst.earcon.triggerAttackRelease('A4', '64n', now); break;
    }
  } catch {}

  setTimeout(() => { _earconBusy = false; }, 300);
}

/** Play the welcome chord shown on start */
export function playWelcomeChord() {
  const inst = _inst; if (!inst?.welcome) return;
  try {
    const now = Tone.now();
    inst.welcome.triggerAttackRelease(['C3', 'E3', 'G3', 'B3'], 2, now);
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// § AUDIO CONTEXT UNLOCK  (Spec §17 Stage 1)
// ─────────────────────────────────────────────────────────────────────────────

let _unlocked = false;

/**
 * Must be called in a user-gesture handler (button click).
 * Resumes the AudioContext if suspended.
 */
export async function unlockAudio() {
  if (_unlocked) return;
  try {
    await Tone.start();
    if (Tone.getContext().state !== 'running') {
      await Tone.getContext().resume();
    }
    _unlocked = true;
  } catch (e) {
    console.warn('[se] unlock error', e);
  }
}

export function isAudioUnlocked() { return _unlocked; }
