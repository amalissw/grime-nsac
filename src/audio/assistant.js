/**
 * Earth Jukebox — Gemini Voice Assistant
 * ========================================
 * Handles SpeechRecognition (EN/RU/KK), local command dispatch,
 * and Gemini API calls (text + TTS) for the mic button.
 * Spec §10 — Stage 6.
 *
 * API:
 *   initAssistant()
 *   startMicSession()   → begins SpeechRecognition
 *   stopMicSession()
 */

import { state, setState } from '../state.js';
import { config } from '../config.js';
import { say } from './speech.js';
import { playEarcon } from './sound-engine.js';
import { vibrate } from './haptics.js';
import { navigate } from '../router.js';
import { showToast, announce } from '../ui/shell.js';
import { getPointData, getWorldData } from '../data/query.js';

// ── Lang → SpeechRecognition lang code ───────────────────────────────────────
const SPEECH_LANG = { en: 'en-US', ru: 'ru-RU', kk: 'kk-KZ' };

// ── Local command patterns per language ──────────────────────────────────────
const LOCAL_COMMANDS = {
  en: [
    { pattern: /\b(globe|map)\b/i,          action: () => navigate('globe') },
    { pattern: /\b(continents?|continent)\b/i, action: () => navigate('continents') },
    { pattern: /\bhow (it )?sounds?\b/i,    action: () => navigate('how') },
    { pattern: /\b(temperature|temp)\b/i,   action: () => _setLayer('temperature') },
    { pattern: /\bco2|carbon\b/i,           action: () => _setLayer('co2') },
    { pattern: /\bfire|wildfire\b/i,        action: () => _setLayer('wildfires') },
    { pattern: /\bstorm\b/i,                action: () => _setLayer('storms') },
    { pattern: /\bearthquake\b/i,           action: () => _setLayer('earthquakes') },
    { pattern: /\bvolcan\w*\b/i,            action: () => _setLayer('volcanoes') },
    { pattern: /\b(year\s+)?(\d{4})\b/,     action: (m) => _setYear(parseInt(m[2])) },
    { pattern: /\b(latest|newest|now)\b/i,  action: () => _setYear(config.yearMax) },
    { pattern: /\bstop\b/i,                 action: () => stopMicSession() },
  ],
  ru: [
    { pattern: /\b(глобус|карта)\b/i,          action: () => navigate('globe') },
    { pattern: /\b(континент)\b/i,             action: () => navigate('continents') },
    { pattern: /\b(как звучит)\b/i,            action: () => navigate('how') },
    { pattern: /\b(температура|темп)\b/i,      action: () => _setLayer('temperature') },
    { pattern: /\b(co2|углерод)\b/i,           action: () => _setLayer('co2') },
    { pattern: /\b(пожар|огонь)\b/i,           action: () => _setLayer('wildfires') },
    { pattern: /\b(шторм|ураган)\b/i,          action: () => _setLayer('storms') },
    { pattern: /\b(землетрясение)\b/i,         action: () => _setLayer('earthquakes') },
    { pattern: /\b(вулкан)\b/i,                action: () => _setLayer('volcanoes') },
    { pattern: /\b(\d{4})\s*(год)?\b/,         action: (m) => _setYear(parseInt(m[1])) },
    { pattern: /\b(последний|сейчас)\b/i,      action: () => _setYear(config.yearMax) },
    { pattern: /\b(стоп|стоп|остановись)\b/i,  action: () => stopMicSession() },
  ],
  kk: [
    { pattern: /\b(глобус|карта)\b/i,              action: () => navigate('globe') },
    { pattern: /\b(континент)\b/i,                 action: () => navigate('continents') },
    { pattern: /\b(қалай естіледі)\b/i,            action: () => navigate('how') },
    { pattern: /\b(температура|жылу)\b/i,          action: () => _setLayer('temperature') },
    { pattern: /\b(co2|көміртек)\b/i,              action: () => _setLayer('co2') },
    { pattern: /\b(өрт)\b/i,                       action: () => _setLayer('wildfires') },
    { pattern: /\b(дауыл|бора)\b/i,                action: () => _setLayer('storms') },
    { pattern: /\b(жер сілкінісі|сілкіну)\b/i,    action: () => _setLayer('earthquakes') },
    { pattern: /\b(жанартау)\b/i,                  action: () => _setLayer('volcanoes') },
    { pattern: /\b(\d{4})\b/,                      action: (m) => _setYear(parseInt(m[1])) },
    { pattern: /\b(соңғы|қазір)\b/i,               action: () => _setYear(config.yearMax) },
    { pattern: /\b(тоқта|стоп)\b/i,                action: () => stopMicSession() },
  ],
};

