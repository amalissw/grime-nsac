/**
 * Jukebox mode: auto-scanning playback
 */
import * as Tone from 'tone';
import { getFrameCanvas } from '../data/loader.js';
import { setCurrent, sample, colorToValue } from '../data/sampler.js';
import { getInstruments, playYearTick } from '../audio/instruments.js';
import { buildScale, quantizeToScale, getChordNotes } from '../audio/scales.js';
import { haptic } from '../audio/haptics.js';
import { getMasterChain } from '../audio/engine.js';

let currentTheme = null;
let frames = [];
let currentFrame = 0;
let isPlaying = false;
let speed = 1;
let scanX = 0;
let scanLoop = null;
let chordSchedule = null;
let frameCanvas = null;
let scaleNotes = [];

// Canvas references
let mapCanvas, scanCanvas;
let mapCtx, scanCtx;

export async function initJukebox(mapCanvasEl, scanCanvasEl) {
  mapCanvas = mapCanvasEl;
  scanCanvas = scanCanvasEl;
  mapCtx = mapCanvas.getContext('2d');
  scanCtx = scanCanvas.getContext('2d');
}

export async function loadTheme(theme) {
  currentTheme = theme;
  frames = theme.frames;
  currentFrame = 0;
  scaleNotes = buildScale(theme.key || 'C', theme.scale || 'majorPentatonic', 2, 3);

  await loadFrame(0);
  updateYearLabels();
}

export async function loadFrame(idx) {
  currentFrame = idx;
  const theme = currentTheme;
  if (!theme) return;

  const w = mapCanvas ? mapCanvas.clientWidth || mapCanvas.width : 512;
  const h = mapCanvas ? mapCanvas.clientHeight || mapCanvas.height : 256;
  frameCanvas = await getFrameCanvas(theme, idx, w, h);
  if (!frameCanvas) return;

  setCurrent(frameCanvas, null, theme);
  drawMap();
  updateStatus();
  updateYearSlider();
  playYearTick();
  haptic('yearTick');

  // Chord based on frame value
  scheduleChord();
}

function drawMap() {
  if (!mapCtx || !frameCanvas) return;
  const w = mapCanvas.clientWidth || mapCanvas.width;
  const h = mapCanvas.clientHeight || mapCanvas.height;
  mapCanvas.width = w; mapCanvas.height = h;
  mapCtx.drawImage(frameCanvas, 0, 0, w, h);
}

function drawScanner() {
  if (!scanCtx || !mapCanvas) return;
  const w = mapCanvas.width, h = mapCanvas.height;
  scanCanvas.width = w; scanCanvas.height = h;
  scanCtx.clearRect(0, 0, w, h);
  scanCtx.strokeStyle = 'rgba(0, 220, 255, 0.85)';
  scanCtx.lineWidth = 2;
  scanCtx.setLineDash([6, 4]);
  scanCtx.beginPath();
  scanCtx.moveTo(scanX, 0);
  scanCtx.lineTo(scanX, h);
  scanCtx.stroke();
  scanCtx.setLineDash([]);
}

export function play() {
  if (isPlaying || !currentTheme) return;
  isPlaying = true;
  scanX = 0;
  startScanLoop();
  startTransport();
}

export function pause() {
  isPlaying = false;
  stopScanLoop();
  stopTransport();
}

export function setSpeed(s) {
  speed = s;
  if (isPlaying) { stopScanLoop(); startScanLoop(); }
}

export function setFrame(idx) {
  if (!currentTheme) return;
  loadFrame(Math.max(0, Math.min(currentTheme.frames.length - 1, idx)));
}

export function prevFrame() { setFrame(currentFrame - 1); }
export function nextFrame() { setFrame(currentFrame + 1); }

