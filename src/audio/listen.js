/**
 * Sound listener — drives all layer sounds from point data.
 * Spec §9.3-9.10, §17 Stage 3/5.
 *
 * API:
 *   startListening(lat, lon, layer, year) → plays 4-part sound for data point
 *   stopListening()
 *   onYearChange(year) → updates sound for current layer/position
 */
import * as Tone from 'tone';
import { getInstruments } from './instruments.js';
import { getPointData } from '../data/query.js';
import { state } from '../state.js';
import { config } from '../config.js';
import { vibrate, vibrateLevel } from './haptics.js';
import {
  calcDangerLevel,
  DANGER_BPM, DANGER_CHORDS, DANGER_CUTOFF, DANGER_VIBRATION,
  LAYER_SCALES,
  tempToMarimbaSettings, co2ToAirSettings, windKtToSettings,
  fireDensityCrackle, spatialPan, latPitchShift,
} from './mapping.js';

let _active = false;
let _stopHandle = null;
let _currentLat = 0;
let _currentLon = 0;
let _currentLayer = 'temperature';
let _currentYear = config.defaultYear;

// ── Public API ────────────────────────────────────────────────────────────────
export function startListening(lat, lon, layer, year) {
  _active = true;
  _currentLat = lat;
  _currentLon = lon;
  _currentLayer = layer || state.layer;
  _currentYear = year || state.year;

  const pt = getPointData(lat, lon, _currentLayer, _currentYear);
  _playPoint(pt, lat, lon);
}

export function stopListening() {
  _active = false;
  _silence();
}

export function onYearChange(year) {
  if (!_active) return;
  _currentYear = year;
  const pt = getPointData(_currentLat, _currentLon, _currentLayer, _currentYear);
  _playPoint(pt, _currentLat, _currentLon);
}

// ── Core: play data point ─────────────────────────────────────────────────────
function _playPoint(pt, lat, lon) {
  const inst = getInstruments();
  if (!inst) return;

  const level = pt.level ?? 1;
  const pan = spatialPan(lon);
  const layerScale = LAYER_SCALES[_currentLayer] || LAYER_SCALES.temperature;

  // Set global BPM from danger level
  Tone.getTransport().bpm.value = DANGER_BPM[level - 1] || 72;

  // ① Chord (pad) — danger chord + filter cutoff
  _playChord(inst, level, pan, layerScale);

  // ② Pulse (kick) — BPM beat
  _playPulse(inst, level, pan);

  // ③ Texture — layer-specific sound
  _playTexture(inst, pt, lat, lon, level, pan);

  // ④ Spatial compass
  _applyPanPitch(inst, pan, lat);

  // Haptics
  vibrateLevel(level);
  if (level >= 4) vibrate(`level${level}`);

  // Update now-listening display
  updateNowListening(pt, level);
}

function _playChord(inst, level, pan, layerScale) {
  const { pad } = inst;
  if (!pad) return;

  const chordIntervals = DANGER_CHORDS[level - 1] || [0, 4, 7];
  const rootMidi = noteNameToMidi(layerScale.key) + 48; // octave 4

  try {
    pad.releaseAll();
    const notes = chordIntervals.map(i => Tone.Frequency(rootMidi + i, 'midi').toNote());
    pad.triggerAttack(notes, Tone.now());

    // Filter cutoff
    const cutoff = DANGER_CUTOFF[level - 1] || 1000;
    if (inst.padFilter) inst.padFilter.frequency.rampTo(cutoff, 0.3);
  } catch {}
}

function _playPulse(inst, level, pan) {
  if (!inst.pulse) return;
  if (inst._pulseLoop) inst._pulseLoop.dispose();

  const bpm = DANGER_BPM[level - 1] || 72;
  const interval = `${Math.round(60000 / bpm)}i`;

  try {
    inst._pulseLoop = new Tone.Loop(time => {
      inst.pulse.triggerAttackRelease('C1', '8n', time);
    }, interval).start(0);
    Tone.getTransport().start();
  } catch {}
}

