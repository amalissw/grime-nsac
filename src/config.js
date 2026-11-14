/**
 * ALL tunable numbers — change here, never inline.
 */
export const config = {
  // Timing (ms)
  hoverMs: 150,
  panelMs: 300,
  crossfadeMs: 600,
  flyToMs: 1200,
  autoRotateResumeMs: 8000,

  // Globe
  globeRadiusPx: 1,
  atmosphereAltitude: 0.18,
  cloudsRadius: 1.006,
  cloudsOpacity: 0.35,
  cloudsOpacityWithLayer: 0.12,
  cloudsRotateSpeed: 0.004,
  autoRotateSpeed: 0.03,

  // Segments
  globeSegmentsPhone: 64,
  globeSegmentsDesktop: 128,

  // Camera
  cameraDistMin: 1.6,
  cameraDistMax: 4.5,

  // TrackballControls
  rotateSpeed: 2.2,
  dynamicDampingFactor: 0.12,

  // Lighting
  ambientIntensity: 0.9,
  directionalIntensity: 1.1,

  // Year range
  yearMin: 2000,
  yearMax: 2024,
  defaultYear: 2019,
  yearPlayIntervalMs: 2500,

  // Temperature layer
  tempMin: -2,
  tempMax: 4,
  tempColumnMinAnomaly: 1.0,
  tempColumnScale: 0.028,  // per °C above 0.8
  tempOverlayOpacity: 0.72,
  tempOverlayRadius: 1.004,

  // CO2
  co2Clear: 370,    // ppm → clear atmosphere
  co2Hazy: 425,     // ppm → hazy atmosphere
  co2AltMin: 0.16,
  co2AltMax: 0.24,

  // Disaster layers
  fireRadiusKm: 500,
  fireNearbyRadiusKm: 300,
  stormNearbyRadiusKm: 300,
  quakeNearbyRadiusKm: 300,
  quakeMinMag: 5.5,

  // Danger thresholds (temperature)
  tempL1: 0.5,
  tempL2: 1.0,
  tempL3: 1.5,
  tempL4: 2.5,

  // Danger thresholds (CO2)
  co2L1: 380,
  co2L2: 395,
  co2L3: 410,
  co2L4: 420,

  // Audio
  masterVolume: -12,
  masterCompressorThreshold: -24,
  masterCompressorRatio: 3,
  masterLimiterThreshold: -1,
  reverbDecay: 3.5,
  reverbWet: 0.18,
  duckDb: -14,
  duckAttackMs: 150,
  duckReleaseMs: 400,
  maxVoices: 8,

  // Listen loop
  listenIntervalMs: 125,
  listenFadeMs: 400,

  // Continents page
  continentBarMs: 2500,  // 1 year = 2.5s
  continentBpm: 96,

  // Mic button
  micButtonPx: 76,
  micSilenceTimeoutMs: 1500,
  micMaxMs: 10000,

  // Gemini
  geminiTextModel: 'gemini-2.5-flash',
  geminiTtsModel: 'gemini-2.5-flash-preview-tts',
  geminiDefaultVoice: 'Kore',
  geminiTemperature: 0.4,
  geminiMaxOutputTokens: 256,
  geminiTimeoutMs: 10000,
  geminiMaxToolRounds: 3,
  geminiMaxToolCallsPerRound: 4,
  assistantEndpoint: null,  // optional Vercel proxy URL

  // Ocean bounding boxes for naming (lon_min, lat_min, lon_max, lat_max)
  oceanBoxes: [
    { name: 'Pacific Ocean', bbox: [-180, -60, -80, 60] },
    { name: 'Atlantic Ocean', bbox: [-80, -60, 20, 60] },
    { name: 'Indian Ocean', bbox: [20, -60, 100, 30] },
    { name: 'Arctic Ocean', bbox: [-180, 60, 180, 90] },
    { name: 'Southern Ocean', bbox: [-180, -90, 180, -60] },
  ],

  // Major eruption list (volcano Danger L5)
  majorEruptions: ['Hunga Tonga', 'Hunga Ha\'apai'],

  // Volcano Danger L4 threshold (events per year)
  volcanoL4Events: 2,

  // Voices
  geminiVoices: ['Kore', 'Puck', 'Charon', 'Aoede'],

  // Birds formula constants (continents page)
  birdsMax: 8,
  birdsTempCoeff: 2.2,
  birdsCo2Coeff: 3,
  birdsCo2Ref: 370,
  birdsCo2Range: 55,

  // UI
  toastDurationMs: 3000,
  infoCardDoubleTabMs: 300,
  gestureMovePx: 8,
  gestureLongPressMs: 450,
  gestureDoubleTapMs: 300,
};

// Continent → musical key
export const CONTINENT_KEYS = {
  africa: 'D',
  asia: 'E',
  europe: 'G',
  northAmerica: 'C',
  southAmerica: 'A',
  oceania: 'F',
};

// Danger Level colors
export const DANGER_COLORS = ['#22C55E', '#A3E635', '#FACC15', '#F97316', '#DC2626'];
