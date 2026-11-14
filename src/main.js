/**
 * Earth Jukebox — boot module.
 * Spec §17 Stage 1: Shell + start screen + router + audio/speech unlock.
 */
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/manrope/700.css';

import { state, setState, subscribe } from './state.js';
import { config } from './config.js';
import { initRouter, navigate } from './router.js';
import { initShell, showToast } from './ui/shell.js';
import { initMasterChain, unlockAudio } from './audio/engine.js';
import { initInstruments, playWelcomeChord, playEarcon } from './audio/instruments.js';
import { unlockSpeech, say } from './audio/speech.js';
import { vibrate } from './audio/haptics.js';
import { loadAllData } from './data/loader.js';
import { setData } from './data/query.js';
import { initGlobe } from './pages/globe.js';
import { initMicButton } from './ui/mic-button.js';
import { initContinentsPage, buildContinentsPage } from './pages/continents.js';
import { initAssistant } from './audio/assistant.js';

// ── i18n strings ────────────────────────────────────────────────────────────
const I18N = {
  en: {
    'tab.globe': 'Globe',
    'tab.continents': 'Continents',
    'tab.how': 'How it sounds',
    'seg.climate': 'Climate change',
    'seg.disasters': 'Disasters',
    'layer.temperature': 'Temperature',
    'layer.co2': 'CO₂',
    'layer.wildfires': 'Wildfires',
    'layer.storms': 'Storms',
    'layer.earthquakes': 'Earthquakes',
    'layer.volcanoes': 'Volcanoes',
    'continent.africa': 'Africa',
    'continent.asia': 'Asia',
    'continent.europe': 'Europe',
    'continent.northAmerica': 'N. America',
    'continent.southAmerica': 'S. America',
    'continent.oceania': 'Oceania',
    'continents.title': 'Continents',
    'continents.play': '▶ Play song',
    'how.title': 'How it sounds',
    'intro.title': 'Welcome to Earth Jukebox',
    'intro.body': 'Explore climate data through sound and touch. Tap the globe to hear real NASA data.',
    'intro.next': 'Go to Globe →',
    'settings.title': 'Settings',
    'settings.language': 'Language',
    'settings.voice': 'Voice',
    'settings.theme': 'Theme',
    'settings.light': 'Light',
    'settings.dark': 'Dark',
    'settings.contrast': 'Contrast',
    'settings.vibration': 'Vibration',
    'settings.screenReader': 'Screen reader',
    'settings.highContrast': 'High contrast',
    'settings.reduceMotion': 'Reduce motion',
    'settings.close': 'Close',
    'demo.banner': 'Demo data — not NASA measurements',
    'start.sub': 'Touch & Hear the Planet',
    'start.hint': 'Best with headphones · Turn up media volume',
    'start.btn': 'Start — sound on',
    'start.chosen.en': 'English selected ✓',
    'start.chosen.ru': 'Русский выбран ✓',
    'start.chosen.kk': 'Қазақша таңдалды ✓',
    'start.sr': 'I use a screen reader (TalkBack / VoiceOver)',
    'welcome.msg': 'Welcome to Earth Jukebox. Touch the globe to hear our climate.',
    'resume.btn': 'Tap to resume sound',
  },
  ru: {
    'tab.globe': 'Глобус',
    'tab.continents': 'Континенты',
    'tab.how': 'Как звучит',
    'seg.climate': 'Изменение климата',
    'seg.disasters': 'Катастрофы',
    'layer.temperature': 'Температура',
    'layer.co2': 'CO₂',
    'layer.wildfires': 'Пожары',
    'layer.storms': 'Штормы',
    'layer.earthquakes': 'Землетрясения',
    'layer.volcanoes': 'Вулканы',
    'continent.africa': 'Африка',
    'continent.asia': 'Азия',
    'continent.europe': 'Европа',
    'continent.northAmerica': 'С. Америка',
    'continent.southAmerica': 'Ю. Америка',
    'continent.oceania': 'Океания',
    'continents.title': 'Континенты',
    'continents.play': '▶ Сыграть песню',
    'how.title': 'Как звучит',
    'intro.title': 'Добро пожаловать в Earth Jukebox',
    'intro.body': 'Исследуйте климатические данные через звук и прикосновение.',
    'intro.next': 'Перейти к глобусу →',
    'settings.title': 'Настройки',
    'settings.language': 'Язык',
    'settings.voice': 'Голос',
    'settings.theme': 'Тема',
    'settings.light': 'Светлая',
    'settings.dark': 'Тёмная',
    'settings.contrast': 'Контраст',
    'settings.vibration': 'Вибрация',
    'settings.screenReader': 'Скринридер',
    'settings.highContrast': 'Высокий контраст',
    'settings.reduceMotion': 'Снизить анимацию',
    'settings.close': 'Закрыть',
    'demo.banner': 'Демо-данные — не измерения NASA',
    'start.sub': 'Коснись и услышь планету',
    'start.hint': 'Лучше с наушниками · Увеличьте громкость',
    'start.btn': 'Старт — звук включён',
    'start.chosen.en': 'English selected ✓',
    'start.chosen.ru': 'Русский выбран ✓',
    'start.chosen.kk': 'Қазақша таңдалды ✓',
    'start.sr': 'Я использую скринридер (TalkBack / VoiceOver)',
    'welcome.msg': 'Добро пожаловать в Earth Jukebox. Коснитесь глобуса, чтобы услышать климат Земли.',
    'resume.btn': 'Нажмите для продолжения звука',
  },
  kk: {
    'tab.globe': 'Глобус',
    'tab.continents': 'Континенттер',
    'tab.how': 'Қалай естіледі',
    'seg.climate': 'Климат өзгерісі',
    'seg.disasters': 'Апаттар',
    'layer.temperature': 'Температура',
    'layer.co2': 'CO₂',
    'layer.wildfires': 'Өрттер',
    'layer.storms': 'Дауылдар',
    'layer.earthquakes': 'Жер сілкінісі',
    'layer.volcanoes': 'Жанартаулар',
    'continent.africa': 'Африка',
    'continent.asia': 'Азия',
    'continent.europe': 'Еуропа',
    'continent.northAmerica': 'С. Америка',
    'continent.southAmerica': 'О. Америка',
    'continent.oceania': 'Океания',
    'continents.title': 'Континенттер',
    'continents.play': '▶ Ән ойнату',
    'how.title': 'Қалай естіледі',
    'intro.title': 'Earth Jukebox-қа қош келдіңіз',
    'intro.body': 'Климат деректерін дыбыс пен жанасу арқылы зерттеңіз.',
    'intro.next': 'Глобусқа өту →',
    'settings.title': 'Параметрлер',
    'settings.language': 'Тіл',
    'settings.voice': 'Дауыс',
    'settings.theme': 'Тақырып',
    'settings.light': 'Ашық',
    'settings.dark': 'Қараңғы',
    'settings.contrast': 'Контраст',
    'settings.vibration': 'Діріл',
    'settings.screenReader': 'Скринридер',
    'settings.highContrast': 'Жоғары контраст',
    'settings.reduceMotion': 'Анимацияны азайту',
    'settings.close': 'Жабу',
    'demo.banner': 'Демо деректер — NASA өлшемдері емес',
    'start.sub': 'Планетаны ұстап, тыңдаңыз',
    'start.hint': 'Құлаққаппен жақсырақ · Дыбысты көтеріңіз',
    'start.btn': 'Бастау — дыбыс қосылған',
    'start.chosen.en': 'English selected ✓',
    'start.chosen.ru': 'Русский выбран ✓',
    'start.chosen.kk': 'Қазақша таңдалды ✓',
    'start.sr': 'Мен скринридер қолданамын (TalkBack / VoiceOver)',
    'welcome.msg': 'Earth Jukebox-қа қош келдіңіз. Жердің климатын естіу үшін глобусты ұстаңыз.',
    'resume.btn': 'Дыбысты жалғастыру үшін басыңыз',
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function t(key) {
  const lang = state.settings.language || 'en';
  return I18N[lang]?.[key] || I18N['en'][key] || key;
}

function updateI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    el.textContent = t(key);
  });
}

