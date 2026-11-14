# Earth Jukebox: Touch & Hear
**NASA Space Apps Challenge 2026 — The Earth Information Jukebox**

Transform NASA Earth visualization frames into music. Touch the map to hear the data: oceans drone, land plucks, coastlines click, anomalies dissonant. Fully accessible: works blind with the Guide mode beacon system.

## Run locally

```bash
npm install
npm run dev
```

For phone testing on the same Wi-Fi:
```bash
npm run dev -- --host
# Open http://192.168.x.x:5173 in Chrome on Android
```

## Deploy (GitHub Pages)

Push to `main` — GitHub Actions builds and deploys automatically.
The site must be served over HTTPS for vibration and Web Speech to work on Android.

## Add real NASA data

See [`public/data/README.md`](public/data/README.md) for step-by-step instructions.
Short version: drop PNGs in `public/data/<theme>/`, update `manifest.json`.

## Run tests

```bash
npm test
```

---

## Sound design

### Philosophy
Every audible parameter is driven by data. Same pixel colour → same sound, every time. No random elements without a fixed seed.

### Roles and timbres

| Role | Instrument | Why |
|---|---|---|
| **Ocean** | FM synth pad with LFO (0.1 Hz), low-pass filter | Slow, continuous, like water. Filter frequency rises with latitude (colder = brighter). |
| **Land** | PluckSynth (marimba/koto) | Short, pitched, distinct from ocean. Easy to distinguish on first listen. |
| **Fire / bright pixels** | NoiseSynth + bandpass 2 kHz | Crackle texture → matches intuition of fire. Density of hot pixels drives rate. |
| **Anomaly** | Quiet tritone (Aug 4th) | Tritone = tension in Western music. Played quietly so it doesn't overwhelm, but unmissable to trained ears. |
| **Coastline** | MembraneSynth 25 ms click | Tactile, dry, unambiguous transition marker. Screen reader users hear "edge" on every land/ocean crossing. |
| **Guide beacon** | Sine bell (overtones 1, ½, ¼) | Pure and clear — always above other sounds in pitch and register. Left/right pan = bearing, pitch = north/south. |
| **Year tick** | MetalSynth very quiet | Subtle metallic tick = "chapter marker" in time. |
| **Year mood** | PolySynth chord I–V / vi–IV | Low global value → stable open fifth. High anomaly year → minor sixth chord with sus2 for maximum unease. |
| **UI** | Quiet sine blip | Screen reader users need audio confirmation of every button press. |

### Scales per theme

| Theme | Key | Scale | Why |
|---|---|---|---|
| Temperature | C | Major pentatonic | Universally readable, warm tones match warm data. |
| Wildfires | A | Minor pentatonic | Minor = danger. Percussion and crackle dominate. |
| Sea ice | D | Dorian | Ambiguous, neither fully major nor minor. Glass-bell timbre suits cold, sparse Arctic. |

### Master chain
`Instrument → Reverb (3s, 25% wet) → Compressor (−18 dB, 4:1) → Limiter (−1 dB) → Volume (−12 dB start) → Output`

Reverb is shared (Tone.Reverb with pre-delay 30ms) to keep CPU low on Android.
Starting volume −12 dB gives headroom for dynamics and protects headphone listeners.
