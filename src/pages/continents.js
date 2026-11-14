/**
 * Continents page — music player with bird chorus and timeline playback.
 * Spec §8, §17 Stage 8.
 *
 * Each continent plays its song starting from a chosen year.
 * The bird count decreases as temperature rises and CO₂ increases:
 *   b = clamp(round(8 − 2.2×max(0,a) − 3×(c−370)/55), 1, 8)
 */
import { state, setState, subscribe } from '../state.js';
import { config, CONTINENT_KEYS } from '../config.js';
import {
  playBirdChorus, updateHum, stopContinents,
  startPulse, stopPulse, playChord, playEarcon,
  birdsCount, calcDangerLevel, DANGER_COLORS,
} from '../audio/sound-engine.js';
import { vibrate } from '../audio/haptics.js';
import { say } from '../audio/speech.js';
import { showToast } from '../ui/shell.js';

// ── Continent data ────────────────────────────────────────────────────────────
const CONTINENT_INFO = {
  africa:       { icon: '🌍', key: 'D' },
  asia:         { icon: '🌏', key: 'E' },
  europe:       { icon: '🗺',  key: 'G' },
  northAmerica: { icon: '🌎', key: 'C' },
  southAmerica: { icon: '🌎', key: 'A' },
  oceania:      { icon: '🌏', key: 'F' },
};

// ── State ─────────────────────────────────────────────────────────────────────
let _playing = false;
let _playHandle = null;
let _selectedContinent = null;
let _currentYear = 2000;
let _worldData = null;

// ── Init ──────────────────────────────────────────────────────────────────────
export function initContinentsPage() {
  _bindContinentButtons();
  _bindPlayerControls();
  _bindYearSlider();

  subscribe('page', page => {
    if (page !== 'continents') {
      _stopPlayback();
    }
  });

  // Load world data once available
  window.addEventListener('ej:data-ready', e => {
    _worldData = e.detail?.world || null;
    _updateBirdBar();
  });
}

// ── Continent selection ───────────────────────────────────────────────────────
function _bindContinentButtons() {
  document.querySelectorAll('.continent-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = btn.dataset.continent;
      _selectedContinent = c;

      document.querySelectorAll('.continent-btn').forEach(b => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });

      const player = document.getElementById('continent-player');
      const nameEl = document.getElementById('continent-name');
      const keyEl  = document.getElementById('continent-key');

      if (nameEl) nameEl.textContent = _t(`continent.${c}`);
      if (keyEl)  keyEl.textContent  = `Key: ${CONTINENT_KEYS[c] ?? 'C'} major pentatonic`;
      if (player) player.hidden = false;

      _stopPlayback();
      _updateBirdBar();
      playEarcon('select');
      vibrate('select');
    });
  });
}

// ── Player controls ───────────────────────────────────────────────────────────
function _bindPlayerControls() {
  const playBtn = document.getElementById('continent-play-btn');
  playBtn?.addEventListener('click', () => {
    if (_playing) {
      _stopPlayback();
    } else {
      _startPlayback();
    }
  });
}

function _bindYearSlider() {
  const slider = document.getElementById('continent-year-slider');
  const label  = document.getElementById('continent-year-label');
  if (!slider) return;

  slider.min   = config.yearMin;
  slider.max   = config.yearMax;
  slider.value = config.yearMin;

  slider.addEventListener('input', () => {
    _currentYear = parseInt(slider.value, 10);
    if (label) label.textContent = _currentYear;
    _updateBirdBar();
    if (_playing) _playYear(_currentYear);
  });
}

// ── Playback ──────────────────────────────────────────────────────────────────
function _startPlayback() {
  if (!_selectedContinent) {
    showToast('Select a continent first');
    return;
  }

  _playing = true;
  _updatePlayBtn(true);

  const startYear = _currentYear;
  let yr = startYear;

  const step = () => {
    if (!_playing || yr > config.yearMax) {
      _stopPlayback();
      return;
    }
    _currentYear = yr;
    _updateYearDisplay(yr);
    _playYear(yr);
    yr++;
    _playHandle = setTimeout(step, config.continentBarMs);
  };
  step();
}

function _stopPlayback() {
  _playing = false;
  if (_playHandle) { clearTimeout(_playHandle); _playHandle = null; }
  _updatePlayBtn(false);
  stopContinents();
}

function _playYear(year) {
  const { anomaly, co2 } = _getWorldData(year);
  const level = calcDangerLevel('temperature', anomaly);

  // Update danger indicator
  _updateDangerIndicator(level, anomaly, co2);

  // ① Bird chorus (texture)
  playBirdChorus(_selectedContinent, anomaly, co2);

  // ② CO₂ hum drone
  updateHum(co2);

  // ③ Chord + pulse from danger level
  playChord(level, 'temperature');
  startPulse(level);

  // Announce year (screen reader)
  if (state.settings?.screenReader) {
    const birds = birdsCount(anomaly, co2);
    say(`${year}: ${anomaly.toFixed(2)}°C anomaly, ${birds} birds`);
  }
}

