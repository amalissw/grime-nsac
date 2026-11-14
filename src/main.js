/**
 * Earth Jukebox — Main entry point
 */
import { unlockAudio, setVolume, mute, isMuted, isReady } from './audio/engine.js';
import { initInstruments, playWelcome, playUiClick } from './audio/instruments.js';
import { haptic, setVibrationEnabled, setVibrationIntensity, testVibration, isVibrationSupported } from './audio/haptics.js';
import { initSpeech, setLanguage, setScreenReaderMode, speak } from './audio/speech.js';
import { loadData, getThemes, getFrameCanvas } from './data/loader.js';
import { setCurrent } from './data/sampler.js';
import { initHeroAnimation } from './hero-animation.js';

// Jukebox / Explore / Guide (lazy import after unlock)
let Jukebox, Explore, Guide;

let themes = [];
let currentThemeIdx = 0;
let currentFrameIdx = 0;
let currentFrameCanvas = null;

// ===== Language picker =====

const LANG_STRINGS = {
  ru: {
    start: 'Начать — звук включён',
    hint: 'Лучше в наушниках · Увеличьте громкость',
    hintIphone: 'iPhone: Выключите беззвучный режим',
    srLabel: 'Я использую скринридер',
    chosen: '🇷🇺 Русский выбран',
  },
  en: {
    start: 'Tap to start — sound on',
    hint: 'Best with headphones · Turn up media volume',
    hintIphone: 'iPhone: Switch off silent mode',
    srLabel: 'I use a screen reader',
    chosen: '🇬🇧 English selected',
  },
  zh: {
    start: '点击开始 — 声音已开',
    hint: '建议使用耳机 · 请调高音量',
    hintIphone: 'iPhone：关闭静音模式',
    srLabel: '我使用屏幕阅读器',
    chosen: '🇨🇳 已选中文',
  },
};

function initLangPicker() {
  const picker = document.getElementById('lang-picker');
  if (!picker) return;

  picker.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => pickLang(btn.dataset.lang));
  });

  document.addEventListener('keydown', e => {
    if (document.getElementById('lang-picker')?.hidden) return;
    if (e.key === '1') pickLang('ru');
    else if (e.key === '2') pickLang('en');
    else if (e.key === '3') pickLang('zh');
  });
}

function pickLang(lang) {
  if (!LANG_STRINGS[lang]) lang = 'en';
  setLanguage(lang);

  // Mark selected button
  document.querySelectorAll('.lang-btn').forEach(b => {
    b.classList.toggle('selected', b.dataset.lang === lang);
  });

  const strings = LANG_STRINGS[lang];
  const startBtnText = document.getElementById('start-btn-text');
  if (startBtnText) startBtnText.textContent = strings.start;
  const hintEl = document.getElementById('start-hint-text');
  if (hintEl) hintEl.textContent = strings.hint;
  const hintIphone = document.getElementById('start-hint-iphone');
  if (hintIphone) hintIphone.textContent = strings.hintIphone;
  const srLabel = document.getElementById('sr-label-text');
  if (srLabel) srLabel.textContent = strings.srLabel;
  const chosenMsg = document.getElementById('lang-chosen-msg');
  if (chosenMsg) chosenMsg.textContent = strings.chosen;

  // Show start step, hide lang picker
  const picker = document.getElementById('lang-picker');
  const startStep = document.getElementById('start-step');
  if (picker) picker.hidden = true;
  if (startStep) startStep.hidden = false;

  document.getElementById('start-btn')?.focus();
}

// ===== Boot =====

async function boot() {
  // Start hero animation immediately (runs behind lang picker)
  const heroCanvas = document.getElementById('hero-canvas');
  if (heroCanvas) {
    initHeroAnimation(heroCanvas).catch(() => {});
  }

  // Init lang picker
  initSpeech();
  initLangPicker();

  // Load data in background
  const { themes: t } = await loadData();
  themes = t;

  const hasPlaceholder = themes.some(th => th.isPlaceholder);
  document.getElementById('demo-banner').hidden = !hasPlaceholder;

  // Wire up start button (it's hidden until lang is chosen)
  document.getElementById('start-btn').addEventListener('click', onStart, { once: true });
  document.getElementById('sr-checkbox').addEventListener('change', e => {
    if (e.target.checked) setScreenReaderMode(true);
  });

  // Visibility change
  document.addEventListener('visibilitychange', onVisibilityChange);
}

