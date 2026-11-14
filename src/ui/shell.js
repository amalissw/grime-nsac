/**
 * App shell: top bar, page tabs, settings drawer, toasts, aria-live
 */
import { state, setState, subscribe } from '../state.js';
import { navigate } from '../router.js';
import { config } from '../config.js';

const PAGES = [
  { id: 'globe', label: 'Globe' },
  { id: 'continents', label: 'Continents' },
  { id: 'how', label: 'How it sounds' },
];

const I18N = {
  en: { globe: 'Globe', continents: 'Continents', how: 'How it sounds', settings: 'Settings', guide: 'Sound Guide', mute: 'Mute', unmute: 'Unmute' },
  ru: { globe: 'Глобус', continents: 'Континенты', how: 'Как звучит', settings: 'Настройки', guide: 'Гид по звукам', mute: 'Без звука', unmute: 'Со звуком' },
  kk: { globe: 'Глобус', continents: 'Континенттер', how: 'Дыбыстар туралы', settings: 'Параметрлер', guide: 'Дыбыс нұсқаулығы', mute: 'Дыбыссыз', unmute: 'Дыбыспен' },
};

function t(key) { return (I18N[state.settings.language] || I18N.en)[key] || key; }

export function initShell() {
  buildShell();
  subscribe('page', syncTabs);
  subscribe('settings', syncTheme);
  syncTheme();
}

function buildShell() {
  const shell = document.getElementById('app-shell');
  if (!shell) return;

  // --- Top Bar ---
  const bar = document.getElementById('top-bar');
  if (!bar) return;

  bar.innerHTML = `
    <a href="#/globe" id="logo" aria-label="Earth Jukebox home">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
      Earth Jukebox
    </a>
    <nav id="page-tabs" role="tablist" aria-label="Pages">
      ${PAGES.map(p => `
        <a href="#/${p.id}" class="page-tab" role="tab" data-page="${p.id}"
           aria-controls="${p.id}-page">${p.label}</a>
      `).join('')}
    </nav>
    <div id="top-bar-actions">
      <button class="top-bar-btn" id="btn-guide" aria-label="Sound Guide" title="Sound Guide">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </button>
      <label class="top-bar-btn" title="Volume" style="cursor:default">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
        </svg>
      </label>
      <input type="range" id="vol-slider" min="0" max="100" value="80" aria-label="Volume">
      <button class="top-bar-btn" id="btn-mute" aria-label="Mute" title="Mute">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
        </svg>
      </button>
      <button class="top-bar-btn" id="btn-theme" aria-label="Toggle theme" title="Toggle theme">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
          <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      </button>
      <button class="top-bar-btn" id="btn-settings" aria-label="Settings" title="Settings">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
          <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>
    </div>
  `;

  // Wire buttons
  document.getElementById('btn-guide')?.addEventListener('click', () => navigate('guide'));
  document.getElementById('btn-theme')?.addEventListener('click', cycleTheme);
  document.getElementById('btn-settings')?.addEventListener('click', toggleSettings);
  document.getElementById('btn-mute')?.addEventListener('click', toggleMute);
  document.getElementById('vol-slider')?.addEventListener('input', onVolumeChange);

  // Page tabs
  document.querySelectorAll('.page-tab').forEach(tab => {
    tab.addEventListener('click', e => {
      e.preventDefault();
      navigate(tab.dataset.page);
    });
  });

  buildSettingsDrawer();
  syncTabs();
}

function syncTabs() {
  document.querySelectorAll('.page-tab').forEach(tab => {
    const isCurrent = tab.dataset.page === state.page;
    tab.setAttribute('aria-current', isCurrent ? 'page' : 'false');
    tab.setAttribute('aria-selected', String(isCurrent));
  });
  // Show/hide pages
  document.querySelectorAll('.page').forEach(p => {
    const id = p.id.replace('-page', '');
    p.classList.toggle('active', id === state.page);
  });
}

function syncTheme() {
  document.documentElement.setAttribute('data-theme', state.settings.theme);
  if (state.settings.highContrast) document.documentElement.setAttribute('data-theme', 'contrast');
}

function cycleTheme() {
  const themes = ['light', 'dark', 'contrast'];
  const idx = themes.indexOf(state.settings.theme);
  const next = themes[(idx + 1) % themes.length];
  setState({ settings: { theme: next } });
}

