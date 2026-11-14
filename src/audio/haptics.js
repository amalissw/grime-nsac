/**
 * Haptic feedback with priorities and sound substitutes. Spec §9.7
 */
import { state } from '../state.js';

const PRIORITY = {
  error: 100, quake: 90, level5: 80, level4: 70, micStart: 60,
  select: 50, yearTick: 40, coast: 30, listenStart: 25, level3: 20, level2: 10, level1: 5, start: 5,
};

const PATTERNS = {
  start:      [30],
  select:     [15],
  listenStart:[25],
  level1:     [10],
  level2:     [20],
  level3:     [40],
  level4:     [60, 40, 60],
  level5:     [90, 40, 90, 40, 90],
  quake:      [120],
  coast:      [40],
  yearTick:   [20],
  micStart:   [20],
  micStop:    [10, 40, 10],
  error:      [80, 40, 80],
};

let _currentPriority = -1;
let _timeout = null;

export function vibrate(eventName) {
  if (!state.settings.vibration) return;
  if (!navigator.vibrate) return;

  const prio = PRIORITY[eventName] ?? 0;
  if (prio < _currentPriority) return; // lower priority, skip

  const pattern = PATTERNS[eventName];
  if (!pattern) return;

  const mult = state.settings.vibrationIntensity ?? 1;
  const scaled = pattern.map(v => Math.round(v * mult));

  _currentPriority = prio;
  clearTimeout(_timeout);
  navigator.vibrate(scaled);

  const total = scaled.reduce((a, b) => a + b, 0);
  _timeout = setTimeout(() => { _currentPriority = -1; }, total + 50);
}

export function vibrateLevel(level) {
  vibrate(`level${level}`);
}
