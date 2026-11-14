/**
 * Speech: Gemini TTS voice with cache + browser fallback. Spec §10.6
 */
import { state } from '../state.js';
import { config } from '../config.js';
import { duckMusic } from './engine.js';
import { announce } from '../ui/shell.js';

const _memCache = new Map();
let _db = null;

async function openDb() {
  if (_db) return _db;
  return new Promise((res, rej) => {
    const req = indexedDB.open('ej-tts-cache', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('tts');
    req.onsuccess = e => { _db = e.target.result; res(_db); };
    req.onerror = rej;
  });
}

function hashKey(text, voice, lang) {
  return `${lang}:${voice}:${text.slice(0, 200)}`;
}

async function dbGet(key) {
  try {
    const db = await openDb();
    return new Promise(res => {
      const tx = db.transaction('tts', 'readonly');
      tx.objectStore('tts').get(key).onsuccess = e => res(e.target.result);
    });
  } catch { return null; }
}

async function dbSet(key, buf) {
  try {
    const db = await openDb();
    const tx = db.transaction('tts', 'readwrite');
    tx.objectStore('tts').put(buf, key);
  } catch {}
}

async function fetchGeminiTts(text, voice, lang) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiTtsModel}:generateContent?key=${apiKey}`;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Say calmly and clearly: ${text}` }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
      }),
      signal: AbortSignal.timeout(config.geminiTimeoutMs),
    });
    if (!r.ok) return null;
    const json = await r.json();
    const b64 = json?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!b64) return null;
    // Decode base64 PCM (16-bit, mono, 24kHz)
    const binary = atob(b64);
    const buf = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
    return buf.buffer;
  } catch { return null; }
}

async function playPcmBuffer(arrayBuf) {
  try {
    const ctx = new AudioContext({ sampleRate: 24000 });
    const data = new Int16Array(arrayBuf);
    const floats = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) floats[i] = data[i] / 32768;
    const ab = ctx.createBuffer(1, floats.length, 24000);
    ab.copyToChannel(floats, 0);
    const src = ctx.createBufferSource();
    src.buffer = ab;
    src.connect(ctx.destination);
    return new Promise(res => {
      src.onended = () => { ctx.close(); res(); };
      src.start();
    });
  } catch { return; }
}

let _queue = Promise.resolve();

export function say(text, { assertive = false } = {}) {
  announce(text, assertive);
  if (state.settings.screenReader) return; // TalkBack handles it

  _queue = _queue.then(() => _speak(text));
}

async function _speak(text) {
  duckMusic(true);
  const voice = state.settings.voice || config.geminiDefaultVoice;
  const lang = state.settings.language || 'en';
  const key = hashKey(text, voice, lang);

  let buf = _memCache.get(key) || (await dbGet(key));
  if (!buf) {
    buf = await fetchGeminiTts(text, voice, lang);
    if (buf) {
      _memCache.set(key, buf);
      dbSet(key, buf);
    }
  }

  try {
    if (buf) {
      await playPcmBuffer(buf);
    } else {
      await browserSpeak(text);
    }
  } catch {
    await browserSpeak(text);
  } finally {
    duckMusic(false);
  }
}

function browserSpeak(text) {
  if (!window.speechSynthesis) return Promise.resolve();
  return new Promise(res => {
    const utt = new SpeechSynthesisUtterance(text);
    const lang = state.settings.language;
    utt.lang = lang === 'ru' ? 'ru-RU' : lang === 'kk' ? 'kk-KZ' : 'en-US';
    utt.rate = state.settings.voiceSpeed || 1;
    utt.onend = res;
    utt.onerror = res;
    speechSynthesis.speak(utt);
  });
}

export function unlockSpeech() {
  // Unlock speech in same synchronous handler
  if (window.speechSynthesis) {
    const u = new SpeechSynthesisUtterance('');
    speechSynthesis.speak(u);
  }
}