function _getWorldData(year) {
  if (!_worldData) return { anomaly: 0.5, co2: 390 };
  const row = _worldData.find(r => r.year === year);
  return row ? { anomaly: row.anomaly ?? 0.5, co2: row.co2 ?? 390 } : { anomaly: 0.5, co2: 390 };
}

// ── Visual updates ────────────────────────────────────────────────────────────
function _updateBirdBar() {
  const { anomaly, co2 } = _getWorldData(_currentYear);
  const count = birdsCount(anomaly, co2);

  const bar = document.getElementById('bird-bar');
  if (!bar) return;

  bar.innerHTML = '';
  for (let i = 0; i < 8; i++) {
    const bird = document.createElement('span');
    bird.className = 'bird-icon' + (i < count ? ' active' : ' inactive');
    bird.textContent = '🐦';
    bird.setAttribute('aria-hidden', 'true');
    bar.appendChild(bird);
  }

  const countEl = document.getElementById('bird-count');
  if (countEl) countEl.textContent = `${count}/8 birds`;
}

function _updateDangerIndicator(level, anomaly, co2) {
  const el = document.getElementById('continent-danger');
  if (!el) return;
  el.style.background = DANGER_COLORS[level - 1] ?? '#22C55E';
  el.setAttribute('aria-label', `Danger level ${level}: ${anomaly.toFixed(2)}°C, ${co2} ppm CO₂`);
  el.textContent = `L${level}`;
}

function _updateYearDisplay(year) {
  const label  = document.getElementById('continent-year-label');
  const slider = document.getElementById('continent-year-slider');
  if (label)  label.textContent = year;
  if (slider) slider.value = year;
}

function _updatePlayBtn(playing) {
  const btn = document.getElementById('continent-play-btn');
  if (!btn) return;
  btn.textContent   = playing ? '⏹ Stop' : _t('continents.play');
  btn.setAttribute('aria-pressed', playing ? 'true' : 'false');
}

// ── Build the continent page HTML dynamically ─────────────────────────────────
export function buildContinentsPage() {
  const layout = document.getElementById('continents-layout');
  if (!layout) return;

  // Inject bird bar and danger indicator into the player if not present
  const player = document.getElementById('continent-player');
  if (player && !document.getElementById('bird-bar')) {
    const birdSection = document.createElement('div');
    birdSection.className = 'bird-section';
    birdSection.innerHTML = `
      <div class="bird-bar-label">Bird chorus</div>
      <div id="bird-bar" class="bird-bar" aria-label="Bird count" role="img"></div>
      <span id="bird-count" class="bird-count-label">8/8 birds</span>
    `;

    const dangerRow = document.createElement('div');
    dangerRow.className = 'continent-danger-row';
    dangerRow.innerHTML = `
      <div id="continent-danger" class="continent-danger-chip" role="status" aria-live="polite" style="background:#22C55E">L1</div>
      <div id="continent-key" class="continent-key-label"></div>
    `;

    // Insert before play button
    const playBtn = document.getElementById('continent-play-btn');
    if (playBtn) {
      player.insertBefore(dangerRow, playBtn);
      player.insertBefore(birdSection, playBtn);
    }
  }
}

// ── i18n helper ───────────────────────────────────────────────────────────────
function _t(key) {
  const lang = state.settings?.language || 'en';
  const maps = {
    en: {
      'continents.play': '▶ Play song',
      'continent.africa': 'Africa',
      'continent.asia': 'Asia',
      'continent.europe': 'Europe',
      'continent.northAmerica': 'N. America',
      'continent.southAmerica': 'S. America',
      'continent.oceania': 'Oceania',
    },
    ru: {
      'continents.play': '▶ Сыграть песню',
      'continent.africa': 'Африка',
      'continent.asia': 'Азия',
      'continent.europe': 'Европа',
      'continent.northAmerica': 'С. Америка',
      'continent.southAmerica': 'Ю. Америка',
      'continent.oceania': 'Океания',
    },
    kk: {
      'continents.play': '▶ Ән ойнату',
      'continent.africa': 'Африка',
      'continent.asia': 'Азия',
      'continent.europe': 'Еуропа',
      'continent.northAmerica': 'С. Америка',
      'continent.southAmerica': 'О. Америка',
      'continent.oceania': 'Океания',
    },
  };
  return maps[lang]?.[key] || maps.en[key] || key;
}