function isIphone() {
  return /iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

// ── Start screen ──────────────────────────────────────────────────────────────
function setupStartScreen() {
  const startScreen = document.getElementById('start-screen');
  const langPicker  = document.getElementById('lang-picker');
  const startStep   = document.getElementById('start-step');
  const startSub    = document.getElementById('start-sub');
  const startHint   = document.getElementById('start-hint');
  const startHintIphone = document.getElementById('start-hint-iphone');
  const startBtn    = document.getElementById('start-btn');
  const startBtnText = document.getElementById('start-btn-text');
  const startChosenMsg = document.getElementById('start-chosen-msg');
  const srCheckbox  = document.getElementById('sr-checkbox');
  const srLabelText = document.getElementById('sr-label-text');
  const iphone = isIphone();

  if (iphone && startHintIphone) startHintIphone.hidden = false;

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang;
      setState({ settings: { ...state.settings, language: lang } });

      // Highlight selected
      document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b === btn));

      // Show start step
      startChosenMsg.textContent = t(`start.chosen.${lang}`);
      startSub.textContent = t('start.sub');
      startHint.textContent = t('start.hint');
      startBtnText.textContent = t('start.btn');
      if (srLabelText) srLabelText.textContent = t('start.sr');
      startStep.hidden = false;
      startBtn.focus();
      updateI18n();
    });
  });

  startBtn.addEventListener('click', async () => {
    // Must happen in synchronous user-gesture handler
    await unlockAudio();
    unlockSpeech();
    if (navigator.vibrate) navigator.vibrate([30]);
    vibrate('start');

    setState({ settings: { ...state.settings, screenReader: srCheckbox.checked } });

    // Welcome chord
    try { playWelcomeChord(); } catch {}

    // Hide start screen
    startScreen.style.transition = 'opacity 0.5s';
    startScreen.style.opacity = '0';
    setTimeout(() => { startScreen.hidden = true; }, 500);

    // Show shell
    document.getElementById('app-shell').hidden = false;

    // Speak welcome after a brief delay
    setTimeout(() => {
      say(t('welcome.msg'));
    }, 800);

    // Navigate
    const target = state.settings.seenIntro ? 'globe' : 'intro';
    setState({ settings: { ...state.settings, seenIntro: true } });
    navigate(target);
  });
}

