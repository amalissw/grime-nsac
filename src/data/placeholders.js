/**
 * Deterministic placeholder data with same schema as real data.
 * Uses seeded LCG so the same call always produces the same numbers.
 * Spec §12 Placeholders
 */

function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; };
}

export const placeholders = {
  temperature() {
    const years = Array.from({ length: 25 }, (_, i) => 2000 + i);
    const latBands = Array.from({ length: 45 }, (_, i) => -88 + i * 4);
    const lonBands = Array.from({ length: 90 }, (_, i) => -178 + i * 4);
    const cells = {};
    for (const year of years) {
      const rng = seeded(year * 31337);
      const anomalyBase = 0.025 * (year - 2000); // warming trend
      const arr = [];
      for (const lat of latBands) {
        const latAmplify = 1 + Math.abs(lat) / 60; // polar amplification
        for (const lon of lonBands) {
          const noise = (rng() - 0.5) * 0.8;
          const v = +(anomalyBase * latAmplify + noise).toFixed(2);
          arr.push(v);
        }
      }
      cells[String(year)] = arr;
    }
    return {
      years, lat: latBands, lon: lonBands, cells,
      units: '°C', baseline: '1951–1980', source: 'Demo data',
    };
  },

  co2() {
    const years = Array.from({ length: 25 }, (_, i) => 2000 + i);
    const ppm = years.map(y => +(369.7 + (y - 2000) * (424.6 - 369.7) / 24).toFixed(1));
    return { years, ppm, source: 'Demo data' };
  },

  events() {
    const rng = seeded(0xdeadbeef);
    const cats = ['wildfires', 'severeStorms', 'volcanoes'];
    const events = [];
    for (let year = 2000; year <= 2024; year++) {
      const n = 5 + Math.floor(rng() * 20);
      for (let i = 0; i < n; i++) {
        const lat = (rng() - 0.5) * 160;
        const lon = (rng() - 0.5) * 360;
        const cat = cats[Math.floor(rng() * cats.length)];
        const month = 1 + Math.floor(rng() * 12);
        events.push({
          id: `demo-${year}-${i}`,
          title: `${cat.replace(/([A-Z])/g,' $1')} Event ${i + 1}`,
          category: cat,
          date: `${year}-${String(month).padStart(2,'0')}-15`,
          lat, lon,
          magnitude: { value: 1 + rng() * 4, unit: 'scale' },
        });
      }
    }
    return events;
  },

  storms() {
    const rng = seeded(0xcafe1234);
    const names = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta'];
    const storms = [];
    for (let year = 2000; year <= 2024; year++) {
      for (let i = 0; i < 8; i++) {
        const baseLat = 10 + rng() * 25;
        const baseLon = -100 + rng() * 120;
        const maxWind = 30 + rng() * 150;
        const pts = [];
        for (let d = 0; d < 10; d++) {
          pts.push([baseLat + d * rng() * 2, baseLon + d * 2, maxWind * (0.5 + rng() * 0.5)]);
        }
        storms.push({ id: `demo-storm-${year}-${i}`, name: names[i], year, maxWind: +maxWind.toFixed(0), points: pts });
      }
    }
    return storms;
  },

  quakes() {
    const rng = seeded(0xbabe5678);
    const quakes = [];
    const regions = [
      [35, 140], [-5, 110], [40, 15], [60, -150], [-35, -70], [0, 30],
    ];
    for (let year = 2000; year <= 2024; year++) {
      for (let i = 0; i < 15; i++) {
        const reg = regions[Math.floor(rng() * regions.length)];
        const lat = reg[0] + (rng() - 0.5) * 20;
        const lon = reg[1] + (rng() - 0.5) * 20;
        const mag = +(5.5 + rng() * 3).toFixed(1);
        quakes.push({ year, lat, lon, mag, place: `Demo region ${i}`, time: `${year}-06-15T00:00:00Z` });
      }
    }
    return quakes;
  },

  seaice() {
    const years = Array.from({ length: 25 }, (_, i) => 2000 + i);
    const extent = years.map(y => +(6.5 - (y - 2000) * 0.07).toFixed(2));
    return { years, extent_million_km2: extent };
  },

  countries() { return []; },

  world(data) {
    const years = Array.from({ length: 25 }, (_, i) => 2000 + i);
    return years.map(year => {
      const co2 = data.co2?.ppm?.[year - 2000] ?? 370;
      return { year, anomaly: +(0.025 * (year - 2000)).toFixed(2), co2 };
    });
  },
};
