/**
 * Mic button — SpeechRecognition + MediaRecorder fallback.
 * Spec §17 Stage 6 (partial: local commands only until Gemini wired).
 */
import { state, setState } from '../state.js';
import { config } from '../config.js';
import { vibrate } from '../audio/haptics.js';
import { playEarcon } from '../audio/instruments.js';
import { say } from '../audio/speech.js';
import { showToast } from './shell.js';
import { navigate } from '../router.js';

let _recognizing = false;
let _recognition = null;

const LOCAL_COMMANDS = {
  en: {
    'globe': () => navigate('globe'),
    'go to globe': () => navigate('globe'),
    'continents': () => navigate('continents'),
    'go to continents': () => navigate('continents'),
    'how it sounds': () => navigate('how'),
    'temperature': () => setState({ layer: 'temperature' }),
    'co2': () => setState({ layer: 'co2' }),
    'fires': () => setState({ layer: 'wildfires', segment: 'disasters' }),
    'wildfires': () => setState({ layer: 'wildfires', segment: 'disasters' }),
    'storms': () => setState({ layer: 'storms', segment: 'disasters' }),
    'earthquakes': () => setState({ layer: 'earthquakes', segment: 'disasters' }),
    'volcanoes': () => setState({ layer: 'volcanoes', segment: 'disasters' }),
    'next year': () => setState({ year: Math.min(config.yearMax, state.year + 1) }),
    'previous year': () => setState({ year: Math.max(config.yearMin, state.year - 1) }),
    'mute': () => { document.getElementById('btn-mute')?.click(); },
    'help': () => say('Say: globe, continents, temperature, CO2, fires, storms, earthquakes, next year, previous year.'),
  },
  ru: {
    'глобус': () => navigate('globe'),
    'на глобус': () => navigate('globe'),
    'континенты': () => navigate('continents'),
    'температура': () => setState({ layer: 'temperature' }),
    'следующий год': () => setState({ year: Math.min(config.yearMax, state.year + 1) }),
    'предыдущий год': () => setState({ year: Math.max(config.yearMin, state.year - 1) }),
    'помощь': () => say('Скажите: глобус, континенты, температура, CO2, пожары, штормы, землетрясения.'),
  },
  kk: {
    'глобус': () => navigate('globe'),
    'температура': () => setState({ layer: 'temperature' }),
    'келесі жыл': () => setState({ year: Math.min(config.yearMax, state.year + 1) }),
    'алдыңғы жыл': () => setState({ year: Math.max(config.yearMin, state.year - 1) }),
    'көмек': () => say('Айтыңыз: глобус, континенттер, температура.'),
  },
};

function runLocalCommand(transcript) {
  const lang = state.settings.language || 'en';
  const cmds = { ...LOCAL_COMMANDS.en, ...(LOCAL_COMMANDS[lang] || {}) };
  const t = transcript.toLowerCase().trim();

  for (const [phrase, action] of Object.entries(cmds)) {
    if (t.includes(phrase)) {
      action();
      return true;
    }
  }
  return false;
}

export function initMicButton() {
  const btn = document.getElementById('mic-btn');
  if (!btn) return;

  if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
    btn.title = 'Speech recognition not supported';
    btn.style.opacity = '0.4';
    return;
  }

  btn.addEventListener('click', toggleMic);
}

function toggleMic() {
  if (_recognizing) {
    stopMic();
  } else {
    startMic();
  }
}

function startMic() {
  const SRClass = window.SpeechRecognition || window.webkitSpeechRecognition;
  _recognition = new SRClass();
  const lang = state.settings.language;
  _recognition.lang = lang === 'ru' ? 'ru-RU' : lang === 'kk' ? 'kk-KZ' : 'en-US';
  _recognition.interimResults = false;
  _recognition.maxAlternatives = 1;

  _recognition.onstart = () => {
    _recognizing = true;
    setMicState(true);
    vibrate('micStart');
    playEarcon('micStart');
    setTimeout(stopMic, config.micMaxMs);
  };

  _recognition.onresult = e => {
    const transcript = e.results[0]?.[0]?.transcript || '';
    if (!transcript) return;

    const handled = runLocalCommand(transcript);
    if (!handled) {
      // Forward to Gemini (Stage 6 — show toast for now)
      showToast(`"${transcript}" — Gemini assistant coming in Stage 6`);
    }
  };

  _recognition.onerror = e => {
    console.warn('[ej] speech error', e.error);
    playEarcon('error');
    stopMic();
  };

  _recognition.onend = () => stopMic();

  try { _recognition.start(); } catch {}
}

function stopMic() {
  if (_recognition) {
    try { _recognition.stop(); } catch {}
    _recognition = null;
  }
  _recognizing = false;
  setMicState(false);
  playEarcon('micStop');
  vibrate('micStop');
}

function setMicState(active) {
  const btn = document.getElementById('mic-btn');
  if (!btn) return;
  btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  btn.classList.toggle('recording', active);
  const icon = btn.querySelector('.mic-icon');
  if (icon) icon.textContent = active ? '🔴' : '🎙️';
}