// ── Page navigation ──────────────────────────────────────────────────────────
function activatePage(page) {
  // Hide all pages
  document.querySelectorAll('.app-page').forEach(p => { p.hidden = true; });
  // Show target
  const target = document.getElementById(`${page}-page`);
  if (target) target.hidden = false;

  // Update tab states
  document.querySelectorAll('.page-tab').forEach(btn => {
    const active = btn.dataset.page === page;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  playEarcon('pageChange');
}

function setupPageTabs() {
  document.querySelectorAll('.page-tab').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.page));
  });
  document.getElementById('logo-btn')?.addEventListener('click', () => navigate('globe'));
  document.getElementById('intro-next-btn')?.addEventListener('click', () => navigate('globe'));
}

// ── Guide (How it sounds) cards ──────────────────────────────────────────────
function buildGuideCards() {
  const container = document.getElementById('guide-cards');
  if (!container) return;

  const cards = [
    { icon: '🌡️', key: 'temperature', desc_en: 'Warm marimba tones rise with temperature anomaly. Higher notes = hotter region.', desc_ru: 'Маримба повышается с аномалией температуры. Высокие ноты = горячий регион.', desc_kk: 'Маримба температура аномалиясымен артады.' },
    { icon: '💨', key: 'co2', desc_en: 'Airy breeze texture thickens with CO₂ ppm. Dense air = higher concentration.', desc_ru: 'Воздушная текстура густеет с ростом CO₂. Густой воздух = больше CO₂.', desc_kk: 'CO₂ өскен сайын ауа текстурасы қалыңдайды.' },
    { icon: '🔥', key: 'wildfires', desc_en: 'Crackling fire sounds pulse with nearby wildfire count.', desc_ru: 'Потрескивание пульсирует с количеством ближайших пожаров.', desc_kk: 'Крекинг дыбысы жақын өрттер санымен пульстайды.' },
    { icon: '🌀', key: 'storms', desc_en: 'Howling wind pans with storm direction. BPM = wind speed.', desc_ru: 'Вой ветра следует направлению шторма. BPM = скорость ветра.', desc_kk: 'Дауыл бағытымен желдің ұлуы. BPM = жел жылдамдығы.' },
    { icon: '📡', key: 'earthquakes', desc_en: 'Deep thump and rumble for each earthquake. Magnitude = bass depth.', desc_ru: 'Глухой удар и рокот для каждого землетрясения. Магнитуда = глубина баса.', desc_kk: 'Әр жер сілкінісіне терең соққы. Магнитуда = бас тереңдігі.' },
    { icon: '🌋', key: 'volcanoes', desc_en: 'Low humming drone activates near volcanic events.', desc_ru: 'Низкий гул активируется вблизи вулканических событий.', desc_kk: 'Вулкандық оқиғалар жанында төмен ызыңдау пайда болады.' },
    { icon: '🎵', key: 'danger', desc_en: 'Danger chords: green (calm) → red (critical). Tempo rises with urgency.', desc_ru: 'Аккорды опасности: зелёный (спокойно) → красный (критично).', desc_kk: 'Қауіп аккорды: жасыл (тыныш) → қызыл (критикалық).' },
    { icon: '📍', key: 'location', desc_en: 'Stereo pan follows longitude. High pitch = northern latitudes.', desc_ru: 'Стерео пан следует долготе. Высокий тон = северные широты.', desc_kk: 'Стерео пан бойлыққа сәйкес. Жоғары тон = солтүстік ендіктер.' },
  ];

  const lang = state.settings.language || 'en';
  cards.forEach(card => {
    const el = document.createElement('div');
    el.className = 'guide-card glass-panel';
    el.innerHTML = `
      <span class="guide-card-icon" aria-hidden="true">${card.icon}</span>
      <div class="guide-card-body">
        <div class="guide-card-desc">${card[`desc_${lang}`] || card.desc_en}</div>
      </div>`;
    container.appendChild(el);
  });
}