function startScanLoop() {
  const fps = 60;
  const scanDur = (4 / speed) * 1000; // ms per frame
  const pxPerMs = (mapCanvas ? mapCanvas.width : 512) / scanDur;

  let lastTime = performance.now();
  function step(now) {
    if (!isPlaying) return;
    const dt = now - lastTime; lastTime = now;
    scanX += pxPerMs * dt;
    const w = mapCanvas ? mapCanvas.width : 512;
    if (scanX >= w) {
      scanX = 0;
      // Auto-advance frame
      const next = (currentFrame + 1) % frames.length;
      loadFrame(next);
    }
    drawScanner();
    soundScanLine();
    scanLoop = requestAnimationFrame(step);
  }
  scanLoop = requestAnimationFrame(step);
}

function stopScanLoop() {
  if (scanLoop) cancelAnimationFrame(scanLoop);
  scanLoop = null;
}

function soundScanLine() {
  if (!currentTheme || !frameCanvas || !mapCanvas) return;
  const instruments = getInstruments();
  if (!instruments) return;

  const h = mapCanvas.height;
  const nPoints = 8;
  const { land, ocean } = instruments;
  const now = Tone.now();

  // Sample 8 points along the scan line
  for (let i = 0; i < nPoints; i++) {
    const y = Math.round((i + 0.5) * h / nPoints);
    const s = sample(scanX, y, mapCanvas.width, h);
    if (!s) continue;

    const idx = Math.round((i / nPoints) * (scaleNotes.length - 1));
    const note = scaleNotes[idx] || scaleNotes[0];

    if (s.isLand) {
      land.triggerAttackRelease(note, '32n', now + i * 0.015);
    }
  }
}

function startTransport() {
  Tone.getTransport().bpm.value = 90 * speed;
  Tone.getTransport().start();
}

function stopTransport() {
  Tone.getTransport().stop();
}

function scheduleChord() {
  if (!currentTheme) return;
  const instruments = getInstruments();
  if (!instruments) return;

  const frame = currentTheme.frames[currentFrame];
  if (!frame) return;

  // Normalize frame value
  const minVal = currentTheme.frames.reduce((m, f) => Math.min(m, f.value), Infinity);
  const maxVal = currentTheme.frames.reduce((m, f) => Math.max(m, f.value), -Infinity);
  const t = maxVal > minVal ? (frame.value - minVal) / (maxVal - minVal) : 0;

  const notes = getChordNotes(t, currentTheme.key || 'C', currentTheme.scale || 'majorPentatonic');
  const { chord } = instruments;
  chord.releaseAll();
  chord.triggerAttack(notes, Tone.now() + 0.1);
}

function updateYearLabels() {
  if (!currentTheme) return;
  const container = document.getElementById('year-labels');
  if (!container) return;
  container.innerHTML = currentTheme.frames.map(f => `<span>${f.label}</span>`).join('');
  const slider = document.getElementById('year-slider');
  if (slider) {
    slider.max = currentTheme.frames.length - 1;
    slider.value = 0;
  }
}

function updateYearSlider() {
  const slider = document.getElementById('year-slider');
  if (slider) slider.value = currentFrame;
}

function updateStatus() {
  const bar = document.getElementById('jukebox-status');
  const liveReg = document.getElementById('aria-live-region');
  if (!currentTheme) return;
  const frame = currentTheme.frames[currentFrame];
  if (!frame) return;
  const text = `${frame.label} · ${currentTheme.frameValueLabel}: ${frame.value.toFixed(2)} ${currentTheme.units}`;
  if (bar) bar.textContent = text;
  if (liveReg) liveReg.textContent = text;
}

export function compareFirstLast() {
  if (!currentTheme || currentTheme.frames.length < 2) return;
  const f0 = currentTheme.frames[0];
  const fN = currentTheme.frames[currentTheme.frames.length - 1];
  // Load first frame, play, then last
  setFrame(0);
  setTimeout(() => setFrame(currentTheme.frames.length - 1), 2000);
}

export function getCurrentFrame() { return currentFrame; }
export function isCurrentlyPlaying() { return isPlaying; }
