# Boreal Grid

A Nordic and Baltic energy-market analysis site, built from one design-canvas
artboard plus a small static generator. Its job is to turn readers into
newsletter subscribers, and subscribers into buyers of paid research.

**Live canvas:** https://claude.ai/artifact/YT4ihrJkjhR7M95i2BKD4C

```bash
node tools/build-site.mjs
open index.html          # or xdg-open / just double-click it
```

## The site

| page | what it does |
|---|---|
| `index.html` | Landing page. Lead analysis, newsletter signup in the hero, second feature, two data panels, pricing, second signup. Generated from the artboard. |
| `news/finland-cheapest-and-most-volatile.html` | Finland: the cheapest day-ahead market in Europe and the most volatile balancing market, and why those are the same fact. |
| `news/lithuania-renewables-speed-and-capture-prices.html` | Lithuania: build-out speed against grid capacity, and what it does to capture prices. |
| `reports.html` | Paid research — single report, quarterly subscription, commissioned work — plus methodology and FAQ. |
| `preview.html` | The landing page in a desktop / tablet / phone switcher. A design tool, not a page to publish. |

Every page is static HTML. No server, no framework, no build beyond the one
command above.

## What is here

| path | what it is |
|---|---|
| `Energy News Landing.dc.html` | **The landing design.** A Claude Design Component artboard — layout, tokens, sample chart and map geometry. Single source of truth for the landing page. |
| `content/articles.json` | **The articles.** Structured blocks (`h2`, `p`, `list`, `pull`, `note`, `figure`, `table`, `sources`) rendered by the generator. |
| `content/market-sample.json` | The sample market rail, shared by every page. |
| `app.config.json` | Brand, newsletter endpoint, report tiers and prices, live data app URL, theme. |
| `tools/build-site.mjs` | Builds every page above from everything else here. |
| `canvas.json` | Canvas layout: frame size, annotations, launch view. |
| `support.js` | Standalone runtime for `.dc.html` (the canvas editor substitutes its own). |
| `image-slot.js` | The media import layer — resolves slots against the manifest. |
| `site.css` | Page styles for the article and reports pages. Imports the tokens below. |
| `assets/manifest.json` | Which slot holds which picture, graph, map or video. |
| `assets/README.md` | The slot table and the four source shapes. |
| `_ds/organic-…/styles.css` | Design tokens and shared components. |
| `_ds/organic-…/_ds_bundle.js` | Slot contract, series palette, formatters. |

Generated files — `index.html`, `news/*.html`, `reports.html`, `preview.html`,
`sitemap.xml`, `robots.txt` — are committed so the site can be served straight
from the repository. Do not hand-edit them; edit the source and rebuild.

## Connect the newsletter

This is the one thing to do first. Everything else on the page exists to drive it.

```jsonc
// app.config.json
"newsletter": {
  "formAction": "https://your-provider.example/subscribe/your-list",
  "method": "post",
  "emailField": "email"
}
```

`formAction` is the POST endpoint of your provider — Buttondown, Kit, Mailchimp,
Beehiiv, Listmonk, anything that takes a plain form post. `emailField` is the
input name that provider expects.

**Until it is set, every signup form on the site renders inert and says so.**
That is deliberate: a form that posts nowhere silently loses addresses, and you
would not find out until you wondered why nobody subscribed.

## Sell the reports

```jsonc
// app.config.json
"reports": {
  "currency": "EUR",
  "tiers": [
    { "id": "single", "price": "290", "checkoutUrl": "https://buy.stripe.com/…", … }
  ]
}
```

A tier with no `price` shows *Price on request*. A tier with no `checkoutUrl`
falls back to the newsletter as a waitlist and says so on the card. Set both and
the card becomes a real checkout button. Nothing quotes a price you have not set.

## Connect the live data app

```jsonc
"liveDataApp": { "url": "https://your-data-app.example", "label": "Open the live data app" }
```

Until it has a value the market rail is labelled `SAMPLE FEED`, and the call to
action points at the newsletter — "Get told when it opens" — rather than
pretending to be wired up. Setting it flips the rail to `LIVE` and points the
calls to action at the app.