// ── Year slider ───────────────────────────────────────────────────────────────
function setupYearSlider() {
  const slider = document.getElementById('year-slider');
  const label  = document.getElementById('year-label');
  const ticks  = document.getElementById('year-ticks');
  if (!slider) return;

  // Build tick marks
  if (ticks) {
    for (let y = config.yearMin; y <= config.yearMax; y += 5) {
      const tick = document.createElement('span');
      tick.textContent = y;
      ticks.appendChild(tick);
    }
  }

  slider.min  = config.yearMin;
  slider.max  = config.yearMax;
  slider.value = state.year || config.defaultYear;
  if (label) label.textContent = slider.value;

  slider.addEventListener('input', () => {
    const yr = parseInt(slider.value, 10);
    if (label) label.textContent = yr;
    setState({ year: yr });
    playEarcon('yearTick');
  });

  subscribe('year', yr => {
    slider.value = yr;
    if (label) label.textContent = yr;
  });
}

// ── Segment tabs (Climate / Disasters) ───────────────────────────────────────
function setupSegmentTabs() {
  document.querySelectorAll('.segment-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const seg = btn.dataset.segment;
      document.querySelectorAll('.segment-tab').forEach(b => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });
      document.getElementById('climate-options').hidden = seg !== 'climate';
      document.getElementById('disaster-options').hidden = seg !== 'disasters';
      setState({ segment: seg });
      playEarcon('select');
    });
  });
}

// ── Layer selector ────────────────────────────────────────────────────────────
function setupLayerSelector() {
  document.querySelectorAll('.option-card[data-layer]').forEach(btn => {
    btn.addEventListener('click', () => {
      const layer = btn.dataset.layer;
      document.querySelectorAll('.option-card[data-layer]').forEach(b => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
      setState({ layer });
      playEarcon('layerChange');
    });
  });
}

// ── Mute / volume ─────────────────────────────────────────────────────────────
function setupVolumeControls() {
  const muteBtn = document.getElementById('mute-btn');
  const volSlider = document.getElementById('volume-slider');

  muteBtn?.addEventListener('click', () => {
    // Toggle is handled by engine; just update icon
    const muted = muteBtn.getAttribute('aria-pressed') === 'true';
    muteBtn.setAttribute('aria-pressed', (!muted).toString());
    muteBtn.textContent = muted ? '🔊' : '🔇';
  });

  volSlider?.addEventListener('input', () => {
    // Engine listens via state
    setState({ settings: { ...state.settings, _volumeDb: parseInt(volSlider.value, 10) } });
  });
}

// ── Resume button (tab visibility) ───────────────────────────────────────────
function setupResumeButton() {
  const btn = document.getElementById('resume-btn');
  const btnText = document.getElementById('resume-btn-text');

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && btn) {
      if (btnText) btnText.textContent = t('resume.btn');
      btn.hidden = false;
    }
  });

  btn?.addEventListener('click', async () => {
    await unlockAudio();
    btn.hidden = true;
  });
}

