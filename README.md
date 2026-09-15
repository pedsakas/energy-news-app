# Energy News Landing

An energy-sector news landing page: one design-canvas artboard, a media import
layer for pictures, graphs and maps, a configurable link to a live data app, and
a standalone `.html` preview.

**Live canvas:** https://claude.ai/artifact/YT4ihrJkjhR7M95i2BKD4C

## What is here

| path | what it is |
|---|---|
| `Energy News Landing.dc.html` | **The design.** A Claude Design Component artboard — layout, copy, tokens and the sample chart/map geometry. Single source of truth. |
| `preview.html` | **The preview.** Self-contained, opens from disk, no server. Generated — do not hand-edit. |
| `tools/build-preview.mjs` | Builds `preview.html` from everything below. |
| `canvas.json` | Canvas layout: frame size, annotations, launch view. |
| `support.js` | Standalone runtime for `.dc.html` (the canvas editor substitutes its own). |
| `image-slot.js` | The media import layer — resolves slots against the manifest. |
| `app.config.json` | Brand, live data app URL, theme. Feeds the artboard's props. |
| `assets/manifest.json` | Which slot holds which picture, graph, map or video. |
| `assets/README.md` | The slot table and the four source shapes. |
| `_ds/organic-…/styles.css` | Design tokens (palette, type ramp, spacing). |
| `_ds/organic-…/_ds_bundle.js` | Slot contract, series palette, formatters. |

## Preview it

```bash
node tools/build-preview.mjs
open preview.html          # or xdg-open / just double-click it
```

The preview has a desktop / tablet / phone switcher and reports how many media
slots are filled.

## Import pictures, graphs and maps

Every visual is a **slot**. Drop the asset in `assets/media/`, add one entry to
`assets/manifest.json` under the slot id, rebuild. No markup changes.

```jsonc
"assets": {
  "lead-photo":   { "type": "image", "src": "media/lead.jpg", "alt": "…" },
  "prices-chart": { "type": "embed", "src": "https://host/embed/day-ahead?zones=DE,FR,NL" },
  "flows-map":    { "type": "embed", "src": "https://host/embed/flows?region=nwe" }
}
```

Four shapes — `image`, `embed` (a live graph or map from the data app, in a
sandboxed iframe), `inline` (pasted SVG), `video`. Six slots are placed:
`lead-photo`, `story-1-chart`, `story-2-photo`, `story-3-photo`, `prices-chart`,
`flows-map`. Full table in [`assets/README.md`](assets/README.md).

The two data panels ship with a **drawn sample** — a 30-day day-ahead price chart
and a schematic flow map — so the page reads before any asset exists. Filling
their slots replaces the drawing.

## Connect the live data app

```jsonc
// app.config.json
"liveDataApp": { "url": "https://your-data-app.example", "label": "Open the live data app" }
```

Then `node tools/build-preview.mjs`. On the canvas, set the `liveDataUrl` tweak
above the artboard instead.

Until it has a value the page says so rather than pretending: the market rail is
labelled `SAMPLE FEED`, the call to action points at an anchor, and the band at
the foot shows `[SET liveDataUrl TO YOUR LIVE DATA APP]`. Setting it flips the
rail to `LIVE`, points both calls to action at the app, and links it in the footer.

## Update the canvas

```bash
D="<the design skill's directory>"
node "$D/seed-canvas.mjs" --template "$D/payload.template.html" \
  --out energy-news-landing.html --title "Energy News Landing" \
  --artboard "Energy News Landing.dc.html" --canvas canvas.json
```

Then republish `energy-news-landing.html` to the artifact URL above. The seeded
file is generated and git-ignored.

## Notes

- **Copy is drafted and illustrative.** Every hard fact is bracketed —
  `[XX]%`, `[MONTH]`, `[REPORTER NAME]`, `[YEAR]`, `[CITY]` — so nothing reads as
  a claim until it is filled in. Market numbers are sample values, labelled as
  such on the page.
- **"Energy Desk" is a placeholder masthead.** Replace it in the artboard and in
  `app.config.json`.
- **Tokens live in two places.** `_ds/organic-…/styles.css` is the source of
  truth; the artboard mirrors them in its `<helmet>` block because a canvas
  artboard runs in a sandboxed iframe that cannot fetch sibling stylesheets.
  Change both together.
- **`_ds/organic-0b63b13d-…/`** matches the path the Claude Design project uses.
  These files were written here, not imported — the design project was not
  reachable from this session. Reconcile them if you later sync the real project.
- Fonts (Newsreader, IBM Plex Sans, IBM Plex Mono) load from Google Fonts. PNG/PDF
  export from the canvas falls back to the local stacks.
