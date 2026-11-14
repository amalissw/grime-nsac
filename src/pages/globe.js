/**
 * Globe page — three-globe + TrackballControls + data layers.
 * Spec §17 Stage 2 & 4.
 */
import Globe from 'three-globe';
import * as THREE from 'three';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import { state, setState, subscribe } from '../state.js';
import { config } from '../config.js';
import { getPointData, getWorldData, listEvents } from '../data/query.js';
import { playEarcon } from '../audio/instruments.js';
import { vibrate } from '../audio/haptics.js';
import { say } from '../audio/speech.js';
import { showToast } from '../ui/shell.js';
import { DANGER_COLORS } from '../config.js';
import { startListening } from '../audio/listen.js';

// ── Danger color CSS vars ────────────────────────────────────────────────────
const DANGER_CSS = ['#22C55E', '#A3E635', '#FACC15', '#F97316', '#DC2626'];

// ── Layer color scales (d3-scale-chromatic) ──────────────────────────────────
// Using simple manual interpolation to avoid d3 import issues
function tempColor(anomaly) {
  // -2°C = deep blue, 0 = white, 4°C = deep red
  const t = Math.max(0, Math.min(1, (anomaly + 2) / 6));
  if (t < 0.5) {
    const f = t * 2;
    return `rgb(${Math.round(50 + 200 * f)},${Math.round(100 + 155 * f)},${Math.round(255 - 50 * f)})`;
  } else {
    const f = (t - 0.5) * 2;
    return `rgb(${Math.round(250)},${Math.round(255 - 200 * f)},${Math.round(205 - 200 * f)})`;
  }
}

function co2Alpha(ppm) {
  return Math.min(1, Math.max(0, (ppm - config.co2Clear) / (config.co2Hazy - config.co2Clear)));
}

// ── State ────────────────────────────────────────────────────────────────────
let _globe = null;
let _renderer = null;
let _camera = null;
let _scene = null;
let _controls = null;
let _animId = null;
let _data = null;
let _currentLayer = 'temperature';
let _currentYear = config.defaultYear;
let _eventMarkers = [];

