/**
 * Sampler: pixel → {isLand, isCoast, value, brightness, lat, lon, region}
 * Reads from pre-cached Uint8ClampedArray, no per-frame getImageData
 */
import { LAND_MASK } from './placeholder.js';
import { getRegions } from './loader.js';

let currentData = null; // { pixels, maskPixels, width, height, theme }
let valueGrid = null;    // Float32Array of mapped values

const COAST_RADIUS = 2; // px for coast detection

export function setCurrent(canvas, maskCanvas, theme) {
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imgData = ctx.getImageData(0, 0, w, h);
  const pixels = imgData.data;

  let maskPixels = null;
  if (maskCanvas) {
    const mctx = maskCanvas.getContext('2d', { willReadFrequently: true });
    maskPixels = mctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;
  }

  currentData = { pixels, maskPixels, width: w, height: h, theme };

  // Pre-compute value grid
  valueGrid = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = pixels[i * 4], g = pixels[i * 4 + 1], b = pixels[i * 4 + 2], a = pixels[i * 4 + 3];
    if (a < 10) {
      valueGrid[i] = NaN;
    } else {
      valueGrid[i] = colorToValue(r, g, b, theme.legend);
    }
  }

  currentData.valueGrid = valueGrid;
}

export function sample(canvasX, canvasY, canvasW, canvasH) {
  if (!currentData) return null;

  const { pixels, maskPixels, width, height, theme, valueGrid } = currentData;

  // Map canvas coords to data pixels
  const px = Math.round((canvasX / canvasW) * width);
  const py = Math.round((canvasY / canvasH) * height);
  const cx = Math.max(0, Math.min(width - 1, px));
  const cy = Math.max(0, Math.min(height - 1, py));

  const lon = (cx / width) * 360 - 180;
  const lat = 90 - (cy / height) * 180;

  const idx = cy * width + cx;
  const pidx = idx * 4;
  const r = pixels[pidx], g = pixels[pidx + 1], b = pixels[pidx + 2];
  const brightness = (r + g + b) / 3 / 255;

  // Land detection
  const landFromMask = maskPixels
    ? (maskPixels[idx * 4] > 128)
    : LAND_MASK.isLand(lon, lat);

  // Coast: check neighbors
  const isCoast = detectCoast(cx, cy, width, height, maskPixels);

  const value = valueGrid ? valueGrid[idx] : colorToValue(r, g, b, theme.legend);
  const isAnomalous = !isNaN(value) && value > theme.anomalyThreshold;

  // Find region
  const region = findRegion(lon, lat);

  return {
    lon, lat, cx, cy,
    isLand: landFromMask,
    isCoast,
    value: isNaN(value) ? null : value,
    brightness,
    region,
    isAnomalous,
    r, g, b,
  };
}

function detectCoast(cx, cy, w, h, maskPixels) {
  if (!maskPixels) return false;
  const center = (cy * w + cx) * 4;
  const isLandCenter = maskPixels[center] > 128;
  for (let dy = -COAST_RADIUS; dy <= COAST_RADIUS; dy++) {
    for (let dx = -COAST_RADIUS; dx <= COAST_RADIUS; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      const nidx = (ny * w + nx) * 4;
      const isLandNeighbor = maskPixels[nidx] > 128;
      if (isLandCenter !== isLandNeighbor) return true;
    }
  }
  return false;
}

// Color → value using legend (nearest-neighbor in RGB space with interpolation)
export function colorToValue(r, g, b, legend) {
  if (!legend || legend.length === 0) return 0;
  if (legend.length === 1) return legend[0].value;

  // Find two nearest legend entries by RGB distance
  let best = 0, bestD = Infinity;
  legend.forEach((entry, i) => {
    const c = hexToRgb(entry.color);
    const d = (r - c.r) ** 2 + (g - c.g) ** 2 + (b - c.b) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  });

  // Interpolate between best and neighbors
  const prev = best > 0 ? best - 1 : best;
  const next = best < legend.length - 1 ? best + 1 : best;

  if (prev === next) return legend[best].value;

  const cp = hexToRgb(legend[prev].color);
  const cn = hexToRgb(legend[next].color);
  const dp = Math.sqrt((r - cp.r) ** 2 + (g - cp.g) ** 2 + (b - cp.b) ** 2);
  const dn = Math.sqrt((r - cn.r) ** 2 + (g - cn.g) ** 2 + (b - cn.b) ** 2);
  const total = dp + dn;
  if (total === 0) return legend[best].value;

  const t = dp / total;
  return legend[prev].value + (legend[next].value - legend[prev].value) * t;
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function findRegion(lon, lat) {
  const regions = getRegions();
  for (const reg of regions) {
    const [w, s, e, n] = reg.bbox;
    if (lon >= w && lon <= e && lat >= s && lat <= n) return reg.name;
  }
  return lat > 0 ? 'Northern Ocean' : 'Southern Ocean';
}

/** Find top N anomaly hotspots in the current frame */
export function findAnomalyBeacons(theme, maxBeacons = 5) {
  if (!currentData || !valueGrid) return [];
  const { width, height } = currentData;
  const threshold = theme.anomalyThreshold;

  // Downsample grid 8x for performance
  const step = 8;
  const candidates = [];
  for (let cy = 0; cy < height; cy += step) {
    for (let cx = 0; cx < width; cx += step) {
      const val = valueGrid[cy * width + cx];
      if (!isNaN(val) && val > threshold) {
        const lon = (cx / width) * 360 - 180;
        const lat = 90 - (cy / height) * 180;
        candidates.push({ cx, cy, lon, lat, val });
      }
    }
  }

  // Cluster: keep maxBeacons furthest apart
  if (candidates.length === 0) return [];
  candidates.sort((a, b) => b.val - a.val);

  const beacons = [candidates[0]];
  for (const c of candidates.slice(1)) {
    if (beacons.length >= maxBeacons) break;
    const tooClose = beacons.some(b =>
      Math.abs(c.lon - b.lon) < 20 && Math.abs(c.lat - b.lat) < 15
    );
    if (!tooClose) beacons.push(c);
  }
  return beacons;
}
