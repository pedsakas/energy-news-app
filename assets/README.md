# assets/

Everything the landing page displays — pictures, graphs, maps, video — arrives
through one mechanism: a **slot**.

## The slots

Slots are declared once, in
`_ds/organic-0b63b13d-34bf-4cfa-86d1-fa35ca34c91c/_ds_bundle.js`:

| id               | kind  | ratio | min width | where it appears                |
|------------------|-------|-------|-----------|---------------------------------|
| `masthead-logo`  | logo  | 4:1   | 480 px    | header (optional — replaces the wordmark) |
| `lead-photo`     | photo | 16:9  | 2000 px   | hero                            |
| `story-1-chart`  | chart | 4:3   | 1200 px   | secondary story 1               |
| `story-2-photo`  | photo | 4:3   | 1200 px   | secondary story 2               |
| `story-3-photo`  | photo | 4:3   | 1200 px   | secondary story 3               |
| `prices-chart`   | chart | 16:9  | 1800 px   | data panel (ships with a drawn sample) |
| `flows-map`      | map   | 4:3   | 1400 px   | data panel (ships with a drawn sample) |

## Filling one

1. Put the file in `assets/media/` (or point at a URL).
2. Add an entry to `manifest.json` under `assets`, keyed by the slot id.
3. Rebuild the preview: `node tools/build-preview.mjs`

No markup changes. An unfilled slot renders a labelled placeholder showing its
id and the source spec it wants, so the layout still reads.

## The four source shapes

```jsonc
// a file — raster or SVG
{ "type": "image", "src": "media/lead-photo.jpg", "alt": "…" }

// a live graph or slippy map from the data app, in a sandboxed iframe
{ "type": "embed", "src": "https://host/embed/day-ahead?zones=DE,FR,NL" }

// a vector export pasted inline — stays crisp in PNG/PDF export
{ "type": "inline", "svg": "<svg …>…</svg>" }

// video, with a poster frame
{ "type": "video", "src": "media/clip.mp4", "poster": "media/clip-poster.jpg" }
```

`embed` is what connects a slot to the live data app: point it at the app's
embed endpoint and the panel becomes the live chart or map rather than a picture
of one.

## In the design canvas

The canvas artboard cannot read this directory — a canvas stores its images
inside the published page. To put a real picture on the canvas, pass it when
seeding:

```bash
node "<design skill dir>/seed-canvas.mjs" \
  --template "<design skill dir>/payload.template.html" \
  --out "energy-news-landing.html" --title "Energy News Landing" \
  --artboard "Energy News Landing.dc.html" \
  --image assets/media/lead-photo.jpg \
  --canvas canvas.json
```

then reference it in the artboard by bare filename (`<img src="lead-photo.jpg">`),
replacing that slot's placeholder block. Keep each image under ~70 KB.