// ── Init ──────────────────────────────────────────────────────────────────────
export function initGlobe() {
  const canvas = document.getElementById('globe-canvas');
  if (!canvas || _globe) return;

  const wrap = document.getElementById('globe-wrap');
  const W = wrap.clientWidth || 600;
  const H = wrap.clientHeight || 600;

  // Three.js setup
  _renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  _renderer.setSize(W, H);
  _renderer.setClearColor(0x000000, 0);

  _scene = new THREE.Scene();

  _camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 1000);
  _camera.position.z = 300;

  // Lighting
  _scene.add(new THREE.AmbientLight(0xffffff, config.ambientIntensity));
  const sun = new THREE.DirectionalLight(0xffffff, config.directionalIntensity);
  sun.position.set(100, 100, 100);
  _scene.add(sun);

  // TrackballControls
  _controls = new TrackballControls(_camera, canvas);
  _controls.rotateSpeed = config.rotateSpeed;
  _controls.dynamicDampingFactor = config.dynamicDampingFactor;
  _controls.minDistance = config.cameraDistMin * 100;
  _controls.maxDistance = config.cameraDistMax * 100;
  _controls.noZoom = false;
  _controls.noPan = true;

  // three-globe
  _globe = new Globe({ animateIn: false })
    .globeImageUrl('//unpkg.com/three-globe/example/img/earth-day.jpg')
    .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
    .atmosphereColor('rgba(100,160,255,0.15)')
    .atmosphereAltitude(config.atmosphereAltitude)
    .pointsData([])
    .pointLat('lat')
    .pointLng('lon')
    .pointColor('color')
    .pointAltitude('altitude')
    .pointRadius('radius')
    .pointResolution(8);

  _scene.add(_globe);

  // Auto-rotate
  let autoRotating = true;
  let autoRotateTimer = null;

  function pauseAutoRotate() {
    autoRotating = false;
    clearTimeout(autoRotateTimer);
    autoRotateTimer = setTimeout(() => { autoRotating = true; }, config.autoRotateResumeMs);
  }
  canvas.addEventListener('pointerdown', pauseAutoRotate);

  // Click handler — tap to hear data
  canvas.addEventListener('click', onGlobeClick);

  // Keyboard navigation
  canvas.addEventListener('keydown', onGlobeKey);

  // Listen to state
  subscribe('layer', layer => { _currentLayer = layer; updateLayer(); updateEventList(); });
  subscribe('year', year => {
    _currentYear = year;
    updateLayer();
    updateEventList();
    // Update sound if currently listening
    import('../audio/listen.js').then(m => m.onYearChange(year)).catch(() => {});
  });
  subscribe('selection', sel => { if (sel) flyTo(sel.lat, sel.lon); });

  // Listen for data ready
  window.addEventListener('ej:data-ready', e => {
    _data = e.detail;
    updateLayer();
    updateEventList();
  });

  // Pinch-to-zoom on mobile
  let _pinchDist = null;
  wrap.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      _pinchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  }, { passive: true });
  wrap.addEventListener('touchmove', e => {
    if (e.touches.length === 2 && _pinchDist !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = dist / _pinchDist;
      const z = _camera.position.z / scale;
      _camera.position.z = Math.max(_controls.minDistance, Math.min(_controls.maxDistance, z));
      _pinchDist = dist;
    }
  }, { passive: true });
  wrap.addEventListener('touchend', () => { _pinchDist = null; }, { passive: true });

  // Resize
  const ro = new ResizeObserver(() => {
    if (!wrap) return;
    const W2 = wrap.clientWidth, H2 = wrap.clientHeight;
    _renderer.setSize(W2, H2);
    _camera.aspect = W2 / H2;
    _camera.updateProjectionMatrix();
    _controls.handleResize();
  });
  ro.observe(wrap);

  // Render loop
  function animate() {
    _animId = requestAnimationFrame(animate);
    _controls.update();
    if (autoRotating) _globe.rotation.y += config.autoRotateSpeed * 0.01;
    _renderer.render(_scene, _camera);
  }
  animate();
}

export function destroyGlobe() {
  if (_animId) cancelAnimationFrame(_animId);
  if (_controls) _controls.dispose();
  if (_renderer) _renderer.dispose();
  _globe = null;
}

// ── Layer rendering ───────────────────────────────────────────────────────────
function updateLayer() {
  if (!_globe) return;
  _currentLayer = state.layer;
  _currentYear = state.year;

  switch (_currentLayer) {
    case 'temperature': renderTempLayer(); break;
    case 'co2': renderCo2Layer(); break;
    case 'wildfires': renderEventLayer('wildfires'); break;
    case 'storms': renderEventLayer('storms'); break;
    case 'earthquakes': renderEventLayer('earthquakes'); break;
    case 'volcanoes': renderEventLayer('volcanoes'); break;
    default: _globe.pointsData([]);
  }

  updateEventList();
}

function renderTempLayer() {
  if (!_data?.temperature) {
    _globe.pointsData([]);
    return;
  }
  const cells = _data.temperature.cells?.[String(_currentYear)];
  const lats = _data.temperature.lat;
  const lons = _data.temperature.lon;
  if (!cells || !lats || !lons) { _globe.pointsData([]); return; }

  const pts = [];
  for (let li = 0; li < lats.length; li++) {
    for (let lo = 0; lo < lons.length; lo++) {
      const v = cells[li * lons.length + lo];
      if (v === null || v === undefined) continue;
      const alt = v > 1.0 ? (v - 0.8) * config.tempColumnScale : 0;
      pts.push({ lat: lats[li], lon: lons[lo], color: tempColor(v), altitude: alt, radius: 1.8 });
    }
  }
  _globe
    .pointColor('color')
    .pointAltitude('altitude')
    .pointRadius('radius')
    .pointsData(pts);
}