// ── Demo banner ───────────────────────────────────────────────────────────────
function setupDemoBanner() {
  subscribe('demoData', arr => {
    const banner = document.getElementById('demo-banner');
    const txt = document.getElementById('demo-banner-text');
    if (banner && arr && arr.length) {
      if (txt) txt.textContent = t('demo.banner');
      banner.hidden = false;
    }
  });
}

// ── Continent page ────────────────────────────────────────────────────────────
function setupContinentPage() {
  const player = document.getElementById('continent-player');
  const nameEl = document.getElementById('continent-name');
  const yearSlider = document.getElementById('continent-year-slider');
  const yearLabel = document.getElementById('continent-year-label');
  const playBtn = document.getElementById('continent-play-btn');

  document.querySelectorAll('.continent-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = btn.dataset.continent;
      document.querySelectorAll('.continent-btn').forEach(b => b.classList.toggle('active', b === btn));
      setState({ continentsPage: { ...state.continentsPage, continent: c } });
      if (nameEl) nameEl.textContent = t(`continent.${c}`);
      if (player) player.hidden = false;
      playEarcon('select');
      vibrate('select');
    });
  });

  yearSlider?.addEventListener('input', () => {
    const yr = parseInt(yearSlider.value, 10);
    if (yearLabel) yearLabel.textContent = yr;
    setState({ continentsPage: { ...state.continentsPage, year: yr } });
  });

  // Playback handled by initContinentsPage() in continents.js
}

// ── BOOT ──────────────────────────────────────────────────────────────────────
async function boot() {
  // Apply saved theme
  document.documentElement.setAttribute('data-theme', state.settings.theme || 'light');

  // Init router (hash-based)
  initRouter();

  // Init shell (settings drawer, toasts)
  initShell();

  // Apply initial i18n
  updateI18n();

  // Setup all UI
  setupStartScreen();
  setupPageTabs();
  setupYearSlider();
  setupSegmentTabs();
  setupLayerSelector();
  setupVolumeControls();
  setupResumeButton();
  setupDemoBanner();
  setupContinentPage();
  buildContinentsPage();

  // Subscribe to page changes from router
  let _globeInited = false;
  subscribe('page', page => {
    if (page === 'start') return;
    activatePage(page);
    if (page === 'globe' && !_globeInited) {
      _globeInited = true;
      setTimeout(initGlobe, 100);
    }
  });

  // Subscribe to language changes
  subscribe('settings', settings => {
    document.documentElement.lang = settings.language || 'en';
    document.documentElement.setAttribute('data-theme', settings.theme || 'light');
    updateI18n();
    // Update settings drawer chips
    document.querySelectorAll('.lang-chip').forEach(c => c.classList.toggle('active', c.dataset.lang === settings.language));
    document.querySelectorAll('.theme-chip').forEach(c => c.classList.toggle('active', c.dataset.theme === settings.theme));
  });

  // Init audio (Tone.js master chain, instruments) — silent until user gesture
  try {
    initMasterChain();
    initInstruments();
  } catch (e) {
    console.warn('[ej] audio init error:', e);
  }

  // Build guide cards
  buildGuideCards();

  // Init mic button
  initMicButton();

  // Init continents page music player
  initContinentsPage();

  // Init voice assistant
  initAssistant();

  // Load data in background
  loadAllData().then(data => {
    setData(data);
    // Notify globe page (Stage 2 will listen)
    window.dispatchEvent(new CustomEvent('ej:data-ready', { detail: data }));
  }).catch(err => {
    console.warn('[ej] data load error:', err);
  });
}

boot();