// ── State ─────────────────────────────────────────────────────────────────────
let _recognition = null;
let _session = false;
let _history = [];   // last 6 turns [{role, text}]
const MAX_HISTORY = 6;

// ── Init ──────────────────────────────────────────────────────────────────────
export function initAssistant() {
  // wire mic button
  const micBtn = document.getElementById('mic-btn');
  if (!micBtn) return;
  micBtn.addEventListener('click', () => {
    if (_session) stopMicSession();
    else startMicSession();
  });
}

// ── Mic session ───────────────────────────────────────────────────────────────
export function startMicSession() {
  if (_session) return;
  if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
    showToast(_t('no_speech'));
    return;
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  _recognition = new SR();
  _recognition.lang           = SPEECH_LANG[state.settings?.language || 'en'] || 'en-US';
  _recognition.interimResults = false;
  _recognition.maxAlternatives = 1;
  _recognition.continuous     = false;

  _recognition.onstart = () => {
    _session = true;
    _setMicState('listening');
    playEarcon('micStart');
    vibrate('micStart');
    announce(_t('listening'));
  };

  _recognition.onresult = (e) => {
    const text = e.results[0]?.[0]?.transcript?.trim() || '';
    if (text) _handleUtterance(text);
  };

  _recognition.onerror = (e) => {
    if (e.error !== 'no-speech') {
      showToast(_t('speech_error') + ': ' + e.error);
      playEarcon('error');
    }
    _stopRecognition();
  };

  _recognition.onend = () => {
    _stopRecognition();
  };

  try {
    _recognition.start();
  } catch {
    _session = false;
    _setMicState('idle');
  }
}

export function stopMicSession() {
  _stopRecognition();
  playEarcon('micStop');
}

function _stopRecognition() {
  _session = false;
  if (_recognition) {
    try { _recognition.abort(); } catch {}
    _recognition = null;
  }
  _setMicState('idle');
}

// ── Utterance handling ────────────────────────────────────────────────────────
async function _handleUtterance(text) {
  _setMicState('thinking');
  playEarcon('thinking');
  announce(text);

  // 1. Try local commands first (instant, no API call)
  if (_tryLocalCommand(text)) {
    _setMicState('idle');
    return;
  }

  // 2. Fall back to Gemini
  _setMicState('thinking');
  const reply = await _callGemini(text);
  if (reply) {
    say(reply);
    showToast(reply.slice(0, 80));
  }
  _setMicState('idle');
}

function _tryLocalCommand(text) {
  const lang = state.settings?.language || 'en';
  const commands = LOCAL_COMMANDS[lang] || LOCAL_COMMANDS.en;
  for (const cmd of commands) {
    const m = text.match(cmd.pattern);
    if (m) {
      cmd.action(m);
      return true;
    }
  }
  return false;
}

