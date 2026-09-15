#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   tools/build-preview.mjs

   Bundles the artboard and everything it needs into one self-contained
   `preview.html` that opens straight from disk — no server, no build step for
   whoever receives it.

   `Energy News Landing.dc.html` stays the single source of truth. This script
   only inlines around it:

     _ds/…/styles.css        design tokens (for the preview chrome)
     _ds/…/_ds_bundle.js     slot contract + formatters
     support.js              the standalone .dc.html runtime
     image-slot.js           the media import layer
     app.config.json         brand + live data app link -> component props
     assets/manifest.json    which slots are filled

   The artboard is embedded as an iframe srcdoc so the preview can resize the
   viewport around it — the responsive behaviour is what you actually need to
   check before handing a landing page over.

     node tools/build-preview.mjs
   --------------------------------------------------------------------------- */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const DS = '_ds/organic-0b63b13d-34bf-4cfa-86d1-fa35ca34c91c';
const ARTBOARD = 'Energy News Landing.dc.html';

const artboard = read(ARTBOARD);
const supportJs = read('support.js');
const slotJs = read('image-slot.js');
const bundleJs = read(`${DS}/_ds_bundle.js`);
const tokensCss = read(`${DS}/styles.css`);
const config = JSON.parse(read('app.config.json'));
const manifest = JSON.parse(read('assets/manifest.json'));

/* --- component props, from app.config.json ------------------------------- */

const props = {
  liveDataUrl: config.liveDataApp?.url ?? '',
  liveDataLabel: config.liveDataApp?.label ?? 'Open the live data app',
  accent: config.theme?.accent ?? '#e7963d',
  density: config.theme?.density ?? 'editorial',
  showMarketRail: config.theme?.showMarketRail ?? true
};

/* --- build the standalone artboard document ------------------------------ */

/* An inlined <script> ends at the first "</script" in its text, wherever that
   appears - support.js quotes that very tag in its own header comment. Escaping
   the slash keeps the sequence away from the HTML parser and changes nothing for
   JavaScript: inside a string literal the escape is redundant but harmless, and a
   comment does not care either way. */
const CLOSE_TAG = /<\/(script)/gi;
const inlineJs = (js) =>
  '<' + 'script>' + js.replace(CLOSE_TAG, '<\\/$1') + '<' + '/script>';

const inlineHead = [
  inlineJs(bundleJs),
  inlineJs(
    'window.ED_PROPS = ' + JSON.stringify(props) + ';\n' +
    'window.ED_MANIFEST = ' + JSON.stringify({ assets: manifest.assets ?? {} }) + ';'
  ),
  inlineJs(supportJs)
].join('\n');

let doc = artboard.replace(
  /<script src="\.\/support\.js"><\/script>/,
  () => inlineHead
);
if (doc === artboard) {
  console.error('! the support.js head line was not found in ' + ARTBOARD + ' — keep it verbatim');
  process.exit(1);
}

// image-slot.js runs after support.js has rendered: its DOMContentLoaded
// listener is registered second, so it sees the finished DOM.
doc = doc.replace('</body>', inlineJs(slotJs) + '\n</body>');

/* --- wrap it in the preview chrome --------------------------------------- */

// The artboard rides to the browser as base64 inside a text/plain block.
// Escaping it as text would mean un-escaping it on the other side, which would
// also undo the "</script" sequences inlineJs() deliberately hid. Base64 carries
// no such sequence to begin with.
const parked = Buffer.from(doc, 'utf8').toString('base64');

const filledCount = Object.keys(manifest.assets ?? {}).length;
const slotCount = (artboard.match(/data-slot="/g) ?? []).length;

const preview = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Energy News Landing — preview</title>
<style>
${tokensCss}

/* --- preview chrome (not part of the design) --------------------------- */
html, body { margin: 0; height: 100%; background: #0d0b09; }
body { display: flex; flex-direction: column; font-family: var(--body); color: var(--paper); }

.pv-bar {
  display: flex; flex-wrap: wrap; align-items: center; gap: 20px;
  padding: 10px 18px; background: #14110e;
  border-bottom: 1px solid rgba(246,243,238,0.14);
}
.pv-title { font-family: var(--display); font-size: 16px; font-weight: 600; letter-spacing: -0.01em; }
.pv-meta { font-family: var(--mono); font-size: 11px; letter-spacing: 0.06em; color: var(--muted-on-paper); }
.pv-spacer { flex-grow: 1; }
.pv-group { display: flex; gap: 6px; }
.pv-btn {
  min-height: 30px; padding: 0 12px;
  background: transparent; color: var(--muted-on-ink);
  border: 1px solid rgba(246,243,238,0.14); border-radius: 3px;
  font-family: var(--mono); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;
  cursor: pointer;
}
.pv-btn:hover { color: var(--paper); border-color: rgba(246,243,238,0.28); }
.pv-btn[aria-pressed="true"] { color: #14110e; background: var(--thermal); border-color: var(--thermal); }

.pv-stage { flex-grow: 1; overflow: auto; display: flex; justify-content: center; padding: 18px; }
.pv-frame {
  width: 1440px; max-width: 100%; height: 100%; min-height: 600px;
  background: var(--ink); border: 1px solid rgba(246,243,238,0.14); border-radius: 3px;
  transition: width 140ms ease;
}
.pv-frame iframe { display: block; width: 100%; height: 100%; border: 0; border-radius: 2px; }
</style>
</head>
<body>

<div class="pv-bar">
  <span class="pv-title">Energy News Landing</span>
  <span class="pv-meta">${filledCount}/${slotCount} media slots filled &middot; live data app: ${
    props.liveDataUrl ? props.liveDataUrl.replace(/&/g, '&amp;').replace(/</g, '&lt;') : 'not set'
  }</span>
  <span class="pv-spacer"></span>
  <div class="pv-group" role="group" aria-label="Viewport width">
    <button class="pv-btn" type="button" data-w="1440" aria-pressed="true">Desktop</button>
    <button class="pv-btn" type="button" data-w="834" aria-pressed="false">Tablet</button>
    <button class="pv-btn" type="button" data-w="390" aria-pressed="false">Phone</button>
  </div>
</div>

<div class="pv-stage">
  <div class="pv-frame" id="pv-frame"><iframe id="pv-doc" title="Energy News Landing"></iframe></div>
</div>

<script type="text/plain" id="pv-artboard">${parked}</script>

<script>
(function () {
  var raw = atob(document.getElementById('pv-artboard').textContent.trim());
  var bytes = new Uint8Array(raw.length);
  for (var b = 0; b < raw.length; b++) bytes[b] = raw.charCodeAt(b);
  document.getElementById('pv-doc').srcdoc = new TextDecoder('utf-8').decode(bytes);

  var frame = document.getElementById('pv-frame');
  var buttons = document.querySelectorAll('.pv-btn');
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].addEventListener('click', function (e) {
      for (var j = 0; j < buttons.length; j++) buttons[j].setAttribute('aria-pressed', 'false');
      e.currentTarget.setAttribute('aria-pressed', 'true');
      frame.style.width = e.currentTarget.getAttribute('data-w') + 'px';
    });
  }
})();
</script>

</body>
</html>
`;

writeFileSync(join(ROOT, 'preview.html'), preview);
console.log(
  'preview.html written — ' + slotCount + ' media slots, ' + filledCount + ' filled, live data app ' +
  (props.liveDataUrl ? 'set to ' + props.liveDataUrl : 'not set')
);
