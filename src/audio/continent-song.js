/**
 * Stage 8: Continent song generator.
 * Each continent → unique key/scale/tempo → 16-step algorithmic melody.
 * Danger level and year bend the harmony toward tension or resolution.
 */
import * as Tone from 'tone';
import { getInstruments } from './instruments.js';
import { getMasterChain, getReverb } from './engine.js';
import { buildScale, midiToNote } from './scales.js';

// ── Musical profiles ─────────────────────────────────────────────────────────
const PROFILES = {
  africa:       { key: 'D',  scale: 'dorian',          bpm: 95,  baseOctave: 3, label: 'D Dorian' },
  asia:         { key: 'C',  scale: 'majorPentatonic',  bpm: 80,  baseOctave: 3, label: 'C Major Pentatonic' },
  europe:       { key: 'F',  scale: 'major',            bpm: 72,  baseOctave: 3, label: 'F Major' },
  northAmerica: { key: 'G',  scale: 'majorPentatonic',  bpm: 90,  baseOctave: 3, label: 'G Major Pentatonic' },
  southAmerica: { key: 'E',  scale: 'minorPentatonic',  bpm: 110, baseOctave: 3, label: 'E Minor Pentatonic' },
  oceania:      { key: 'A',  scale: 'majorPentatonic',  bpm: 68,  baseOctave: 3, label: 'A Major Pentatonic' },
};

// Danger chords (intervals above root) — same as listen.js for consistency
const DANGER_CHORDS = [
  [0, 4, 7, 11],
  [0, 2, 4, 7],
  [0, 3, 7, 10],
  [0, 5, 7, 8],
  [0, 3, 6, 10],
];

// ── State ────────────────────────────────────────────────────────────────────
let _seq  = null;
let _loop = null;
let _padChord = null;
let _playing = false;

// ── Melody generation ─────────────────────────────────────────────────────────
function seeded(x) {
  let s = (x | 0) >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; };
}

function genMelody(continent, year, dangerLevel) {
  const profile = PROFILES[continent] || PROFILES.africa;
  const scale   = buildScale(profile.key, profile.scale, 2, profile.baseOctave);
  const rng     = seeded((year * 7919) ^ (continent.length * 31337) ^ (dangerLevel * 997));

  const steps = 16;
  const notes = [];
  const rests = [];

  for (let i = 0; i < steps; i++) {
    const r = rng();
    // Higher danger = more rests, more leaps
    const isRest = dangerLevel >= 4 ? r < 0.25 : dangerLevel >= 3 ? r < 0.12 : r < 0.06;
    rests.push(isRest);

    if (isRest) { notes.push(null); continue; }

    // Pattern: danger 1-2 = smooth ascending, 3-4 = jumpy, 5 = dissonant
    let degree;
    if (dangerLevel <= 2) {
      // Smooth ascending pattern with small variation
      degree = Math.floor(i * scale.length / steps) + Math.floor(rng() * 2);
    } else if (dangerLevel === 3) {
      // Add sixths and skips
      degree = Math.floor(rng() * (scale.length - 1));
    } else {
      // Large leaps into upper octave
      degree = Math.floor(rng() * scale.length * 1.3);
    }
    degree = Math.max(0, Math.min(scale.length - 1, degree));
    notes.push(scale[degree]);
  }

  return notes;
}

// ── Public API ────────────────────────────────────────────────────────────────
export function playContinentSong(continent, year, dangerLevel, { onStep, onStop } = {}) {
  stopContinentSong();

  const profile = PROFILES[continent] || PROFILES.africa;
  const inst = getInstruments();
  if (!inst) return;

  const notes = genMelody(continent, year, dangerLevel);
  const transport = Tone.getTransport();
  transport.bpm.value = profile.bpm;

  // Pad chord (long sustained)
  const scale = buildScale(profile.key, profile.scale, 2, profile.baseOctave);
  const chordIntervals = DANGER_CHORDS[Math.min(4, dangerLevel - 1)];
  const keyMidi = keyToMidi(profile.key) + 48; // octave 4

  try {
    if (inst.pad) {
      inst.pad.releaseAll();
      _padChord = chordIntervals.map(i => Tone.Frequency(keyMidi + i, 'midi').toNote());
      inst.pad.triggerAttack(_padChord, Tone.now() + 0.1);
    }
  } catch {}

  // Melodic sequence
  let step = 0;
  _seq = new Tone.Sequence((time, note) => {
    step = (step + 1) % notes.length;
    if (onStep) onStep(step, note);

    if (!note) return;
    try {
      if (inst.marimba) inst.marimba.triggerAttackRelease(note, '8n', time);
      if (inst.birds && step % 4 === 0) inst.birds.triggerAttackRelease(note, '32n', time + 0.01);
    } catch {}
  }, notes, '8n');

  // Pulse at danger tempo
  _loop = new Tone.Loop(time => {
    if (inst.pulse) {
      try { inst.pulse.triggerAttackRelease('C1', '16n', time); } catch {}
    }
  }, dangerLevel >= 4 ? '8n' : '4n');

  _seq.start(0);
  _loop.start(0);
  transport.start();
  _playing = true;

  return {
    continent, year, dangerLevel,
    key: profile.key,
    scaleName: profile.label,
    bpm: profile.bpm,
  };
}

export function stopContinentSong() {
  if (_seq)  { try { _seq.stop();  _seq.dispose();  } catch {} _seq  = null; }
  if (_loop) { try { _loop.stop(); _loop.dispose(); } catch {} _loop = null; }
  const inst = getInstruments();
  if (inst?.pad) { try { inst.pad.releaseAll(); } catch {} }
  Tone.getTransport().stop();
  _playing = false;
}

export function isContinentSongPlaying() { return _playing; }

function keyToMidi(key) {
  const MAP = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, Bb: 10, B: 11 };
  return (MAP[key] ?? 0) + 60;
}
