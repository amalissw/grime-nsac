/**
 * All synthesized instruments — created once, reused
 */
import * as Tone from 'tone';
import { getMasterChain } from './engine.js';

let instruments = null;
let reverb = null;

export function initInstruments() {
  if (instruments) return instruments;

  const chain = getMasterChain();

  // Shared reverb
  reverb = new Tone.Reverb({ decay: 3, preDelay: 0.03, wet: 0.25 });
  reverb.connect(chain);

  // Dry chain (no reverb for percussive sounds)
  const dry = chain;

  // Ocean: FM pad with LFO
  const oceanFilter = new Tone.Filter(600, 'lowpass').connect(reverb);
  const oceanLfo = new Tone.LFO({ frequency: 0.1, min: 400, max: 800 }).connect(oceanFilter.frequency);
  oceanLfo.start();
  const ocean = new Tone.FMSynth({
    harmonicity: 1.5,
    modulationIndex: 3,
    envelope: { attack: 0.4, decay: 0.2, sustain: 0.8, release: 2.0 },
    modulationEnvelope: { attack: 0.5, decay: 0.5, sustain: 0.5, release: 2.0 },
  }).connect(oceanFilter);
  ocean.volume.value = -20;

  // Ocean noise (wave texture)
  const waveNoise = new Tone.Noise('pink').connect(
    new Tone.Filter(300, 'lowpass').connect(
      new Tone.Volume(-35).connect(reverb)
    )
  );

  // Land: PluckSynth (marimba-like)
  const land = new Tone.PluckSynth({
    attackNoise: 1,
    dampening: 3800,
    resonance: 0.9,
  }).connect(reverb);
  land.volume.value = -18;

  // Fire crackle: NoiseSynth with bandpass
  const fireFilter = new Tone.Filter({ frequency: 2000, type: 'bandpass', Q: 1.5 });
  fireFilter.connect(dry);
  const fire = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 },
  }).connect(fireFilter);
  fire.volume.value = -28;

  // Anomaly dissonance: subtle tritone synth
  const anomaly = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.3, decay: 0.5, sustain: 0.4, release: 1.5 },
  }).connect(new Tone.Volume(-28).connect(reverb));

  // Coast click: MembraneSynth
  const coast = new Tone.MembraneSynth({
    pitchDecay: 0.025,
    octaves: 2,
    envelope: { attack: 0.001, decay: 0.025, sustain: 0, release: 0.01 },
  }).connect(dry);
  coast.volume.value = -18;

  // Beacon: sine bell
  const beaconPanner = new Tone.Panner(0).connect(reverb);
  const beacon = new Tone.Synth({
    oscillator: { type: 'sine', partials: [1, 0.5, 0.25] },
    envelope: { attack: 0.01, decay: 0.4, sustain: 0.1, release: 0.6 },
  }).connect(beaconPanner);
  beacon.volume.value = -16;

  // Year tick: MetalSynth
  const yearTick = new Tone.MetalSynth({
    frequency: 400,
    envelope: { attack: 0.001, decay: 0.04, release: 0.01 },
    harmonicity: 5.1,
    modulationIndex: 32,
    resonance: 4000,
    octaves: 1.5,
  }).connect(dry);
  yearTick.volume.value = -38;

  // Mood chord pad
  const chord = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.8, decay: 0.5, sustain: 0.7, release: 2.0 },
  }).connect(reverb);
  chord.volume.value = -26;
  chord.maxPolyphony = 4;

  // UI blip
  const ui = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.01 },
  }).connect(dry);
  ui.volume.value = -40;

  // Welcome chord
  const welcome = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.1, decay: 0.5, sustain: 0.4, release: 1.5 },
  }).connect(reverb);
  welcome.volume.value = -20;

  instruments = { ocean, waveNoise, land, fire, anomaly, coast, beacon, beaconPanner, yearTick, chord, ui, welcome };
  return instruments;
}

export function getInstruments() { return instruments; }

export function startWave() {
  if (!instruments) return;
  instruments.waveNoise.start();
}

export function stopWave() {
  if (!instruments) return;
  try { instruments.waveNoise.stop(); } catch {}
}

export function playWelcome() {
  if (!instruments) return;
  const { welcome } = instruments;
  const now = Tone.now();
  welcome.triggerAttackRelease(['C3', 'E3', 'G3'], 2, now);
}

export function playCoast() {
  if (!instruments) return;
  instruments.coast.triggerAttackRelease('C2', '32n');
}

export function playYearTick() {
  if (!instruments) return;
  instruments.yearTick.triggerAttackRelease('16n');
}

export function playUiClick() {
  if (!instruments) return;
  instruments.ui.triggerAttackRelease('E5', '32n');
}

export function playBeaconPulse(panValue, freq = 880) {
  if (!instruments) return;
  instruments.beaconPanner.pan.rampTo(panValue, 0.05);
  instruments.beacon.triggerAttackRelease(freq, '8n');
}

export function playAnomaly(noteFreq) {
  if (!instruments) return;
  instruments.anomaly.triggerAttackRelease(noteFreq, '4n');
}

export function playFanfare() {
  if (!instruments) return;
  const { welcome } = instruments;
  const now = Tone.now();
  welcome.triggerAttackRelease('C4', '8n', now);
  welcome.triggerAttackRelease('E4', '8n', now + 0.15);
  welcome.triggerAttackRelease('G4', '4n', now + 0.3);
}

export function playEdgeBump() {
  if (!instruments) return;
  instruments.coast.triggerAttackRelease('A1', '16n');
}
