/**
 * Audio engine: unlock, master chain, ducking, transport
 */
import * as Tone from 'tone';
import { config } from '../config.js';

let _masterChain = null;
let _reverb = null;
let _masterVol = null;
let _ducked = false;
let _muted = false;
let _volumePct = 0.8;

export async function unlockAudio() {
  if (Tone.context.state !== 'running') {
    await Tone.start();
  }
}

export function initMasterChain() {
  if (_masterChain) return _masterChain;

  Tone.setContext(new Tone.Context({ latencyHint: 'interactive', lookAhead: 0.03 }));

  const compressor = new Tone.Compressor({
    threshold: config.masterCompressorThreshold,
    ratio: config.masterCompressorRatio,
  });
  const limiter = new Tone.Limiter(config.masterLimiterThreshold);
  _masterVol = new Tone.Volume(config.masterVolume);

  compressor.connect(limiter);
  limiter.connect(_masterVol);
  _masterVol.connect(Tone.getDestination());

  _reverb = new Tone.Reverb({ decay: config.reverbDecay, wet: config.reverbWet });
  _reverb.connect(compressor);

  _masterChain = compressor;
  return compressor;
}

export function getMasterChain() { return _masterChain || initMasterChain(); }
export function getReverb() { return _reverb; }

export function setMasterVolume(pct) {
  _volumePct = pct;
  if (_masterVol && !_muted) {
    _masterVol.volume.value = pct > 0 ? 20 * Math.log10(pct) + config.masterVolume : -Infinity;
  }
}

export function setMasterMute(muted) {
  _muted = muted;
  if (_masterVol) {
    _masterVol.volume.value = muted ? -Infinity : config.masterVolume + 20 * Math.log10(_volumePct || 0.001);
  }
}

export function duckMusic(duck) {
  if (!_masterVol) return;
  if (duck && !_ducked) {
    _ducked = true;
    _masterVol.volume.rampTo(_masterVol.volume.value + config.duckDb, config.duckAttackMs / 1000);
  } else if (!duck && _ducked) {
    _ducked = false;
    _masterVol.volume.rampTo(config.masterVolume, config.duckReleaseMs / 1000);
  }
}

// visibilitychange — pause/resume
let _wasPlaying = false;
document.addEventListener('visibilitychange', () => {
  if (!_masterChain) return;
  if (document.hidden) {
    _wasPlaying = Tone.getTransport().state === 'started';
    if (_wasPlaying) Tone.getTransport().pause();
  } else {
    if (_wasPlaying) {
      Tone.getTransport().start();
      import('../ui/shell.js').then(m => m.showToast?.('Sound resumed'));
    }
  }
});
