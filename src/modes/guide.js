/**
 * Guide mode: beacon navigation for screen-off use
 */
import * as Tone from 'tone';
import { sample, findAnomalyBeacons } from '../data/sampler.js';
import { getInstruments, playBeaconPulse, playFanfare } from '../audio/instruments.js';
import { haptic } from '../audio/haptics.js';
import { describePoint, announceGuideHelp, speak } from '../audio/speech.js';
import { buildScale, quantizeToScale } from '../audio/scales.js';

let canvas;
let currentTheme = null;
let currentFrameIndex = 0;
let beacons = [];
let currentBeaconIdx = 0;
let cursorLon = 0, cursorLat = 0;
let beaconInterval = null;
let wakeLock = null;
let screenOff = false;
let scaleNotes = [];
let frameCanvas = null;

export function initGuide(canvasEl, theme, frameIndex, fc) {
  canvas = canvasEl;
  updateGuide(theme, frameIndex, fc);
  bindEvents();

  // Announce controls
  setTimeout(announceGuideHelp, 500);
}

export function updateGuide(theme, frameIndex, fc) {
  currentTheme = theme;
  currentFrameIndex = frameIndex;
  frameCanvas = fc;
  if (theme) {
    scaleNotes = buildScale(theme.key || 'C', theme.scale || 'majorPentatonic', 2, 3);
  }
  refreshBeacons();
  drawGuideFrame();
}

function drawGuideFrame() {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.clientWidth || canvas.width;
  const h = canvas.clientHeight || canvas.height;
  canvas.width = w; canvas.height = h;
  if (frameCanvas) {
    ctx.drawImage(frameCanvas, 0, 0, w, h);
  }
  drawCursor();
  drawBeacons();
}

function drawCursor() {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const x = ((cursorLon + 180) / 360) * w;
  const y = ((90 - cursorLat) / 180) * h;

  const cursor = document.getElementById('guide-cursor');
  if (cursor) {
    cursor.style.display = 'block';
    cursor.style.left = x + 'px';
    cursor.style.top = y + 'px';
  }
}

function drawBeacons() {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  beacons.forEach((b, i) => {
    const x = ((b.lon + 180) / 360) * w;
    const y = ((90 - b.lat) / 180) * h;
    ctx.beginPath();
    ctx.arc(x, y, i === currentBeaconIdx ? 12 : 8, 0, Math.PI * 2);
    ctx.strokeStyle = i === currentBeaconIdx ? '#ff6b35' : '#00b4d8';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,107,53,0.2)';
    ctx.fill();
  });
}

function refreshBeacons() {
  if (!currentTheme) return;
  beacons = findAnomalyBeacons(currentTheme, 5);
  currentBeaconIdx = 0;
  restartBeaconPulse();
}

function restartBeaconPulse() {
  clearInterval(beaconInterval);
  if (beacons.length === 0) return;

  function pulse() {
    const beacon = beacons[currentBeaconIdx];
    if (!beacon) return;

    const dist = Math.sqrt((cursorLon - beacon.lon) ** 2 + (cursorLat - beacon.lat) ** 2);
    const maxDist = 180;
    const proximity = 1 - Math.min(1, dist / maxDist);

    // Interval: 1s far, 0.15s near
    const interval = 1000 - proximity * 850;

    // Pan based on bearing
    const dLon = beacon.lon - cursorLon;
    const pan = Math.max(-1, Math.min(1, dLon / 90));

    // Pitch based on latitude
    const dLat = beacon.lat - cursorLat;
    const freqMult = 1 + dLat / 90 * 0.5;
    playBeaconPulse(pan, 880 * freqMult);
    haptic('beaconNear');

    // Found?
    if (dist < 5) {
      clearInterval(beaconInterval);
      haptic('beaconFound');
      playFanfare();
      speak('Anomaly found!', true);
    }

    beaconInterval = setTimeout(pulse, interval);
  }
  pulse();
}

function bindEvents() {
  if (!canvas) return;
  canvas.addEventListener('keydown', onKeyDown);
  canvas.setAttribute('tabindex', '0');

  // Screen-off: three-finger tap or Esc
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && screenOff) setScreenOff(false);
  });

  // Three-finger tap
  let touchCount = 0;
  document.addEventListener('touchstart', e => { touchCount = e.touches.length; }, { passive: true });
  document.addEventListener('touchend', e => {
    if (touchCount >= 3 && screenOff) setScreenOff(false);
    touchCount = 0;
  }, { passive: true });
}

function onKeyDown(e) {
  const step = e.shiftKey ? 1 : 5;
  switch (e.key) {
    case 'ArrowRight': cursorLon = Math.min(180, cursorLon + step); break;
    case 'ArrowLeft':  cursorLon = Math.max(-180, cursorLon - step); break;
    case 'ArrowUp':    cursorLat = Math.min(90, cursorLat + step); break;
    case 'ArrowDown':  cursorLat = Math.max(-90, cursorLat - step); break;
    case 'n': case 'N': nextBeacon(); return;
    case ' ': playCurrent(); e.preventDefault(); return;
    case 'Enter': describeCurrent(); return;
    case 'y': case 'Y': window.__ej?.nextYear?.(); return;
    case 'h': case 'H': announceGuideHelp(); return;
    default: return;
  }
  drawGuideFrame();
  playCurrent();
  e.preventDefault();
}

function nextBeacon() {
  if (beacons.length === 0) return;
  currentBeaconIdx = (currentBeaconIdx + 1) % beacons.length;
  const b = beacons[currentBeaconIdx];
  speak(`Beacon at ${b.lat.toFixed(0)} degrees north, ${b.lon.toFixed(0)} degrees east.`);
  restartBeaconPulse();
}

function playCurrent() {
  if (!canvas) return;
  const w = canvas.width, h = canvas.height;
  const x = ((cursorLon + 180) / 360) * w;
  const y = ((90 - cursorLat) / 180) * h;
  const s = sample(x, y, w, h);

  if (!s || !currentTheme) return;
  const instruments = getInstruments();
  if (!instruments) return;

  const note = quantizeToScale(s.brightness, scaleNotes);
  if (s.isLand) {
    instruments.land.triggerAttackRelease(note, '8n');
  } else {
    instruments.ocean.triggerAttackRelease(note, '4n');
  }
}

function describeCurrent() {
  if (!canvas || !currentTheme) return;
  const w = canvas.width, h = canvas.height;
  const x = ((cursorLon + 180) / 360) * w;
  const y = ((90 - cursorLat) / 180) * h;
  const s = sample(x, y, w, h);
  if (s) describePoint(s, currentTheme);
}

export async function setScreenOff(on) {
  screenOff = on;
  const overlay = document.getElementById('guide-screen-off-overlay');
  if (overlay) overlay.hidden = !on;

  if (on) {
    // Wake lock
    if ('wakeLock' in navigator) {
      try { wakeLock = await navigator.wakeLock.request('screen'); } catch {}
    }
    speak('Screen off. Touch or use arrow keys to navigate. Three-finger tap to exit.', true);
  } else {
    if (wakeLock) { try { await wakeLock.release(); } catch {} wakeLock = null; }
    haptic('uiConfirm');
    speak('Screen on.', true);
  }
}

export function destroyGuide() {
  clearTimeout(beaconInterval);
  if (wakeLock) { try { wakeLock.release(); } catch {} }
}
