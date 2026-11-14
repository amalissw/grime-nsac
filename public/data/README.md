# How to add NASA data

1. Put your world map image (2:1 ratio, EPSG:4326) in `public/data/<theme>/`
2. Edit `manifest.json`: add an entry to `"themes"` with:
   - `id`, `title`, `description`, `source`, `units`, `key`, `scale`, `anomalyThreshold`
   - `legend`: array of `{color, value}` from low to high value
   - `frames`: array of `{label, image, value}` where image is the path relative to `public/data/`
3. `npm run dev` and check colour → value works in `?dev=1`

## Legend format
Colors should cover the full range displayed in the image. At least 3 points, ideally 5.

## Example
```json
{
  "id": "co2",
  "title": "Atmospheric CO₂",
  "units": "ppm",
  "key": "C",
  "scale": "majorPentatonic",
  "anomalyThreshold": 415,
  "legend": [
    {"color": "#2c7bb6", "value": 370},
    {"color": "#ffffbf", "value": 400},
    {"color": "#d7191c", "value": 430}
  ],
  "frames": [
    {"label": "2000", "image": "co2/co2_2000.png", "value": 369},
    {"label": "2024", "image": "co2/co2_2024.png", "value": 422}
  ]
}
```
