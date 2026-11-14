/**
 * Data loader: fetches JSON from public/data/, validates, falls back to placeholders.
 * Spec §12
 */
import { placeholders } from './placeholders.js';
import { setState } from '../state.js';

const BASE = import.meta.env.BASE_URL || './';
const DATA = BASE + 'data/';

let _cache = {};

async function fetchJson(name) {
  if (_cache[name]) return _cache[name];
  try {
    const r = await fetch(DATA + name + '.json');
    if (!r.ok) throw new Error(r.status);
    const data = await r.json();
    _cache[name] = data;
    return data;
  } catch {
    return null;
  }
}

export async function loadAllData() {
  const demo = [];

  const [temperature, co2, events, storms, quakes, seaice, countries, world] = await Promise.all([
    fetchJson('temperature'),
    fetchJson('co2'),
    fetchJson('events'),
    fetchJson('storms'),
    fetchJson('quakes'),
    fetchJson('seaice'),
    fetchJson('countries'),
    fetchJson('world'),
  ]);

  const data = {};

  if (temperature && temperature.cells) {
    data.temperature = temperature;
  } else {
    data.temperature = placeholders.temperature();
    demo.push('temperature');
  }

  if (co2 && co2.years && co2.ppm) {
    data.co2 = co2;
  } else {
    data.co2 = placeholders.co2();
    demo.push('co2');
  }

  if (events && Array.isArray(events)) {
    data.events = events;
  } else {
    data.events = placeholders.events();
    demo.push('events');
  }

  if (storms && Array.isArray(storms)) {
    data.storms = storms;
  } else {
    data.storms = placeholders.storms();
    demo.push('storms');
  }

  if (quakes && Array.isArray(quakes)) {
    data.quakes = quakes;
  } else {
    data.quakes = placeholders.quakes();
    demo.push('quakes');
  }

  if (seaice && seaice.years) {
    data.seaice = seaice;
  } else {
    data.seaice = placeholders.seaice();
  }

  if (countries && Array.isArray(countries)) {
    data.countries = countries;
  } else {
    data.countries = placeholders.countries();
  }

  data.world = world || placeholders.world(data);

  if (demo.length > 0) setState({ demoData: demo });

  return data;
}
