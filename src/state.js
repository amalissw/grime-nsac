/**
 * Tiny pub/sub store. Import { state, setState, subscribe } anywhere.
 */
const _subs = {};
export const state = {
  page: 'start',         // start | intro | guide | globe | continents | how
  layer: 'temperature',  // temperature | co2 | wildfires | storms | earthquakes | volcanoes
  segment: 'climate',    // climate | disasters
  year: 2019,
  selection: null,       // { lat, lon, place, value, units, level, nearby }
  settings: {
    language: 'en',      // en | ru | kk
    voice: 'Kore',
    theme: 'light',      // light | dark | contrast
    highContrast: false,
    vibration: true,
    vibrationIntensity: 1,  // 0.6 | 1 | 1.6
    voiceSpeed: 1,
    screenReader: false,
    lowVision: false,
    colorblind: false,
    reduceMotion: false,
    view: 'globe',       // globe | flat
    seenIntro: false,
  },
  audioReady: false,
  continentsPage: {
    continent: null,
    year: 2000,
    playing: false,
  },
  globeView: { lat: 0, lon: 0, zoom: 2 },
  demoData: [],
};

export function setState(patch, silent = false) {
  const changed = [];
  for (const key of Object.keys(patch)) {
    if (typeof patch[key] === 'object' && patch[key] !== null && !Array.isArray(patch[key])) {
      state[key] = { ...state[key], ...patch[key] };
    } else {
      state[key] = patch[key];
    }
    changed.push(key);
  }
  if (!silent) changed.forEach(k => (_subs[k] || []).forEach(fn => fn(state[k], state)));
  (_subs['*'] || []).forEach(fn => fn(state));
}

export function subscribe(key, fn) {
  _subs[key] = _subs[key] || [];
  _subs[key].push(fn);
  return () => { _subs[key] = _subs[key].filter(f => f !== fn); };
}
