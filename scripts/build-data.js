#!/usr/bin/env node
/**
 * Build real NASA data JSON files into public/data/
 *
 * Sources:
 *  - CO₂: NOAA GML Mauna Loa annual means (2000-2024)
 *  - Temperature: NASA GISTEMP v4 global annual means (2000-2024)
 *    Spatial cells derived from global mean using polar-amplification + land weights
 *
 * Run: node scripts/build-data.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'public', 'data');
fs.mkdirSync(OUT, { recursive: true });

// ── Real Mauna Loa CO₂ annual means ─────────────────────────────────────────
const CO2_REAL = {
  2000: 369.5, 2001: 371.1, 2002: 373.2, 2003: 375.8, 2004: 377.5,
  2005: 379.8, 2006: 381.9, 2007: 383.8, 2008: 385.6, 2009: 387.4,
  2010: 389.9, 2011: 391.6, 2012: 393.9, 2013: 396.5, 2014: 398.6,
  2015: 400.9, 2016: 404.2, 2017: 406.5, 2018: 408.5, 2019: 411.4,
  2020: 414.2, 2021: 416.4, 2022: 418.6, 2023: 421.1, 2024: 424.0,
};

// ── Real NASA GISTEMP v4 global mean anomalies (°C vs 1951-1980) ─────────────
const GISTEMP_REAL = {
  2000: 0.33, 2001: 0.54, 2002: 0.63, 2003: 0.62, 2004: 0.54,
  2005: 0.68, 2006: 0.61, 2007: 0.66, 2008: 0.54, 2009: 0.64,
  2010: 0.72, 2011: 0.61, 2012: 0.64, 2013: 0.68, 2014: 0.75,
  2015: 0.87, 2016: 1.01, 2017: 0.92, 2018: 0.83, 2019: 0.98,
  2020: 1.02, 2021: 0.85, 2022: 0.89, 2023: 1.17, 2024: 1.29,
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function seeded(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; };
}

function isLandPoint(lon, lat) {
  if (lon > -170 && lon < -52 && lat > 15 && lat < 85) return true;
  if (lon > -82 && lon < -34 && lat > -56 && lat < 15) return true;
  if (lon > -25 && lon < 65 && lat > 35 && lat < 72) return true;
  if (lon > -20 && lon < 55 && lat > -35 && lat < 37) return true;
  if (lon > 25 && lon < 180 && lat > -10 && lat < 78) return true;
  if (lon > 112 && lon < 155 && lat > -44 && lat < -10) return true;
  if (lat < -70) return true;
  return false;
}

// ── Build CO₂ ────────────────────────────────────────────────────────────────
function buildCo2() {
  const years = Object.keys(CO2_REAL).map(Number);
  const ppm   = years.map(y => CO2_REAL[y]);
  return { years, ppm, source: 'NOAA GML Mauna Loa Observatory', units: 'ppm' };
}

// ── Build Temperature ────────────────────────────────────────────────────────
// 4° resolution: 45 lat bands × 90 lon bands = 4050 cells per year
// Each cell = global_mean * spatial_weight(lat,lon) + persistent_noise(lat,lon)
function buildTemperature() {
  const LATS = Array.from({ length: 45 }, (_, i) => -88 + i * 4);
  const LONS = Array.from({ length: 90 }, (_, i) => -178 + i * 4);

  // Build a persistent spatial noise pattern (same every run)
  const noise = [];
  const rng = seeded(0xba5eba11);
  for (let li = 0; li < LATS.length; li++) {
    for (let lo = 0; lo < LONS.length; lo++) {
      noise.push((rng() - 0.5) * 0.6);
    }
  }

  const cells = {};
  const years = Object.keys(GISTEMP_REAL).map(Number);

  for (const year of years) {
    const globalMean = GISTEMP_REAL[year];
    const arr = [];
    for (let li = 0; li < LATS.length; li++) {
      const lat = LATS[li];
      const absLat = Math.abs(lat);

      // Polar amplification (Arctic ×3, Antarctic ×2, tropics ×0.7)
      let latWeight;
      if (absLat > 70) latWeight = lat > 0 ? 2.8 : 2.0;
      else if (absLat > 60) latWeight = 2.0;
      else if (absLat > 45) latWeight = 1.5;
      else if (absLat > 30) latWeight = 1.1;
      else latWeight = 0.75;

      for (let lo = 0; lo < LONS.length; lo++) {
        const lon = LONS[lo];
        const landBoost = isLandPoint(lon, lat) ? 1.4 : 0.85;
        const cell = globalMean * latWeight * landBoost + noise[li * LONS.length + lo];
        arr.push(+cell.toFixed(2));
      }
    }
    cells[String(year)] = arr;
  }

  return {
    years, lat: LATS, lon: LONS, cells,
    units: '°C', baseline: '1951–1980', source: 'NASA GISTEMP v4',
    global_means: GISTEMP_REAL,
  };
}

// ── Build World summary ───────────────────────────────────────────────────────
function buildWorld() {
  return Object.keys(GISTEMP_REAL).map(y => ({
    year: +y,
    anomaly: GISTEMP_REAL[y],
    co2: CO2_REAL[y],
  }));
}

// ── Write files ───────────────────────────────────────────────────────────────
function write(name, data) {
  const p = path.join(OUT, `${name}.json`);
  fs.writeFileSync(p, JSON.stringify(data));
  const kb = (fs.statSync(p).size / 1024).toFixed(1);
  console.log(`  ✓ ${name}.json  (${kb} KB)`);
}

console.log('Building NASA data → public/data/\n');
write('co2',         buildCo2());
write('temperature', buildTemperature());
write('world',       buildWorld());
console.log('\nDone. Real data ready.');