// ── Gemini text API ───────────────────────────────────────────────────────────
async function _callGemini(userText) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return _t('no_api_key');

  const lang = state.settings?.language || 'en';
  const year = state.year || config.defaultYear;
  const layer = state.layer || 'temperature';

  // Build context JSON
  const ctx = _buildContext(layer, year);

  // System instruction (trilingual)
  const systemInstr = {
    en: `You are Earth Jukebox, a friendly climate guide. Answer in English. Be concise (max 2 sentences). Use the context JSON for facts.`,
    ru: `Ты Earth Jukebox, дружелюбный гид по климату. Отвечай на русском. Кратко (максимум 2 предложения). Используй данные контекста для фактов.`,
    kk: `Сіз Earth Jukebox, мейірімді климат жетекшісіз. Қазақша жауап беріңіз. Қысқаша (максимум 2 сөйлем). Контекст деректерін қолданыңыз.`,
  };

  _history.push({ role: 'user', text: userText });
  if (_history.length > MAX_HISTORY) _history.shift();

  const contents = [
    ..._history.slice(0, -1).map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.text }] })),
    { role: 'user', parts: [{ text: `${userText}\n\nCONTEXT: ${JSON.stringify(ctx)}` }] },
  ];

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiTextModel}:generateContent?key=${apiKey}`;

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstr[lang] || systemInstr.en }] },
        contents,
        generationConfig: {
          temperature: config.geminiTemperature,
          maxOutputTokens: config.geminiMaxOutputTokens,
        },
      }),
      signal: AbortSignal.timeout(config.geminiTimeoutMs),
    });

    if (!r.ok) return _t('api_error');
    const json = await r.json();
    const reply = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    if (reply) {
      _history.push({ role: 'model', text: reply });
      if (_history.length > MAX_HISTORY) _history.shift();
    }
    return reply || _t('no_reply');
  } catch {
    return _t('api_error');
  }
}

function _buildContext(layer, year) {
  const world = getWorldData(layer, year);
  return {
    year,
    layer,
    value: world.value,
    units: world.units,
    dangerLevel: world.level,
    language: state.settings?.language || 'en',
  };
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function _setMicState(s) {
  const btn = document.getElementById('mic-btn');
  if (!btn) return;
  btn.dataset.state = s;
  btn.setAttribute('aria-pressed', s === 'listening' ? 'true' : 'false');

  // Icon
  const icon = btn.querySelector('.mic-icon');
  if (icon) {
    icon.textContent = s === 'listening' ? '🔴' : s === 'thinking' ? '💭' : '🎙️';
  }

  btn.classList.toggle('mic-listening', s === 'listening');
  btn.classList.toggle('mic-thinking', s === 'thinking');
}

function _setLayer(layer) {
  setState({ layer });
  // Trigger layer button UI
  document.querySelectorAll('.option-card[data-layer]').forEach(b => {
    b.classList.toggle('active', b.dataset.layer === layer);
    b.setAttribute('aria-pressed', b.dataset.layer === layer ? 'true' : 'false');
  });
  // Show correct segment
  const isDisaster = ['wildfires', 'storms', 'earthquakes', 'volcanoes'].includes(layer);
  document.getElementById('climate-options')?.toggleAttribute('hidden', isDisaster);
  document.getElementById('disaster-options')?.toggleAttribute('hidden', !isDisaster);
  // Update segment tabs
  document.querySelectorAll('.segment-tab').forEach(b => {
    const seg = isDisaster ? 'disasters' : 'climate';
    b.classList.toggle('active', b.dataset.segment === seg);
  });
}

function _setYear(year) {
  if (year < config.yearMin || year > config.yearMax) return;
  setState({ year });
}

// ── i18n ──────────────────────────────────────────────────────────────────────
function _t(key) {
  const lang = state.settings?.language || 'en';
  const strings = {
    en: {
      listening: 'Listening…',
      no_speech: 'Speech recognition not supported',
      speech_error: 'Speech error',
      no_api_key: 'No API key configured',
      api_error: 'Could not reach Gemini',
      no_reply: 'No reply',
    },
    ru: {
      listening: 'Слушаю…',
      no_speech: 'Распознавание речи не поддерживается',
      speech_error: 'Ошибка речи',
      no_api_key: 'Ключ API не настроен',
      api_error: 'Не удалось связаться с Gemini',
      no_reply: 'Нет ответа',
    },
    kk: {
      listening: 'Тыңдап тұрмын…',
      no_speech: 'Сөйлеуді тану қолданылмайды',
      speech_error: 'Сөйлеу қатесі',
      no_api_key: 'API кілті орнатылмаған',
      api_error: 'Gemini-ге жету мүмкін болмады',
      no_reply: 'Жауап жоқ',
    },
  };
  return strings[lang]?.[key] || strings.en[key] || key;
}
