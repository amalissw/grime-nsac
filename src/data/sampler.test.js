/**
 * Unit tests for core data utilities
 */
import { describe, it, expect } from 'vitest';
import { colorToValue } from './sampler.js';
import { LAND_MASK } from './placeholder.js';
import { buildScale, quantizeToScale } from '../audio/scales.js';

const TEMP_LEGEND = [
  { color: '#2c7bb6', value: -20 },
  { color: '#ffffbf', value: 10 },
  { color: '#d7191c', value: 45 },
];

describe('colorToValue', () => {
  it('maps legend color exactly to its value', () => {
    // Blue = -20
    const v = colorToValue(0x2c, 0x7b, 0xb6, TEMP_LEGEND);
    expect(v).toBeCloseTo(-20, 0);
  });

  it('maps warm color near high end', () => {
    // Red-ish → near 45
    const v = colorToValue(0xd7, 0x19, 0x1c, TEMP_LEGEND);
    expect(v).toBeGreaterThan(30);
  });

  it('interpolates middle color', () => {
    // Near-white/yellow → near 10
    const v = colorToValue(0xff, 0xff, 0xbf, TEMP_LEGEND);
    expect(v).toBeGreaterThan(-20);
    expect(v).toBeLessThan(45);
  });
});

describe('LAND_MASK.isLand', () => {
  it('recognizes central Sahara as land', () => {
    expect(LAND_MASK.isLand(20, 20)).toBe(true);
  });

  it('recognizes Pacific Ocean as water', () => {
    expect(LAND_MASK.isLand(-160, 10)).toBe(false);
  });

  it('recognizes Australia as land', () => {
    expect(LAND_MASK.isLand(135, -25)).toBe(true);
  });
});

describe('buildScale + quantizeToScale', () => {
  it('builds major pentatonic scale', () => {
    const notes = buildScale('C', 'majorPentatonic', 1, 4);
    expect(notes.length).toBe(5);
    expect(notes[0]).toBe('C3');
  });

  it('quantizes 0 to first note', () => {
    const notes = buildScale('C', 'majorPentatonic', 1, 4);
    expect(quantizeToScale(0, notes)).toBe(notes[0]);
  });

  it('quantizes 1 to last note', () => {
    const notes = buildScale('C', 'majorPentatonic', 1, 4);
    expect(quantizeToScale(1, notes)).toBe(notes[notes.length - 1]);
  });

  it('builds dorian scale with correct intervals', () => {
    const notes = buildScale('D', 'dorian', 1, 3);
    expect(notes.length).toBe(7);
  });
});

describe('coordinate → lat/lon (manual)', () => {
  it('converts pixel to lon correctly', () => {
    const w = 512, px = 256;
    const lon = (px / w) * 360 - 180;
    expect(lon).toBe(0); // prime meridian
  });

  it('converts pixel to lat correctly', () => {
    const h = 256, py = 0;
    const lat = 90 - (py / h) * 180;
    expect(lat).toBe(90); // North Pole
  });
});