async function onStart(e) {
  e.preventDefault();
  e.stopPropagation();

  // Synchronous audio unlock
  await unlockAudio();
  navigator.vibrate?.([30]);

  const srOn = document.getElementById('sr-checkbox').checked;
  setScreenReaderMode(srOn);

  // Init instruments
  initInstruments();
  playWelcome();

  // Hide start screen, show app
  document.getElementById('start-screen').hidden = true;
  document.getElementById('app').hidden = false;

  if (srOn) {
    switchTab('guide');
  }

  await initApp();
}

async function initApp() {
  // Import mode modules
  [Jukebox, Explore, Guide] = await Promise.all([
    import('./modes/jukebox.js'),
    import('./modes/explore.js'),
    import('./modes/guide.js'),
  ]);

  // Expose global helper for Guide mode cross-calls
  window.__ej = {
    nextYear: () => {
      currentFrameIdx = (currentFrameIdx + 1) % (themes[currentThemeIdx]?.frames?.length || 1);
      refreshAllModes();
    },
    speak,
  };

  buildTrackCards();
  wireControls();

  // Init jukebox
  await Jukebox.initJukebox(
    document.getElementById('jukebox-canvas'),
    document.getElementById('jukebox-scanner'),
  );

  if (themes[0]) {
    await selectTheme(0);
  }

  // Explore
  Explore.initExplore(
    document.getElementById('explore-canvas'),
    themes[currentThemeIdx],
    currentFrameIdx,
    currentFrameCanvas,
  );

  // Guide
  Guide.initGuide(
    document.getElementById('guide-canvas'),
    themes[currentThemeIdx],
    currentFrameIdx,
    currentFrameCanvas,
  );

  updateThemeSelects();

  // Vibration support message
  const msg = document.getElementById('vibration-support-msg');
  if (!isVibrationSupported()) {
    msg.textContent = 'Vibration not supported on this device — using sound cues.';
    document.getElementById('vibration-toggle').disabled = true;
  }
}

// ===== Theme selection =====

async function selectTheme(idx) {
  currentThemeIdx = Math.max(0, Math.min(themes.length - 1, idx));
  currentFrameIdx = 0;

  if (Jukebox) await Jukebox.loadTheme(themes[currentThemeIdx]);

  await loadCurrentFrame();
  updateTrackCards();
}

async function loadCurrentFrame() {
  const theme = themes[currentThemeIdx];
  if (!theme) return;

  const w = 512, h = 256;
  currentFrameCanvas = await getFrameCanvas(theme, currentFrameIdx, w, h);

  if (currentFrameCanvas) {
    setCurrent(currentFrameCanvas, null, theme);
  }

  if (Explore) Explore.updateFrame(theme, currentFrameIdx, currentFrameCanvas);
  if (Guide) Guide.updateGuide(theme, currentFrameIdx, currentFrameCanvas);
}

async function refreshAllModes() {
  await loadCurrentFrame();
}

// ===== UI helpers =====

function buildTrackCards() {
  const container = document.getElementById('track-cards');
  if (!container) return;
  container.innerHTML = '';
  themes.forEach((theme, i) => {
    const card = document.createElement('div');
    card.className = 'track-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `${theme.title}${theme.isPlaceholder ? ' (demo)' : ''}`);
    card.innerHTML = `
      <div class="track-thumb"><canvas width="200" height="70"></canvas></div>
      <div class="track-title">${theme.title}</div>
      <div class="track-desc">${theme.description}${theme.isPlaceholder ? ' <em>(demo)</em>' : ''}</div>
    `;
    card.addEventListener('click', () => { selectTheme(i); playUiClick(); });
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { selectTheme(i); playUiClick(); } });
    container.appendChild(card);

    // Render thumbnail
    const thumbCanvas = card.querySelector('canvas');
    if (theme.frames[0]?.renderFn) {
      theme.frames[0].renderFn(thumbCanvas, 200, 70);
    }
  });
}

function updateTrackCards() {
  const cards = document.querySelectorAll('.track-card');
  cards.forEach((c, i) => c.classList.toggle('active', i === currentThemeIdx));
}

function updateThemeSelects() {
  ['explore-theme', 'guide-theme'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = themes.map((t, i) => `<option value="${i}">${t.title}</option>`).join('');
    sel.value = currentThemeIdx;
  });
  updateYearSelects();
}

function updateYearSelects() {
  const theme = themes[currentThemeIdx];
  if (!theme) return;
  ['explore-year', 'guide-year'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = theme.frames.map((f, i) => `<option value="${i}">${f.label}</option>`).join('');
    sel.value = currentFrameIdx;
  });
}

