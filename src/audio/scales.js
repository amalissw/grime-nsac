/**
 * Musical scales and chord progressions
 * All notes quantized to the theme's key+scale
 */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const SCALE_INTERVALS = {
  majorPentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
};

const KEY_OFFSETS = {
  C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5,
  'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11,
};

export function buildScale(key, scaleName, octaves = 2, baseOctave = 3) {
  const intervals = SCALE_INTERVALS[scaleName] || SCALE_INTERVALS.majorPentatonic;
  const keyOffset = KEY_OFFSETS[key] || 0;
  const notes = [];

  for (let oct = 0; oct < octaves; oct++) {
    for (const interval of intervals) {
      const midi = 12 * (baseOctave + oct) + keyOffset + interval;
      notes.push(midiToNote(midi));
    }
  }
  return notes;
}

export function midiToNote(midi) {
  const octave = Math.floor(midi / 12) - 1;
  const note = NOTE_NAMES[midi % 12];
  return `${note}${octave}`;
}

export function quantizeToScale(value01, scaleNotes) {
  const idx = Math.floor(value01 * (scaleNotes.length - 1));
  return scaleNotes[Math.max(0, Math.min(scaleNotes.length - 1, idx))];
}

/** Chord progressions based on global value */
export function getChordNotes(globalValue, key, scaleName) {
  const keyOffset = KEY_OFFSETS[key] || 0;
  const baseOctave = 2;

  // Low values → I–V (calm), high → vi–IV (tension)
  if (globalValue < 0.5) {
    // I–V: root, fifth, octave
    return [
      midiToNote(12 * baseOctave + keyOffset),
      midiToNote(12 * baseOctave + keyOffset + 7),
      midiToNote(12 * (baseOctave + 1) + keyOffset),
    ];
  } else {
    // vi–IV with sus2 tension
    const tension = (globalValue - 0.5) * 2;
    return [
      midiToNote(12 * baseOctave + keyOffset + 9),
      midiToNote(12 * baseOctave + keyOffset + 5),
      midiToNote(12 * baseOctave + keyOffset + (tension > 0.7 ? 2 : 7)), // sus2 at high tension
    ];
  }
}
