/**
 * Mic button — SpeechRecognition + Gemini AI fallback.
 * Local commands run instantly; unrecognized speech goes to Gemini.
 */
import { state, setState } from '../state.js';
import { config } from '../config.js';
import { vibrate } from '../audio/haptics.js';
import { playEarcon } from '../audio/instruments.js';
import { say } from '../audio/speech.js';
import { showToast } from './shell.js';
import { navigate } from '../router.js';
import { askGemini, isGeminiConfigured } from '../audio/gemini.js';
import { duckMusic } from '../audio/engine.js';

let _recognizing = false;
let _recognition = null;

// ── Local commands ────────────────────────────────────────────────────────────
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
    'mute': () => { document.getElementById('mute-btn')?.click(); },
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
    if (t.includes(phrase)) { action(); return true; }
  }
  return false;
}

// ── Gemini fallback ───────────────────────────────────────────────────────────
async function handleWithGemini(transcript) {
  setMicState('thinking');
  duckMusic(true);
  playEarcon('thinking');

  const ctx = {
    layer: state.layer,
    year: state.year,
    lat: state.selection?.lat ?? null,
    lon: state.selection?.lon ?? null,
    pointData: state.selection ?? null,
    language: state.settings.language || 'en',
  };

  const reply = await askGemini(transcript, ctx);
  duckMusic(false);

  if (reply) {
    say(reply);
    showToast(reply.slice(0, 100) + (reply.length > 100 ? '…' : ''));
  } else {
    const fallback = {
      en: `I heard: "${transcript}". Try asking about the temperature, CO₂ levels, or what's happening in a region.`,
      ru: `Я слышу: "${transcript}". Попробуйте спросить о температуре или CO₂.`,
      kk: `Мен естідім: "${transcript}". Температура немесе CO₂ туралы сұраңыз.`,
    };
    say(fallback[state.settings.language || 'en'] || fallback.en);
  }

  setMicState(false);
}

// ── Init ──────────────────────────────────────────────────────────────────────
export function initMicButton() {
  const btn = document.getElementById('mic-btn');
  if (!btn) return;

  if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
    btn.title = 'Speech recognition not supported in this browser';
    btn.style.opacity = '0.4';
    btn.setAttribute('aria-disabled', 'true');
    return;
  }

  // Show Gemini badge if key is present
  if (isGeminiConfigured()) {
    btn.setAttribute('title', 'Ask Earth Jukebox (AI-powered)');
    const badge = document.createElement('span');
    badge.className = 'mic-ai-badge';
    badge.textContent = 'AI';
    badge.setAttribute('aria-hidden', 'true');
    btn.appendChild(badge);
  }

  btn.addEventListener('click', toggleMic);
}

function toggleMic() {
  if (_recognizing) stopMic();
  else startMic();
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
    setMicState('listening');
    vibrate('micStart');
    playEarcon('micStart');
    setTimeout(stopMic, config.micMaxMs);
  };

  _recognition.onresult = async e => {
    const transcript = e.results[0]?.[0]?.transcript || '';
    if (!transcript) return;

    const handled = runLocalCommand(transcript);
    if (!handled) {
      await handleWithGemini(transcript);
    }
  };

  _recognition.onerror = e => {
    if (e.error !== 'no-speech') {
      playEarcon('error');
      showToast('Mic error: ' + e.error);
    }
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

function setMicState(state) {
  const btn = document.getElementById('mic-btn');
  if (!btn) return;
  btn.setAttribute('aria-pressed', state === 'listening' ? 'true' : 'false');
  btn.classList.toggle('recording', state === 'listening');
  btn.classList.toggle('thinking', state === 'thinking');
  const icon = btn.querySelector('.mic-icon');
  if (icon) {
    if (state === 'listening') icon.textContent = '🔴';
    else if (state === 'thinking') icon.textContent = '💭';
    else icon.textContent = '🎙️';
  }
}
