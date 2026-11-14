/**
 * Web Speech API wrapper
 */
import { duckVolume } from './engine.js';

let synth = window.speechSynthesis;
let selectedVoice = null;
let lang = 'en';
let srMode = false;

export function initSpeech() {
  if (!synth) return;
  loadVoices();
  synth.addEventListener('voiceschanged', loadVoices);
}

function loadVoices() {
  const voices = synth.getVoices();
  selectedVoice = voices.find(v => v.lang.startsWith('en')) || voices[0] || null;
}

export function setLanguage(newLang) {
  lang = newLang;
  const voices = synth ? synth.getVoices() : [];
  if (newLang === 'ru') {
    selectedVoice = voices.find(v => v.lang.startsWith('ru')) || selectedVoice;
  } else {
    selectedVoice = voices.find(v => v.lang.startsWith('en')) || selectedVoice;
  }
}

export function setScreenReaderMode(on) { srMode = on; }

export function speak(text, priority = false) {
  if (!synth || srMode) return;
  if (priority || priority === 'interrupt') synth.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  if (selectedVoice) utt.voice = selectedVoice;
  utt.lang = lang === 'ru' ? 'ru-RU' : 'en-US';
  utt.rate = 0.95;
  utt.onstart = () => duckVolume(-26, 0.5);
  synth.speak(utt);
}

export function cancel() {
  if (synth) synth.cancel();
}

export function describePoint(sample, theme) {
  if (!sample) return;
  const terrain = sample.isLand ? 'Land' : 'Ocean';
  const valStr = sample.value !== null
    ? `${sample.value.toFixed(1)} ${theme.units}`
    : 'No data';
  const above = sample.value !== null && sample.value > theme.anomalyThreshold ? 'Above normal.' : '';
  speak(`${sample.region}. ${terrain}. ${valStr}. ${above}`, true);
}

export function describeFrame(theme, frameIndex, samples) {
  const frame = theme.frames[frameIndex];
  if (!frame) return;
  speak(`${theme.title}. Year ${frame.label}. Global value ${frame.value.toFixed(2)} ${theme.units}.`, true);
}

export function announceGuideHelp() {
  speak('Guide mode. Use arrow keys to move 5 degrees. Shift arrow for 1 degree. N for next beacon. Space to hear current point. Enter to describe. Y for next year. H for this help. Three-finger tap or Escape to exit screen-off mode.', true);
}
