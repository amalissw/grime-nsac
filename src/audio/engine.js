/**
 * Audio engine: Tone.js context, master chain, unlock
 */
import * as Tone from 'tone';

let initialized = false;
let masterVolume;
let compressor;
let limiter;

export function getContext() { return Tone.getContext(); }

export async function unlockAudio() {
  if (initialized) return;
  // Must be called synchronously in a user gesture handler
  await Tone.start();

  // Low latency context
  Tone.getContext().lookAhead = 0.03;

  // Master chain: Compressor → Limiter → Volume → Destination
  compressor = new Tone.Compressor({ threshold: -18, ratio: 4, attack: 0.01, release: 0.25 });
  limiter = new Tone.Limiter(-1);
  masterVolume = new Tone.Volume(-12);

  masterVolume.connect(Tone.getDestination());
  limiter.connect(masterVolume);
  compressor.connect(limiter);

  initialized = true;
}

export function getMasterChain() {
  return compressor;
}

export function setVolume(db) {
  if (masterVolume) masterVolume.volume.rampTo(db, 0.1);
}

export function mute(on) {
  if (masterVolume) masterVolume.mute = on;
}

export function isMuted() {
  return masterVolume ? masterVolume.mute : false;
}

export function duckVolume(db, duration = 0.1) {
  if (!masterVolume) return;
  const current = masterVolume.volume.value;
  masterVolume.volume.rampTo(db, 0.05);
  setTimeout(() => {
    if (masterVolume) masterVolume.volume.rampTo(current, duration);
  }, 50 + duration * 1000);
}

export function isReady() { return initialized; }
