/**
 * getPointData(lat, lon, layer, year) → {value, units, level, place, nearby[]}
 * Spec §2 data/query.js
 */
import { calcDangerLevel } from '../audio/mapping.js';
import { config } from '../config.js';

let _data = null;

export function setData(d) { _data = d; }

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function nearestTempCell(lat, lon, year) {
  if (!_data?.temperature?.cells) return null;
  const cells = _data.temperature.cells[String(year)];
  const lats = _data.temperature.lat;
  const lons = _data.temperature.lon;
  if (!cells || !lats || !lons) return null;
  let bestDist = Infinity, bestVal = null;
  for (let li = 0; li < lats.length; li++) {
    for (let lo = 0; lo < lons.length; lo++) {
      const d = haversineKm(lat, lon, lats[li], lons[lo]);
      if (d < bestDist) { bestDist = d; bestVal = cells[li * lons.length + lo]; }
    }
  }
  return bestVal;
}

function co2ForYear(year) {
  if (!_data?.co2) return 400;
  const idx = _data.co2.years?.indexOf(year);
  return idx >= 0 ? _data.co2.ppm[idx] : 400;
}

function nearbyFires(lat, lon, year, radiusKm = config.fireRadiusKm) {
  if (!_data?.events) return [];
  return _data.events.filter(e =>
    e.category === 'wildfires' &&
    new Date(e.date).getFullYear() === year &&
    haversineKm(lat, lon, e.lat, e.lon) <= radiusKm
  );
}

function nearbyStorms(lat, lon, year, radiusKm = config.stormNearbyRadiusKm) {
  if (!_data?.storms) return [];
  return _data.storms.filter(s => s.year === year && s.points?.some(p => haversineKm(lat, lon, p[0], p[1]) <= radiusKm));
}

function nearbyQuakes(lat, lon, year, radiusKm = config.quakeNearbyRadiusKm) {
  if (!_data?.quakes) return [];
  return _data.quakes.filter(q => q.year === year && haversineKm(lat, lon, q.lat, q.lon) <= radiusKm);
}

function getPlaceName(lat, lon) {
  // Ocean check
  for (const o of config.oceanBoxes) {
    if (lon >= o.bbox[0] && lat >= o.bbox[1] && lon <= o.bbox[2] && lat <= o.bbox[3]) {
      return o.name;
    }
  }
  // Country from data
  if (_data?.countries) {
    // Simple bbox check
    for (const c of _data.countries) {
      if (c.bbox && lat >= c.bbox[1] && lat <= c.bbox[3] && lon >= c.bbox[0] && lon <= c.bbox[2]) {
        return c.name;
      }
    }
  }
  return `${lat.toFixed(1)}°, ${lon.toFixed(1)}°`;
}

export function getPointData(lat, lon, layer, year) {
  const place = getPlaceName(lat, lon);
  const isDemo = !_data?.temperature?.source?.includes('NASA');

  switch (layer) {
    case 'temperature': {
      const val = nearestTempCell(lat, lon, year);
      const level = calcDangerLevel('temperature', val ?? 0);
      return { value: val, units: '°C', level, place, nearby: [], source: 'NASA GISTEMP v4', demo: isDemo, layer };
    }
    case 'co2': {
      const val = co2ForYear(year);
      const level = calcDangerLevel('co2', val);
      return { value: val, units: 'ppm', level, place, nearby: [], source: 'NOAA GML', demo: isDemo, layer };
    }
    case 'wildfires': {
      const fires = nearbyFires(lat, lon, year);
      const val = fires.length;
      const level = calcDangerLevel('wildfires', val);
      return { value: val, units: `fires within ${config.fireRadiusKm} km`, level, place, nearby: fires.slice(0, 5), source: 'NASA EONET', demo: isDemo, layer };
    }
    case 'storms': {
      const storms = nearbyStorms(lat, lon, year);
      const maxWind = storms.reduce((m, s) => Math.max(m, s.maxWind || 0), 0);
      const level = calcDangerLevel('storms', maxWind);
      return { value: maxWind, units: 'kt max wind', level, place, nearby: storms.slice(0, 5), source: 'NOAA IBTrACS', demo: isDemo, layer };
    }
    case 'earthquakes': {
      const quakes = nearbyQuakes(lat, lon, year);
      const maxMag = quakes.reduce((m, q) => Math.max(m, q.mag), 0);
      const level = calcDangerLevel('earthquakes', maxMag || 0);
      return { value: maxMag || null, units: 'magnitude', level, place, nearby: quakes.slice(0, 5), source: 'USGS', demo: isDemo, layer };
    }
    case 'volcanoes': {
      const nearby = (_data?.events || []).filter(e =>
        e.category === 'volcanoes' &&
        new Date(e.date).getFullYear() === year &&
        haversineKm(lat, lon, e.lat, e.lon) <= 500
      );
      const level = nearby.length >= config.volcanoL4Events ? 4 : nearby.length > 0 ? 3 : 1;
      return { value: nearby.length, units: 'volcanic events nearby', level, place, nearby: nearby.slice(0, 5), source: 'NASA EONET', demo: isDemo, layer };
    }
    default:
      return { value: null, units: '', level: 1, place, nearby: [], source: 'Demo', demo: true, layer };
  }
}

export function getWorldData(layer, year) {
  if (!_data?.world) return { value: null, units: '', level: 1 };
  const w = _data.world.find(r => r.year === year);
  if (!w) return { value: null, units: '', level: 1 };
  if (layer === 'temperature') return { value: w.anomaly, units: '°C', level: calcDangerLevel('temperature', w.anomaly) };
  if (layer === 'co2') return { value: w.co2, units: 'ppm', level: calcDangerLevel('co2', w.co2) };
  return { value: null, units: '', level: 1 };
}

export function listEvents(type, year, limit = 30) {
  if (!_data) return [];
  let evs = [];
  if (type === 'storms') {
    evs = (_data.storms || []).filter(s => s.year === year).map(s => ({
      id: s.id, name: s.name, year: s.year,
      lat: s.points?.[0]?.[0], lon: s.points?.[0]?.[1],
      level: calcDangerLevel('storms', s.maxWind), category: 'storms',
      value: s.maxWind, units: 'kt',
    }));
  } else if (type === 'wildfires' || type === 'volcanoes' || type === 'allDisasters') {
    const cats = type === 'allDisasters'
      ? ['wildfires', 'severeStorms', 'volcanoes']
      : type === 'wildfires' ? ['wildfires'] : ['volcanoes'];
    evs = (_data.events || [])
      .filter(e => cats.includes(e.category) && new Date(e.date).getFullYear() === year)
      .map(e => ({
        id: e.id, name: e.title, year,
        lat: e.lat, lon: e.lon,
        category: e.category,
        level: e.category === 'wildfires' ? 3 : e.category === 'volcanoes' ? 3 : 2,
        value: e.magnitude?.value,
        units: e.magnitude?.unit || '',
      }));
  } else if (type === 'earthquakes') {
    evs = (_data.quakes || []).filter(q => q.year === year).map(q => ({
      id: `q-${q.lat}-${q.lon}`, name: q.place || 'Earthquake',
      lat: q.lat, lon: q.lon, year,
      level: calcDangerLevel('earthquakes', q.mag), category: 'earthquakes',
      value: q.mag, units: 'M',
    }));
  }
  return evs.sort((a, b) => b.level - a.level || b.value - a.value).slice(0, limit);
}
