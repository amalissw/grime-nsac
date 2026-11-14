/**
 * Procedural placeholder data: 3 themes × 8 frames
 * Generates realistic NASA-like visualizations on canvas
 */

// Simple seeded pseudo-random
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 4294967296;
  };
}

// Simplex-like noise using hash
function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = ((h ^ (h >>> 13)) * 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise2(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  return (
    hash2(ix, iy) * (1 - ux) * (1 - uy) +
    hash2(ix + 1, iy) * ux * (1 - uy) +
    hash2(ix, iy + 1) * (1 - ux) * uy +
    hash2(ix + 1, iy + 1) * ux * uy
  );
}

function fbm(x, y, octaves = 4) {
  let v = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < octaves; i++) {
    v += noise2(x * freq, y * freq) * amp;
    amp *= 0.5; freq *= 2.1;
  }
  return v;
}

// Simplified land mask polygons
const LAND_POLYGONS = [
  // North America
  { minLon: -170, maxLon: -50, minLat: 15, maxLat: 85 },
  // South America
  { minLon: -85, maxLon: -34, minLat: -56, maxLat: 15 },
  // Europe
  { minLon: -25, maxLon: 60, minLat: 35, maxLat: 72 },
  // Africa
  { minLon: -20, maxLon: 55, minLat: -35, maxLat: 37 },
  // Asia main
  { minLon: 25, maxLon: 180, minLat: 0, maxLat: 78 },
  // Australia
  { minLon: 112, maxLon: 155, minLat: -44, maxLat: -10 },
  // Greenland
  { minLon: -73, maxLon: -15, minLat: 60, maxLat: 84 },
  // Antarctica
  { minLon: -180, maxLon: 180, minLat: -90, maxLat: -70 },
];

function isLand(lon, lat) {
  for (const p of LAND_POLYGONS) {
    if (lon >= p.minLon && lon <= p.maxLon && lat >= p.minLat && lat <= p.maxLat) {
      // Add noise to coastlines
      const n = noise2(lon * 0.3, lat * 0.3) * 15 - 7;
      if (lon + n >= p.minLon && lon + n <= p.maxLon) return true;
    }
  }
  return false;
}

export const LAND_MASK = { isLand };

// Theme definitions
export const PLACEHOLDER_THEMES = [
  {
    id: 'temperature',
    title: 'Land & Sea Surface Temperature',
    description: 'Global surface temperature anomalies 2000–2024',
    source: 'NASA EIC / MODIS Land Surface Temperature (placeholder)',
    units: '°C',
    key: 'C',
    scale: 'majorPentatonic',
    anomalyThreshold: 35,
    legend: [
      { color: '#2c7bb6', value: -20 },
      { color: '#abd9e9', value: -5 },
      { color: '#ffffbf', value: 10 },
      { color: '#fdae61', value: 25 },
      { color: '#d7191c', value: 45 },
    ],
    frameValueLabel: 'Global anomaly, °C',
    frames: generateTemperatureFrames(),
    isPlaceholder: true,
  },
  {
    id: 'wildfires',
    title: 'Wildfire Activity',
    description: 'Active fire intensity and burn area 2000–2024',
    source: 'NASA EIC / MODIS Active Fire (placeholder)',
    units: 'FRP MW',
    key: 'A',
    scale: 'minorPentatonic',
    anomalyThreshold: 0.6,
    legend: [
      { color: '#000000', value: 0 },
      { color: '#8b0000', value: 0.2 },
      { color: '#ff4500', value: 0.5 },
      { color: '#ff8c00', value: 0.8 },
      { color: '#ffff00', value: 1.0 },
    ],
    frameValueLabel: 'Global fire index',
    frames: generateWildfireFrames(),
    isPlaceholder: true,
  },
  {
    id: 'sea-ice',
    title: 'Arctic Sea Ice Extent',
    description: 'Arctic sea ice concentration and extent 2000–2024',
    source: 'NASA EIC / NSIDC Sea Ice Index (placeholder)',
    units: '% concentration',
    key: 'D',
    scale: 'dorian',
    anomalyThreshold: -20,
    legend: [
      { color: '#001f3f', value: 0 },
      { color: '#0066cc', value: 30 },
      { color: '#66b2ff', value: 60 },
      { color: '#cce5ff', value: 85 },
      { color: '#ffffff', value: 100 },
    ],
    frameValueLabel: 'Arctic ice area, million km²',
    frames: generateSeaIceFrames(),
    isPlaceholder: true,
  },
];