function renderCo2Layer() {
  if (!_data?.co2) { _globe.pointsData([]); return; }
  const idx = _data.co2.years?.indexOf(_currentYear);
  const ppm = idx >= 0 ? _data.co2.ppm[idx] : 400;
  const alpha = co2Alpha(ppm);
  const color = `rgba(180,220,255,${alpha.toFixed(2)})`;
  // Show as atmosphere tint — no per-point data, update globe atmosphere
  _globe.atmosphereColor(color).atmosphereAltitude(config.co2AltMin + alpha * (config.co2AltMax - config.co2AltMin));
  _globe.pointsData([]);
}

function renderEventLayer(type) {
  if (!_data) { _globe.pointsData([]); return; }
  const events = listEvents(type, _currentYear, 100);
  const pts = events.map(e => ({
    lat: e.lat, lon: e.lon,
    color: DANGER_CSS[Math.min(4, (e.level || 1) - 1)],
    altitude: 0.02 + (e.level || 1) * 0.01,
    radius: 1.5 + (e.level || 1) * 0.5,
  }));
  _globe
    .pointColor('color')
    .pointAltitude('altitude')
    .pointRadius('radius')
    .pointsData(pts);
}

// ── Interaction ───────────────────────────────────────────────────────────────
function onGlobeClick(evt) {
  if (!_globe) return;

  // Convert click to globe coordinates
  const canvas = document.getElementById('globe-canvas');
  const rect = canvas.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((evt.clientX - rect.left) / rect.width) * 2 - 1,
    -((evt.clientY - rect.top) / rect.height) * 2 + 1
  );

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, _camera);

  const sphere = new THREE.Sphere(new THREE.Vector3(), 100);
  const target = new THREE.Vector3();
  raycaster.ray.intersectSphere(sphere, target);
  if (!target.length()) return;

  // Convert 3D point to lat/lon
  const { lat, lng } = cartToLatLng(target);
  handleGlobeTap(lat, lng);
}

function cartToLatLng(v) {
  const lat = Math.asin(v.y / v.length()) * 180 / Math.PI;
  const lng = Math.atan2(v.x, v.z) * 180 / Math.PI;
  return { lat, lng };
}

function handleGlobeTap(lat, lon) {
  const layer = state.layer;
  const year = state.year;
  const pt = getPointData(lat, lon, layer, year);

  // Update point card
  updatePointCard(pt, lat, lon);

  // Play sound
  vibrate('select');
  playEarcon('select');
  startListening(lat, lon, state.layer, state.year);

  // Speak
  const msg = buildPointMsg(pt);
  say(msg);
}

function buildPointMsg(pt) {
  const lang = state.settings.language;
  if (lang === 'ru') {
    return `${pt.place}. ${layerNameRu(pt.layer)}: ${fmt(pt.value)} ${pt.units}. Уровень опасности ${pt.level}.`;
  } else if (lang === 'kk') {
    return `${pt.place}. ${layerNameKk(pt.layer)}: ${fmt(pt.value)} ${pt.units}. Қауіп деңгейі ${pt.level}.`;
  }
  return `${pt.place}. ${layerNameEn(pt.layer)}: ${fmt(pt.value)} ${pt.units}. Danger level ${pt.level}.`;
}

function layerNameEn(l) {
  return { temperature: 'Temperature', co2: 'CO₂', wildfires: 'Wildfires', storms: 'Storms', earthquakes: 'Earthquakes', volcanoes: 'Volcanoes' }[l] || l;
}
function layerNameRu(l) {
  return { temperature: 'Температура', co2: 'CO₂', wildfires: 'Пожары', storms: 'Штормы', earthquakes: 'Землетрясения', volcanoes: 'Вулканы' }[l] || l;
}
function layerNameKk(l) {
  return { temperature: 'Температура', co2: 'CO₂', wildfires: 'Өрттер', storms: 'Дауылдар', earthquakes: 'Жер сілкінісі', volcanoes: 'Жанартаулар' }[l] || l;
}
function fmt(v) { return v === null || v === undefined ? '—' : typeof v === 'number' ? v.toFixed(1) : v; }