function _playTexture(inst, pt, lat, lon, level, pan) {
  const { value } = pt;
  try {
    switch (_currentLayer) {
      case 'temperature': {
        const s = tempToMarimbaSettings(value ?? 0);
        if (inst.marimba) {
          const note = Tone.Frequency(s.baseMidi, 'midi').toNote();
          inst.marimba.triggerAttackRelease(note, '4n');
        }
        break;
      }
      case 'co2': {
        const s = co2ToAirSettings(value ?? 400);
        if (inst.air && inst.airFilter) {
          inst.airFilter.frequency.rampTo(s.cutoff, 0.5);
        }
        break;
      }
      case 'wildfires': {
        const s = fireDensityCrackle(value ?? 0, lat, lon);
        if (inst.crackle) {
          // crackle volume from density
          inst.crackle.volume.rampTo(s.gain, 0.3);
        }
        break;
      }
      case 'storms': {
        const s = windKtToSettings(value ?? 0);
        if (inst.wind) {
          inst.wind.volume.rampTo(s.gain, 0.5);
        }
        break;
      }
      case 'earthquakes': {
        if (value && value >= 5.5 && inst.thump) {
          inst.thump.triggerAttackRelease(Tone.Frequency(40, 'hz').toNote(), '2n');
        }
        if (level >= 4 && inst.rumble) {
          inst.rumble.triggerAttack(Tone.now());
          setTimeout(() => { try { inst.rumble.triggerRelease(); } catch {} }, 2000);
        }
        break;
      }
      case 'volcanoes': {
        if (level >= 3 && inst.hum) {
          inst.hum.volume.rampTo(-20, 0.5);
        }
        break;
      }
    }
  } catch (e) {
    console.warn('[ej] texture error', e);
  }
}

function _applyPanPitch(inst, pan, lat) {
  // Pan is applied via stereo panner on master chain
  // Pitch shift is applied to marimba transposition
  const pitchShift = latPitchShift(lat);
  if (inst.marimba && inst.marimba.set) {
    try { inst.marimba.set({ detune: pitchShift * 100 }); } catch {}
  }
}

function _silence() {
  const inst = getInstruments();
  if (!inst) return;
  try {
    if (inst.pad) inst.pad.releaseAll();
    if (inst._pulseLoop) { inst._pulseLoop.dispose(); inst._pulseLoop = null; }
    Tone.getTransport().stop();
  } catch {}
}

// ── Now Listening display ─────────────────────────────────────────────────────
function updateNowListening(pt, level) {
  const container = document.getElementById('now-listening');
  const textEl = document.getElementById('now-listening-text');
  const dangerBar = document.getElementById('danger-bar');

  if (!container) return;

  if (textEl) {
    const layerName = { temperature: 'Temperature', co2: 'CO₂', wildfires: 'Wildfires', storms: 'Storms', earthquakes: 'Earthquakes', volcanoes: 'Volcanoes' }[_currentLayer] || _currentLayer;
    const val = pt.value !== null && pt.value !== undefined ? `${Number(pt.value).toFixed(1)} ${pt.units}` : '—';
    textEl.textContent = `${pt.place} · ${layerName}: ${val}`;
  }

  if (dangerBar) {
    dangerBar.setAttribute('aria-valuenow', level);
    dangerBar.style.background = `linear-gradient(to right, #22C55E 0%, ${dangerLevelColor(level)} 100%)`;
  }

  container.hidden = false;
  container.classList.add('visible');
}

function dangerLevelColor(level) {
  return ['#22C55E', '#A3E635', '#FACC15', '#F97316', '#DC2626'][level - 1] || '#22C55E';
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const NOTE_MAP = { 'C': 60, 'D': 62, 'E': 64, 'F': 65, 'G': 67, 'A': 69, 'Bb': 70, 'B': 71 };
function noteNameToMidi(name) { return NOTE_MAP[name] ?? 60; }