// ===== Tab switching =====

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    const active = b.dataset.tab === tabName;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', active);
  });
  document.querySelectorAll('.tab-panel').forEach(p => {
    const active = p.id === `panel-${tabName}`;
    p.classList.toggle('active', active);
    p.hidden = !active;
  });
  playUiClick();
}

// ===== Wire controls =====

function wireControls() {
  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Volume
  const volSlider = document.getElementById('volume-slider');
  volSlider?.addEventListener('input', () => setVolume(Number(volSlider.value)));

  // Mute
  const muteBtn = document.getElementById('mute-btn');
  muteBtn?.addEventListener('click', () => {
    const m = !isMuted();
    mute(m);
    muteBtn.textContent = m ? '🔇' : '🔊';
    muteBtn.setAttribute('aria-pressed', m);
    playUiClick();
  });

  // Player controls
  document.getElementById('play-btn')?.addEventListener('click', () => {
    if (!Jukebox) return;
    const playing = Jukebox.isCurrentlyPlaying();
    if (playing) { Jukebox.pause(); document.getElementById('play-btn').textContent = '▶'; }
    else { Jukebox.play(); document.getElementById('play-btn').textContent = '⏸'; }
    playUiClick();
  });

  document.getElementById('prev-frame-btn')?.addEventListener('click', () => { Jukebox?.prevFrame(); playUiClick(); });
  document.getElementById('next-frame-btn')?.addEventListener('click', () => { Jukebox?.nextFrame(); playUiClick(); });
  document.getElementById('compare-btn')?.addEventListener('click', () => { Jukebox?.compareFirstLast(); playUiClick(); });

  document.getElementById('year-slider')?.addEventListener('input', e => {
    currentFrameIdx = Number(e.target.value);
    Jukebox?.setFrame(currentFrameIdx);
    loadCurrentFrame();
  });

  // Speed
  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Jukebox?.setSpeed(Number(btn.dataset.speed));
      playUiClick();
    });
  });

  // Describe frame
  document.getElementById('describe-btn')?.addEventListener('click', () => {
    const theme = themes[currentThemeIdx];
    if (!theme) return;
    speak(`${theme.title}. Year ${theme.frames[currentFrameIdx]?.label}. Global value ${theme.frames[currentFrameIdx]?.value?.toFixed(2)} ${theme.units}.`, true);
    playUiClick();
  });

  // Explore selects
  document.getElementById('explore-theme')?.addEventListener('change', e => {
    selectTheme(Number(e.target.value));
  });
  document.getElementById('explore-year')?.addEventListener('change', e => {
    currentFrameIdx = Number(e.target.value);
    loadCurrentFrame();
  });

  // Guide selects
  document.getElementById('guide-theme')?.addEventListener('change', e => {
    selectTheme(Number(e.target.value));
  });
  document.getElementById('guide-year')?.addEventListener('change', e => {
    currentFrameIdx = Number(e.target.value);
    loadCurrentFrame();
  });

  // Screen off buttons
  document.getElementById('screen-off-btn')?.addEventListener('click', () => {
    const overlay = document.getElementById('screen-off-overlay');
    if (overlay) overlay.hidden = !overlay.hidden;
    playUiClick();
  });

  document.getElementById('guide-screen-off-btn')?.addEventListener('click', () => {
    Guide?.setScreenOff(true);
    playUiClick();
  });

  // Settings
  document.getElementById('vibration-toggle')?.addEventListener('click', e => {
    const btn = e.currentTarget;
    const on = btn.textContent === 'On';
    setVibrationEnabled(!on);
    btn.textContent = on ? 'Off' : 'On';
    btn.setAttribute('aria-pressed', !on);
    haptic('uiConfirm');
  });

  document.getElementById('vibration-intensity')?.addEventListener('change', e => {
    setVibrationIntensity(Number(e.target.value));
    haptic('uiConfirm');
  });

  document.getElementById('test-vibration-btn')?.addEventListener('click', () => {
    if (!testVibration()) {
      alert('Nothing? Check that vibration is on in Android settings.');
    }
    playUiClick();
  });

  document.getElementById('voice-lang')?.addEventListener('change', e => {
    setLanguage(e.target.value);
    playUiClick();
  });

  // Resume button
  document.getElementById('resume-btn')?.addEventListener('click', async () => {
    await Tone.getContext().resume();
    document.getElementById('resume-btn').hidden = true;
    playUiClick();
  });
}

function onVisibilityChange() {
  if (document.hidden) {
    // Page went to background — pause
  } else {
    // Returned from background
    if (isReady() && window.Tone?.getContext()?.state !== 'running') {
      document.getElementById('resume-btn').hidden = false;
    }
  }
}

// ===== Start =====
boot().catch(console.error);
