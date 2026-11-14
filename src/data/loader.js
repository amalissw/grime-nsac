/**
 * Data loader: reads manifest.json, falls back to placeholders gracefully
 */
import { PLACEHOLDER_THEMES, PLACEHOLDER_REGIONS } from './placeholder.js';

let manifest = null;
let themes = null;
let regions = null;

export async function loadData() {
  try {
    const res = await fetch('./data/manifest.json');
    if (res.ok) {
      manifest = await res.json();
    }
  } catch {
    manifest = null;
  }

  if (manifest && manifest.themes) {
    // Merge real themes with placeholders for missing ones
    const realIds = new Set(manifest.themes.map(t => t.id));
    themes = [...manifest.themes];
    // Add placeholder themes not covered by manifest
    for (const pt of PLACEHOLDER_THEMES) {
      if (!realIds.has(pt.id)) themes.push(pt);
    }
  } else {
    themes = PLACEHOLDER_THEMES;
  }

  // Load regions
  try {
    if (manifest && manifest.regions) {
      const res = await fetch(`./data/${manifest.regions}`);
      if (res.ok) regions = await res.json();
    }
  } catch {}
  if (!regions) regions = PLACEHOLDER_REGIONS;

  return { themes, regions };
}

export function getThemes() { return themes || PLACEHOLDER_THEMES; }
export function getRegions() { return regions || PLACEHOLDER_REGIONS; }

/** Render a frame to a canvas and return the canvas */
export async function getFrameCanvas(theme, frameIndex, w = 512, h = 256) {
  const frame = theme.frames[frameIndex];
  if (!frame) return null;

  // If frame has a renderFn (placeholder), use it
  if (frame.renderFn) {
    const canvas = document.createElement('canvas');
    frame.renderFn(canvas, w, h);
    return canvas;
  }

  // Load from image file
  if (frame.image) {
    return loadImageToCanvas(frame.image, w, h);
  }

  return null;
}

async function loadImageToCanvas(src, w, h) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas);
    };
    img.onerror = () => resolve(null);
    img.src = `./data/${src}`;
  });
}