To wire the rail to real numbers, replace `SAMPLE_RAIL` and `SAMPLE_PRICES` in
the artboard's logic block with a fetch in `componentDidMount()` and call
`setState`.

## Set the site URL

```jsonc
"brand": { "siteUrl": "https://borealgrid.example" }
```

This is what produces `<link rel="canonical">`, `og:url`, `sitemap.xml` and
`robots.txt`. Without it they are skipped rather than guessed.

## Import pictures, graphs and maps

Every visual is a **slot**. Drop the asset in `assets/media/`, add one entry to
`assets/manifest.json` under the slot id, rebuild. No markup changes.

```jsonc
"assets": {
  "finland-photo":  { "type": "image", "src": "media/finland-lead.jpg", "alt": "…" },
  "prices-chart":   { "type": "embed", "src": "https://host/embed/day-ahead?zones=FI,SE3,LT" },
  "flows-map":      { "type": "embed", "src": "https://host/embed/flows?region=nordic-baltic" }
}
```

Four shapes — `image`, `embed` (a live graph or map from the data app, in a
sandboxed iframe), `inline` (pasted SVG), `video`. Seven slots are declared;
`finland-photo`, `lithuania-chart`, `prices-chart` and `flows-map` are placed on
the landing page, and the articles add `finland-chart` and `lithuania-grid-chart`.
Full table in [`assets/README.md`](assets/README.md).

The two data panels ship with a **drawn sample** — a 30-day day-ahead chart for
FI, SE3 and LT, and a schematic Nordic–Baltic corridor map — so the page reads
before any asset exists. Filling their slots replaces the drawing.

## Write another article

Add an object to `articles` in `content/articles.json` and rebuild. It gets a
page, a footer link, a "next" link from its sibling, and its own signup block.
Slug becomes the filename.

The landing page shows the first two articles — the first as the hero lead, the
second as the feature below it. Reorder the array to change which.

## Update the canvas

```bash
D="<the design skill's directory>"
node "$D/seed-canvas.mjs" --template "$D/payload.template.html" \
  --out energy-news-landing.html --title "Boreal Grid" \
  --artboard "Energy News Landing.dc.html" --canvas canvas.json
```

Then republish `energy-news-landing.html` to the artifact URL above. The seeded
file is generated and git-ignored.

## Notes on the content

- **The two articles are researched and sourced.** Each ends with a list of the
  sources behind it, and every figure in the prose traces to one of them. The
  Finnish balancing-market and Lithuanian capacity numbers are as published in
  2026; the German capture-factor comparison is flagged in the text as German
  evidence, not a Lithuanian forecast, because it would be misused otherwise.
- **Market figures on the page are sample values**, labelled as such, until the
  live data app is connected. They are shaped to show the real FI–LT spread; they
  are not quotations for any particular day.
- **Bracketed text is unfilled**, on purpose: `[CONTACT EMAIL]`, `[PHOTO CREDIT]`,
  `[CHART SOURCE]`. Nothing reads as a claim until it is filled in.
- **"Boreal Grid" is a working title.** Confirm it is clear of existing marks in
  the markets you publish into before printing it on anything. It is one value in
  `app.config.json`.

## Notes on the code

- **Tokens live in two places.** `_ds/organic-…/styles.css` is the source of
  truth, and `site.css` imports it. The artboard mirrors the same values in its
  `<helmet>` block, because a canvas artboard runs in a sandboxed iframe that
  cannot fetch a sibling stylesheet. Change both together.
- **The build staticises the artboard.** It hoists the `<helmet>` into `<head>`
  so styles do not apply a frame late, and parks the markup as inert text for
  `support.js` to pick up. Attributes still holding a `{{ … }}` are renamed to
  `data-hole-*` before parsing — otherwise SVG tries to read
  `d="{{ chart.gridPath }}"` as a path, fails, and logs it, once per attribute.
- **`_ds/organic-0b63b13d-…/`** matches the path the Claude Design project uses.
  These files were written here, not imported. Reconcile them if you later sync
  the real project.
- Fonts (Newsreader, IBM Plex Sans, IBM Plex Mono) load from Google Fonts. PNG/PDF
  export from the canvas falls back to the local stacks.