function updatePointCard(pt, lat, lon) {
  const card = document.getElementById('point-card');
  const placeEl = document.getElementById('point-place');
  const valEl = document.getElementById('point-value');
  const levelEl = document.getElementById('point-level');

  if (!card) return;
  if (placeEl) placeEl.textContent = pt.place || `${lat.toFixed(1)}°, ${lon.toFixed(1)}°`;
  if (valEl) valEl.textContent = pt.value !== null ? `${fmt(pt.value)} ${pt.units}` : '—';
  if (levelEl) {
    levelEl.textContent = `Level ${pt.level}`;
    levelEl.style.color = DANGER_CSS[Math.min(4, pt.level - 1)];
  }

  const speakBtn = document.getElementById('point-speak-btn');
  if (speakBtn) {
    speakBtn.onclick = () => say(buildPointMsg(pt));
  }

  card.hidden = false;
}

function onGlobeKey(evt) {
  const step = evt.shiftKey ? 1 : 5;
  let { lat, lng } = _globe.pointOfView() || { lat: 0, lng: 0 };
  switch (evt.key) {
    case 'ArrowUp':    lat = Math.min(90, lat + step); break;
    case 'ArrowDown':  lat = Math.max(-90, lat - step); break;
    case 'ArrowLeft':  lng -= step; break;
    case 'ArrowRight': lng += step; break;
    case 'Enter': case ' ':
      handleGlobeTap(lat, lng);
      return;
    default: return;
  }
  _globe.pointOfView({ lat, lng, altitude: _globe.pointOfView().altitude }, 200);
  evt.preventDefault();
}

export function flyTo(lat, lon, altitude = 1.5) {
  if (!_globe) return;
  _globe.pointOfView({ lat, lng: lon, altitude }, config.flyToMs);
}

// ── Event list ────────────────────────────────────────────────────────────────
function updateEventList() {
  const container = document.getElementById('event-list');
  if (!container) return;

  const seg = state.segment;
  const layer = state.layer;
  const year = state.year;

  // Only for disaster layers
  if (seg !== 'disasters') {
    // For climate, show world summary
    const wd = getWorldData(layer, year);
    container.innerHTML = '';
    if (wd.value !== null) {
      const item = document.createElement('div');
      item.className = 'event-item glass-panel';
      item.innerHTML = `
        <span class="event-icon" aria-hidden="true">${layer === 'temperature' ? '🌡️' : '💨'}</span>
        <div class="event-body">
          <div class="event-name">Global ${layer === 'temperature' ? 'mean anomaly' : 'CO₂'}</div>
          <div class="event-val">${fmt(wd.value)} ${wd.units}</div>
        </div>
        <div class="event-level" style="background:${DANGER_CSS[wd.level - 1]}">${wd.level}</div>`;
      container.appendChild(item);
    }
    return;
  }

  const events = listEvents(layer === 'earthquakes' ? 'earthquakes' : 'allDisasters', year, 15);
  container.innerHTML = '';
  events.forEach(ev => {
    const item = document.createElement('div');
    item.className = 'event-item glass-panel';
    item.setAttribute('role', 'listitem');
    item.setAttribute('tabindex', '0');
    item.innerHTML = `
      <span class="event-icon" aria-hidden="true">${catIcon(ev.category)}</span>
      <div class="event-body">
        <div class="event-name">${ev.name}</div>
        <div class="event-meta">${ev.year}${ev.value ? ` · ${fmt(ev.value)} ${ev.units}` : ''}</div>
      </div>
      <div class="event-level" style="background:${DANGER_CSS[(ev.level || 1) - 1]}">${ev.level}</div>`;
    item.addEventListener('click', () => {
      if (ev.lat && ev.lon) flyTo(ev.lat, ev.lon);
      handleGlobeTap(ev.lat, ev.lon);
    });
    item.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); item.click(); }
    });
    container.appendChild(item);
  });

  if (!events.length) {
    container.innerHTML = `<div class="event-empty">No events for ${year}</div>`;
  }
}

function catIcon(cat) {
  return { wildfires: '🔥', severeStorms: '⛈', volcanoes: '🌋', storms: '🌀', earthquakes: '📡' }[cat] || '📌';
}
