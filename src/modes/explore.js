/**
 * Explore mode: interactive map with continuous sonification
 */
import * as Tone from 'tone';
import { sample } from '../data/sampler.js';
import { getInstruments, playCoast, playEdgeBump } from '../audio/instruments.js';
import { buildScale, quantizeToScale } from '../audio/scales.js';
import { haptic } from '../audio/haptics.js';
import { describePoint } from '../audio/speech.js';
import { MAPPING } from '../audio/mapping.js';

let canvas, ctx;
let frameCanvas = null;
let currentTheme = null;
let currentFrameIndex = 0;
let scaleNotes = [];
let isLandPrev = null;
let cursorX = 0, cursorY = 0;
let isTouching = false;
let rafId = null;

// Double-tap detection
let lastTapTime = 0, lastTapX = 0, lastTapY = 0;
let longPressTimer = null;

// Sound state
let oceanNoteActive = false;
let lastNoteTime = 0;
let soundDecayTimer = null;

export function initExplore(canvasEl, theme, frameIndex, frameCanvasEl) {
  canvas = canvasEl;
  currentTheme = theme;
  currentFrameIndex = frameIndex;
  frameCanvas = frameCanvasEl;
  ctx = canvas.getContext('2d');

  if (theme) {
    scaleNotes = buildScale(theme.key || 'C', theme.scale || 'majorPentatonic', 2, 3);
  }

  drawFrame();
  bindEvents();
}

export function updateFrame(theme, frameIndex, frameCanvasEl) {
  currentTheme = theme;
  currentFrameIndex = frameIndex;
  frameCanvas = frameCanvasEl;
  if (theme) scaleNotes = buildScale(theme.key || 'C', theme.scale || 'majorPentatonic', 2, 3);
  drawFrame();
}

function drawFrame() {
  if (!canvas || !ctx) return;
  const w = canvas.clientWidth || canvas.width;
  const h = canvas.clientHeight || canvas.height;
  canvas.width = w; canvas.height = h;

  if (frameCanvas) {
    ctx.drawImage(frameCanvas, 0, 0, w, h);
  } else {
    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(0, 0, w, h);
  }
}

function bindEvents() {
  canvas.addEventListener('pointermove', onPointerMove, { passive: true });
  canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
  canvas.addEventListener('pointerup', onPointerUp, { passive: true });
  canvas.addEventListener('pointerleave', onPointerLeave, { passive: true });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('keydown', onKeyDown);
}