let _muted = false;
function toggleMute() {
  _muted = !_muted;
  // The audio engine volume is handled separately; here we just signal
  import('../audio/engine.js').then(m => m.setMasterMute && m.setMasterMute(_muted));
  document.getElementById('btn-mute')?.setAttribute('aria-label', _muted ? 'Unmute' : 'Mute');
}

function onVolumeChange(e) {
  const pct = e.target.value / 100;
  import('../audio/engine.js').then(m => m.setMasterVolume && m.setMasterVolume(pct));
}

function buildSettingsDrawer() {
  const drawer = document.getElementById('settings-drawer');
  if (!drawer) return;
  drawer.innerHTML = `
    <h2>Settings</h2>
    <div class="setting-row">
      <span class="setting-label">Language</span>
      <div class="chip-group">
        ${['en','ru','kk'].map(l => `<button class="chip" data-lang="${l}" onclick="window._setLang('${l}')">${l.toUpperCase()}</button>`).join('')}
      </div>
    </div>
    <div class="setting-row">
      <span class="setting-label">Voice</span>
      <select id="voice-select" style="padding:4px;border-radius:8px;background:var(--glass);color:var(--text);border:1px solid var(--glass-border)">
        ${config.geminiVoices.map(v => `<option value="${v}">${v}</option>`).join('')}
      </select>
    </div>
    <div class="setting-row">
      <span class="setting-label">Theme</span>
      <div class="chip-group">
        ${['light','dark','contrast'].map(t => `<button class="chip" onclick="window._setTheme('${t}')">${t}</button>`).join('')}
      </div>
    </div>
    <div class="setting-row">
      <span class="setting-label">Vibration</span>
      <input type="checkbox" id="vib-toggle" checked onchange="window._setVib(this.checked)" style="width:18px;height:18px;accent-color:var(--accent)">
    </div>
    <div class="setting-row">
      <span class="setting-label">Screen reader</span>
      <input type="checkbox" id="sr-toggle" onchange="window._setSr(this.checked)" style="width:18px;height:18px;accent-color:var(--accent)">
    </div>
    <div class="setting-row">
      <span class="setting-label">High contrast</span>
      <input type="checkbox" id="hc-toggle" onchange="window._setHc(this.checked)" style="width:18px;height:18px;accent-color:var(--accent)">
    </div>
    <div class="setting-row">
      <span class="setting-label">Reduce motion</span>
      <input type="checkbox" id="rm-toggle" onchange="window._setRm(this.checked)" style="width:18px;height:18px;accent-color:var(--accent)">
    </div>
    <div class="setting-row">
      <span class="setting-label">View</span>
      <div class="chip-group">
        <button class="chip" onclick="window._setView('globe')">Globe</button>
        <button class="chip" onclick="window._setView('flat')">Flat map</button>
      </div>
    </div>
    <hr style="border-color:var(--glass-border)">
    <button class="btn btn-glass" onclick="window._navigate('intro')" style="width:100%">▶ Replay intro</button>
    <div class="setting-row">
      <span class="setting-label">Assistant</span>
      <span id="assistant-status" style="font-size:0.8125rem;color:var(--text-2)">Checking…</span>
    </div>
  `;

  // Global helpers (simple bridge for inline onclick)
  window._setLang = l => setState({ settings: { language: l } });
  window._setTheme = t => setState({ settings: { theme: t } });
  window._setVib = v => setState({ settings: { vibration: v } });
  window._setSr = v => setState({ settings: { screenReader: v } });
  window._setHc = v => setState({ settings: { highContrast: v } });
  window._setRm = v => setState({ settings: { reduceMotion: v } });
  window._setView = v => setState({ settings: { view: v } });
  window._navigate = navigate;
}

function toggleSettings() {
  document.getElementById('settings-drawer')?.classList.toggle('open');
}

// ---- Toast ----
export function showToast(msg, durationMs = config.toastDurationMs) {
  const area = document.getElementById('toast-area');
  if (!area) return;
  const toast = document.createElement('div');
  toast.className = 'toast glass-panel';
  toast.textContent = msg;
  area.appendChild(toast);
  announce(msg);
  setTimeout(() => toast.remove(), durationMs);
}

// ---- Aria live ----
export function announce(msg, assertive = false) {
  const el = document.getElementById(assertive ? 'aria-assertive' : 'aria-polite');
  if (el) { el.textContent = ''; requestAnimationFrame(() => { el.textContent = msg; }); }
}
