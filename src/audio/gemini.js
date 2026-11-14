/**
 * Gemini API integration — natural language climate guide.
 * Key: VITE_GEMINI_KEY in .env.local
 * Model: gemini-2.0-flash
 */
import { state } from '../state.js';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent';

function getKey() {
  return import.meta.env.VITE_GEMINI_KEY || '';
}

function buildPrompt(transcript, ctx) {
  const { layer, year, lat, lon, pointData, language } = ctx;
  const layerName = {
    temperature: 'Surface temperature anomaly',
    co2: 'CO₂ concentration',
    wildfires: 'Wildfire activity',
    storms: 'Tropical storms',
    earthquakes: 'Seismic activity',
    volcanoes: 'Volcanic activity',
  }[layer] || layer;

  const valStr = pointData?.value != null
    ? `${Number(pointData.value).toFixed(1)} ${pointData.units || ''}`
    : 'no data';
  const place  = pointData?.place || (lat && lon ? `${lat.toFixed(1)}°, ${lon.toFixed(1)}°` : 'unknown location');
  const level  = pointData?.level ?? '—';

  const langInstr = language === 'ru' ? 'Reply in Russian.' : language === 'kk' ? 'Reply in Kazakh.' : 'Reply in English.';

  return `You are Earth Jukebox, an AI guide for a NASA climate data explorer app. Keep answers to 2–3 short sentences. Be clear, grounded in real climate science, and conversational. ${langInstr}

Current context:
- Data layer: ${layerName}
- Year: ${year}
- Location: ${place} (lat ${lat?.toFixed(1) ?? '?'}, lon ${lon?.toFixed(1) ?? '?'})
- Value: ${valStr}
- Danger level: ${level}/5

User says: "${transcript}"`;
}

/**
 * Ask Gemini a climate question in context.
 * Returns response text, or null on error/no key.
 */
export async function askGemini(transcript, ctx = {}) {
  const key = getKey();
  if (!key) return null;

  const url = `${API_BASE}?key=${encodeURIComponent(key)}`;

  const payload = {
    contents: [{ parts: [{ text: buildPrompt(transcript, ctx) }] }],
    generationConfig: { maxOutputTokens: 180, temperature: 0.7 },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT',       threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn('[ej] Gemini error', res.status, err.slice(0, 200));
      return null;
    }

    const json = await res.json();
    return json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch (e) {
    console.warn('[ej] Gemini fetch failed', e.message);
    return null;
  }
}

export function isGeminiConfigured() { return Boolean(getKey()); }