function onPointerMove(e) {
  const rect = canvas.getBoundingClientRect();
  cursorX = e.clientX - rect.left;
  cursorY = e.clientY - rect.top;
  updateCursor();

  if (isTouching || e.pointerType === 'mouse') {
    scheduleSound();
  }

  // Clear long press on move
  if (longPressTimer && Math.abs(e.movementX) + Math.abs(e.movementY) > 5) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

function onPointerDown(e) {
  isTouching = true;
  const rect = canvas.getBoundingClientRect();
  cursorX = e.clientX - rect.left;
  cursorY = e.clientY - rect.top;
  updateCursor();

  // Long press detection
  longPressTimer = setTimeout(() => {
    compareFirstLast();
    longPressTimer = null;
  }, 600);
}

function onPointerUp(e) {
  isTouching = false;
  clearTimeout(longPressTimer);
  longPressTimer = null;

  // Double-tap detection
  const now = Date.now();
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left, y = e.clientY - rect.top;
  if (now - lastTapTime < 300 && Math.abs(x - lastTapX) < 30 && Math.abs(y - lastTapY) < 30) {
    onDoubleTap(x, y);
    lastTapTime = 0;
  } else {
    lastTapTime = now; lastTapX = x; lastTapY = y;
  }

  // Start sound decay
  startSoundDecay();
}

function onPointerLeave() {
  isTouching = false;
  startSoundDecay();
}

function onDoubleTap(x, y) {
  const s = sample(x, y, canvas.width, canvas.height);
  if (s && currentTheme) {
    describePoint(s, currentTheme);
    updateStatusBar(s);
  }
}

function compareFirstLast() {
  if (!currentTheme || currentTheme.frames.length < 2) return;
  const { speech } = window.__ej || {};
  const f0 = currentTheme.frames[0];
  const fN = currentTheme.frames[currentTheme.frames.length - 1];
  if (speech) {
    speech.speak(`${f0.label}: ${f0.value.toFixed(2)}. ${fN.label}: ${fN.value.toFixed(2)} ${currentTheme.units}.`, true);
  }
}

function scheduleSound() {
  if (!rafId) rafId = requestAnimationFrame(playCurrentPoint);
}

function playCurrentPoint() {
  rafId = null;
  if (!currentTheme || !frameCanvas) return;

  const s = sample(cursorX, cursorY, canvas.width, canvas.height);
  if (!s) return;

  const instruments = getInstruments();
  if (!instruments) return;

  const { ocean, land, fire, anomaly } = instruments;
  const now = Tone.now();

  // Coast detection
  if (isLandPrev !== null && s.isLand !== isLandPrev) {
    playCoast();
    haptic('coast');
  }

  // Edge of map
  if (cursorX <= 0 || cursorX >= canvas.width - 1 || cursorY <= 0 || cursorY >= canvas.height - 1) {
    playEdgeBump();
    haptic('edge');
  }

  if (s.isLand) {
    haptic('landTexture');
    // Land: pluck note from scale
    const timeNow = Date.now();
    if (timeNow - lastNoteTime > 1000 / MAPPING.land.maxNotesPerSec) {
      const note = quantizeToScale(s.value !== null ? (s.value - (currentTheme.legend[0]?.value || 0)) / 60 : s.brightness, scaleNotes);
      land.triggerAttackRelease(note, '16n', now);
      lastNoteTime = timeNow;
    }

    // Fire crackle if theme supports it and bright pixels
    if (currentTheme.id === 'wildfires' && s.brightness > 0.4) {
      fire.triggerAttackRelease('16n', now);
    }
  } else {
    // Ocean FM pad
    const filterFreq = MAPPING.ocean.latToFilter(s.lat);
    ocean.filterEnvelope?.baseFrequency && (ocean.filterEnvelope.baseFrequency = filterFreq);
    const note = s.lat > 0 ? 'C2' : 'G2';
    if (!oceanNoteActive) {
      ocean.triggerAttack(note, now);
      oceanNoteActive = true;
    }
  }

  // Anomaly
  if (s.isAnomalous) {
    haptic('anomaly');
    // Play quiet tritone
    const baseFreq = 220;
    anomaly.triggerAttackRelease(baseFreq * Math.pow(2, 6 / 12), '4n', now);
  }

  isLandPrev = s.isLand;
  updateTooltip(s);
  updateStatusBar(s);
}

function startSoundDecay() {
  clearTimeout(soundDecayTimer);
  soundDecayTimer = setTimeout(() => {
    const instruments = getInstruments();
    if (instruments && oceanNoteActive) {
      instruments.ocean.triggerRelease();
      oceanNoteActive = false;
    }
  }, 2000);
}

function updateCursor() {
  const cursor = document.getElementById('explore-cursor');
  if (!cursor) return;
  cursor.style.display = 'block';
  cursor.style.left = cursorX + 'px';
  cursor.style.top = cursorY + 'px';

  const s = sample(cursorX, cursorY, canvas.width, canvas.height);
  cursor.classList.toggle('anomaly', !!(s && s.isAnomalous));
}

function updateTooltip(s) {
  const tip = document.getElementById('explore-tooltip');
  if (!tip || !s || !currentTheme) return;
  tip.style.display = 'block';
  const valStr = s.value !== null ? `${s.value.toFixed(1)} ${currentTheme.units}` : 'No data';
  tip.innerHTML = `<strong>${s.region}</strong><br>${s.isLand ? 'Land' : 'Ocean'} · ${valStr}`;
  // Position near cursor
  const left = Math.min(cursorX + 20, canvas.width - 160);
  const top = Math.max(cursorY - 60, 10);
  tip.style.left = left + 'px';
  tip.style.top = top + 'px';
}

function updateStatusBar(s) {
  const bar = document.getElementById('explore-status');
  const liveReg = document.getElementById('aria-live-region');
  if (!s || !currentTheme) return;
  const valStr = s.value !== null ? `${s.value.toFixed(1)} ${currentTheme.units}` : 'No data';
  const text = `${s.region} · ${s.isLand ? 'Land' : 'Ocean'} · ${valStr} · ${s.lat.toFixed(1)}°N ${s.lon.toFixed(1)}°E`;
  if (bar) bar.textContent = text;
  if (liveReg) liveReg.textContent = text;
}

function onKeyDown(e) {
  const step = e.shiftKey ? 1 : 5;
  const rect = canvas.getBoundingClientRect();
  const pxPerDeg = canvas.width / 360;

  switch (e.key) {
    case 'ArrowRight': cursorX = Math.min(canvas.width - 1, cursorX + step * pxPerDeg); break;
    case 'ArrowLeft':  cursorX = Math.max(0, cursorX - step * pxPerDeg); break;
    case 'ArrowUp':    cursorY = Math.max(0, cursorY - step * (canvas.height / 180)); break;
    case 'ArrowDown':  cursorY = Math.min(canvas.height - 1, cursorY + step * (canvas.height / 180)); break;
    case ' ':          scheduleSound(); e.preventDefault(); break;
    case 'Enter': {
      const s = sample(cursorX, cursorY, canvas.width, canvas.height);
      if (s && currentTheme) describePoint(s, currentTheme);
      break;
    }
    default: return;
  }
  updateCursor();
  scheduleSound();
  e.preventDefault();
}

export function destroyExplore() {
  if (rafId) cancelAnimationFrame(rafId);
  clearTimeout(soundDecayTimer);
  clearTimeout(longPressTimer);
}
