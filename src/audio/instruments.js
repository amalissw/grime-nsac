/**
 * All synthesized instruments — created once at boot and reused.
 * Spec §9.2
 */
import * as Tone from 'tone';
import { getMasterChain, getReverb } from './engine.js';

let inst = null;

export function initInstruments() {
  if (inst) return inst;
  const chain = getMasterChain();
  const reverb = getReverb();

  // pad — base chord, danger harmony
  const pad = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 1.5,
    modulationIndex: 2,
    envelope: { attack: 1.2, release: 3 },
  });
  const padFilter = new Tone.Filter(700, 'lowpass');
  pad.connect(padFilter);
  padFilter.connect(reverb);
  pad.volume.value = -24;

  // pulse — danger tempo (heartbeat drum)
  const pulse = new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 2, envelope: { decay: 0.25 } });
  pulse.connect(chain);
  pulse.volume.value = -16;

  // marimba — temperature texture
  const marimba = new Tone.PluckSynth({ attackNoise: 1.5, dampening: 4000, resonance: 0.95 });
  marimba.connect(reverb);
  marimba.volume.value = -18;

  // crackle — fires
  const crackleFilter = new Tone.Filter({ frequency: 2500, type: 'bandpass', Q: 1.2 });
  crackleFilter.connect(chain);
  const crackle = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.03, sustain: 0 },
  });
  crackle.connect(crackleFilter);
  crackle.volume.value = -24;

  // wind — storms
  const windPanner = new Tone.AutoPanner({ frequency: 0.3, depth: 1 });
  windPanner.connect(reverb);
  windPanner.start();
  const windFilter = new Tone.AutoFilter({ frequency: 0.2, baseFrequency: 400, octaves: 2.5 });
  windFilter.connect(windPanner);
  windFilter.start();
  const wind = new Tone.Noise('pink');
  wind.connect(windFilter);
  wind.volume.value = -28;

  // thump — earthquakes
  const thump = new Tone.MembraneSynth({ pitchDecay: 0.1, octaves: 6, envelope: { decay: 0.8 } });
  thump.connect(reverb);
  thump.volume.value = -18;

  // rumble — volcanoes
  const rumbleEnv = new Tone.AmplitudeEnvelope({ attack: 0.3, decay: 3, sustain: 0, release: 1 });
  rumbleEnv.connect(chain);
  const rumbleFilter = new Tone.Filter(200, 'lowpass');
  rumbleFilter.connect(rumbleEnv);
  const rumble = new Tone.Noise('brown');
  rumble.connect(rumbleFilter);
  rumble.volume.value = -20;

  // air — CO₂ "thick air"
  const airFilter = new Tone.Filter(6000, 'lowpass');
  airFilter.connect(chain);
  const air = new Tone.Noise('pink');
  air.connect(airFilter);
  air.volume.value = -30;
  air.start();

  // birds — continents
  const birds = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 3.01,
    modulationIndex: 10,
    envelope: { attack: 0.005, decay: 0.08, sustain: 0 },
  });
  birds.connect(reverb);
  birds.volume.value = -14;

  // hum — continents CO₂ drone
  const humFilter = new Tone.Filter(300, 'lowpass');
  humFilter.connect(chain);
  const humOsc = new Tone.Oscillator(55, 'sine');
  humOsc.connect(humFilter);
  const humNoise = new Tone.Noise('pink');
  humNoise.connect(humFilter);
  const hum = new Tone.Volume(-40);
  humOsc.connect(hum);
  humNoise.connect(hum);
  hum.connect(chain);

  // welcome chord
  const welcome = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.1, decay: 0.5, sustain: 0.4, release: 1.5 },
  });
  welcome.connect(reverb);
  welcome.volume.value = -20;

  // earcon blip
  const earcon = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 },
  });
  earcon.connect(chain);
  earcon.volume.value = -32;

  // spatial panner (for position compass)
  const panner = new Tone.Panner(0);
  panner.connect(reverb);

  inst = {
    pad, padFilter,
    pulse,
    marimba,
    crackle, crackleFilter,
    wind, windFilter, windPanner,
    thump,
    rumble, rumbleFilter, rumbleEnv,
    air, airFilter,
    birds,
    hum, humOsc, humNoise,
    welcome,
    earcon,
    panner,
  };
  return inst;
}

export function getInstruments() { return inst; }

export function playWelcomeChord() {
  const i = inst; if (!i) return;
  const now = Tone.now();
  i.welcome.triggerAttackRelease(['C3', 'E3', 'G3', 'B3'], 2, now);
}

let _earconBusy = false;
export function playEarcon(type) {
  const i = inst; if (!i || _earconBusy) return;
  _earconBusy = true;
  const now = Tone.now();
  switch (type) {
    case 'select':    i.earcon.triggerAttackRelease('E6', '32n', now); break;
    case 'layerChange': {
      i.earcon.triggerAttackRelease('C5', '16n', now);
      i.earcon.triggerAttackRelease('E5', '16n', now + 0.12);
      break;
    }
    case 'yearTick':  i.earcon.triggerAttackRelease('C6', '64n', now); break;
    case 'micStart': {
      i.earcon.triggerAttackRelease('C5', '16n', now);
      i.earcon.triggerAttackRelease('E5', '16n', now + 0.1);
      break;
    }
    case 'micStop': {
      i.earcon.triggerAttackRelease('E5', '16n', now);
      i.earcon.triggerAttackRelease('C5', '16n', now + 0.1);
      break;
    }
    case 'error': {
      i.earcon.triggerAttackRelease('C3', '8n', now);
      i.earcon.triggerAttackRelease('C3', '8n', now + 0.15);
      break;
    }
    case 'pageChange': i.earcon.triggerAttackRelease('G5', '16n', now); break;
    case 'thinking':  i.earcon.triggerAttackRelease('A4', '64n', now); break;
  }
  setTimeout(() => { _earconBusy = false; }, 300);
}
