# Media slots

Every picture, graph, map and video on the site is a **slot**: the markup
reserves the space and names the slot, and nothing in the markup knows where the
asset lives. To fill one, add an entry to [`manifest.json`](manifest.json) under
the slot id and rebuild with `node tools/build-site.mjs`.

## The slots

| id | kind | ratio | min width | where it appears |
|---|---|---|---|---|
| `masthead-logo` | logo | 4:1 | 480px | Optional. Replaces the wordmark set in type. |
| `finland-photo` | photo | 16:9 | 2000px | Landing hero, and the Finland article lead. |
| `finland-chart` | chart | 16:9 | 1800px | Finland article — day-ahead against balancing energy. |
| `lithuania-chart` | chart | 4:3 | 1400px | Landing feature, and the Lithuania article lead. |
| `lithuania-grid-chart` | chart | 16:9 | 1800px | Lithuania article — connection queue against firm capacity. |
| `prices-chart` | chart | 16:9 | 1800px | Landing data panel. Ships with a drawn sample. |
| `flows-map` | map | 4:3 | 1400px | Landing data panel. Ships with a drawn sample. |

The contract is declared once, in
`_ds/organic-0b63b13d-34bf-4cfa-86d1-fa35ca34c91c/_ds_bundle.js`. A slot used on
two pages at different ratios is fine — the image is cropped to fit each.

An unfilled slot renders a designed placeholder carrying its id, kind and the
source spec it wants, so an unfinished page reads as a layout rather than as a
hole. A slot that already contains drawn content — the sample price chart and
corridor map do — keeps it until the manifest overrides it.

## The four source shapes

```jsonc
// a raster or SVG file under assets/
{ "type": "image", "src": "media/finland-lead.jpg", "alt": "…" }

// a live graph or slippy map from the data app, in a sandboxed iframe
{ "type": "embed", "src": "https://host/embed/day-ahead?zones=FI,SE3,LT", "alt": "…" }

// a vector export pasted straight in — stays crisp in PNG/PDF export
{ "type": "inline", "svg": "<svg viewBox=\"0 0 400 300\">…</svg>" }

// a clip, with a poster frame
{ "type": "video", "src": "media/clip.mp4", "poster": "media/clip-poster.jpg" }
```

Paths are relative to `assets/` unless they start with `http`, `/` or `data:`.
Pages that are not at the site root set `window.ED_ASSET_BASE`, so one path works
from every page.

Always set `alt`. These are charts and maps carrying the argument of the piece;
a reader on a screen reader needs the finding, not the filename.