function generateTemperatureFrames() {
  const years = [2000, 2003, 2006, 2009, 2012, 2015, 2018, 2024];
  return years.map((year, i) => ({
    label: String(year),
    value: 0.4 + i * 0.12 + noise2(i * 0.5, 0.3) * 0.1,
    renderFn: (canvas, w, h) => renderTemperature(canvas, w, h, year, i),
  }));
}

function generateWildfireFrames() {
  const years = [2000, 2003, 2006, 2009, 2012, 2015, 2018, 2024];
  return years.map((year, i) => ({
    label: String(year),
    value: 0.3 + i * 0.08 + noise2(i * 0.7, 0.9) * 0.05,
    renderFn: (canvas, w, h) => renderWildfires(canvas, w, h, year, i),
  }));
}

function generateSeaIceFrames() {
  const years = [2000, 2003, 2006, 2009, 2012, 2015, 2018, 2024];
  return years.map((year, i) => ({
    label: String(year),
    value: 7.2 - i * 0.35 + noise2(i * 0.4, 0.7) * 0.1,
    renderFn: (canvas, w, h) => renderSeaIce(canvas, w, h, year, i),
  }));
}

function renderTemperature(canvas, w, h, year, frameIndex) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  canvas.width = w; canvas.height = h;
  const img = ctx.createImageData(w, h);
  const warmFactor = frameIndex / 7;

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const lon = (px / w) * 360 - 180;
      const lat = 90 - (py / h) * 180;
      const land = isLand(lon, lat);

      // Base temperature by latitude
      const latTemp = -Math.abs(lat) * 0.6 + 25;
      const noiseVal = fbm(lon * 0.08, lat * 0.08) * 20 - 10;
      let temp = latTemp + noiseVal + warmFactor * 3;

      // Land gets hotter
      if (land) temp += 5 + fbm(lon * 0.15, lat * 0.15) * 10;

      // Clamp and normalize to -20..45
      temp = Math.max(-20, Math.min(45, temp));
      const t = (temp + 20) / 65;

      const c = interpolateLegend(t, [
        [0x2c, 0x7b, 0xb6],
        [0xab, 0xd9, 0xe9],
        [0xff, 0xff, 0xbf],
        [0xfd, 0xae, 0x61],
        [0xd7, 0x19, 0x1c],
      ]);

      const idx = (py * w + px) * 4;
      img.data[idx] = c[0];
      img.data[idx + 1] = c[1];
      img.data[idx + 2] = c[2];
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function renderWildfires(canvas, w, h, year, frameIndex) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  canvas.width = w; canvas.height = h;
  const img = ctx.createImageData(w, h);
  const intensity = 0.3 + frameIndex * 0.1;

  // Fire hotspots (lat/lon)
  const hotspots = [
    { lon: -121, lat: 38, r: 8 },   // California
    { lon: -62, lat: -9, r: 12 },   // Amazon
    { lon: 25, lat: 1, r: 10 },     // Congo
    { lon: 110, lat: -20, r: 8 },   // Australia
    { lon: 50, lat: 60, r: 6 },     // Siberia
    { lon: 20, lat: 15, r: 7 },     // Africa Sahel
    { lon: 100, lat: 15, r: 6 },    // SE Asia
  ];

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const lon = (px / w) * 360 - 180;
      const lat = 90 - (py / h) * 180;
      const land = isLand(lon, lat);

      let fireVal = 0;
      if (land) {
        for (const hs of hotspots) {
          const d = Math.sqrt((lon - hs.lon) ** 2 + (lat - hs.lat) ** 2);
          const r = hs.r * (0.5 + intensity * 0.8);
          if (d < r) {
            const v = (1 - d / r) * intensity;
            fireVal = Math.max(fireVal, v + fbm(px * 0.3, py * 0.3) * 0.2);
          }
        }
      }
      fireVal = Math.max(0, Math.min(1, fireVal));

      const c = fireVal > 0.05
        ? interpolateLegend(fireVal, [[0x8b, 0x00, 0x00], [0xff, 0x45, 0x00], [0xff, 0x8c, 0x00], [0xff, 0xff, 0x00]])
        : [0x05, 0x08, 0x12];

      const idx = (py * w + px) * 4;
      img.data[idx] = c[0];
      img.data[idx + 1] = c[1];
      img.data[idx + 2] = c[2];
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function renderSeaIce(canvas, w, h, year, frameIndex) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  canvas.width = w; canvas.height = h;
  const img = ctx.createImageData(w, h);
  const meltFactor = frameIndex / 7;

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const lon = (px / w) * 360 - 180;
      const lat = 90 - (py / h) * 180;
      const land = isLand(lon, lat);

      // Ocean color base
      let r = 0x00, g = 0x1f, b = 0x3f;
      let alpha = 255;

      if (!land) {
        const absLat = Math.abs(lat);
        // Ice in polar regions
        const iceThreshold = 70 - meltFactor * 15 + fbm(lon * 0.1, lat * 0.1) * 8;
        if (absLat > iceThreshold) {
          const iceConc = Math.min(1, (absLat - iceThreshold) / 20);
          const c = interpolateLegend(iceConc, [
            [0x00, 0x66, 0xcc],
            [0x66, 0xb2, 0xff],
            [0xcc, 0xe5, 0xff],
            [0xff, 0xff, 0xff],
          ]);
          r = c[0]; g = c[1]; b = c[2];
        } else {
          // Ocean depth color by latitude
          const t = (absLat - 0) / 90;
          r = Math.floor(0 + t * 0x00);
          g = Math.floor(0x1f + t * 0x20);
          b = Math.floor(0x3f + t * 0x40);
        }
      } else {
        r = 0x2d; g = 0x3a; b = 0x2d;
      }

      const idx = (py * w + px) * 4;
      img.data[idx] = r;
      img.data[idx + 1] = g;
      img.data[idx + 2] = b;
      img.data[idx + 3] = alpha;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function interpolateLegend(t, colors) {
  t = Math.max(0, Math.min(1, t));
  const n = colors.length - 1;
  const i = Math.min(n - 1, Math.floor(t * n));
  const f = t * n - i;
  const a = colors[i], b = colors[i + 1];
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

export { interpolateLegend };

// Regions stub
export const PLACEHOLDER_REGIONS = [
  { name: 'Siberia', bbox: [60, 50, 180, 78] },
  { name: 'Amazon', bbox: [-80, -20, -44, 10] },
  { name: 'Sahara', bbox: [-18, 15, 55, 35] },
  { name: 'Arctic Ocean', bbox: [-180, 70, 180, 90] },
  { name: 'Pacific Ocean', bbox: [130, -60, -60, 60] },
  { name: 'North America', bbox: [-170, 15, -50, 85] },
  { name: 'Europe', bbox: [-25, 35, 60, 72] },
  { name: 'Africa', bbox: [-20, -35, 55, 37] },
  { name: 'South Asia', bbox: [60, 0, 100, 40] },
  { name: 'Southeast Asia', bbox: [95, -10, 145, 25] },
  { name: 'Australia', bbox: [112, -44, 155, -10] },
  { name: 'Antarctica', bbox: [-180, -90, 180, -60] },
  { name: 'California', bbox: [-125, 32, -113, 42] },
  { name: 'Congo Basin', bbox: [15, -10, 35, 5] },
  { name: 'Greenland', bbox: [-73, 60, -15, 84] },
];
