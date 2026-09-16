/* ---------------------------------------------------------------------------
   image-slot.js — the media import layer for the Boreal Grid site.

   Every picture, graph, map and video on the page is a declared SLOT. Markup
   reserves the space and names the slot; nothing in the markup knows where the
   asset lives:

     <figure class="ed-slot" data-slot="finland-photo" data-caption="..."></figure>

   To fill a slot, add an entry to assets/manifest.json keyed by the same id.
   Three source shapes are supported, which is what makes one mechanism cover
   pictures, graphs and maps at once:

     { "type": "image", "src": "media/lead.jpg", "alt": "..." }
       any raster or SVG file under assets/

     { "type": "embed", "src": "https://data.example/chart/de-da?embed=1" }
       a live graph or slippy map served by the live-data app; rendered in a
       sandboxed iframe so a third-party embed cannot reach into this page

     { "type": "inline", "svg": "<svg …>…</svg>" }
       a vector export pasted straight in — stays crisp in PNG/PDF export

   An unfilled slot renders a designed placeholder carrying its id, kind and
   the source spec it wants, so an unfinished page still reads as a layout
   rather than as a hole. A slot that already contains drawn content — the
   sample price chart and flow map do — keeps it until the manifest overrides it.

   Plain <script>, no modules, no build step. Works from file:// as well as
   from a server: when fetch() is unavailable or blocked, the page's own
   window.ED_MANIFEST object is used instead.

   Set window.ED_ASSET_BASE before this script to relocate assets/ for a page
   that is not at the site root.
   --------------------------------------------------------------------------- */

(function (global, document) {
  'use strict';

  /* Pages that do not sit at the site root (the article pages under news/)
     set window.ED_ASSET_BASE before loading this file, so a manifest entry
     stays a single repo-relative path no matter which page resolves it. */
  var ASSET_BASE = global.ED_ASSET_BASE || 'assets/';
  var MANIFEST_URL = ASSET_BASE + 'manifest.json';

  var GLYPH = {
    photo: '<path d="M3 5.5h4l1.4-2h7.2L17 5.5h4v13H3z"/><circle cx="12" cy="12" r="3.6"/>',
    chart: '<path d="M4 20V9.5M10 20V4.5M16 20v-7M22 20H2"/>',
    map:   '<path d="M9 3.5 3 6v14.5l6-2.5 6 2.5 6-2.5V3.5L15 6z"/><path d="M9 3.5V18M15 6v14.5"/>',
    video: '<rect x="2.5" y="5" width="14" height="14" rx="1.5"/><path d="M16.5 10.5 21.5 7.5v9l-5-3z"/>',
    logo:  '<rect x="2.5" y="7" width="19" height="10" rx="1.5"/><path d="M6.5 12h11"/>'
  };

  function svgGlyph(kind) {
    var d = GLYPH[kind] || GLYPH.photo;
    return '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="1.25" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true" focusable="false">' + d + '</svg>';
  }

  function escapeHtml(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function specOf(el, spec) {
    return {
      id: el.getAttribute('data-slot') || '',
      kind: el.getAttribute('data-kind') || (spec && spec.kind) || 'photo',
      ratio: el.getAttribute('data-ratio') || (spec && spec.ratio) || '16/9',
      minW: Number(el.getAttribute('data-min-width') || (spec && spec.minW) || 0),
      caption: el.getAttribute('data-caption') || ''
    };
  }

  function renderEmpty(el, s) {
    el.classList.add('ed-slot--empty');
    el.setAttribute('data-state', 'empty');
    el.innerHTML =
      '<span style="color:' + (s.kind === 'chart' || s.kind === 'map' ? '#00c7a6' : '#97918a') + '">' +
        svgGlyph(s.kind) +
      '</span>' +
      '<span class="ed-slot__id">' + escapeHtml(s.id) + '</span>' +
      '<span class="ed-slot__spec">' + escapeHtml(s.kind) + ' &middot; ' +
        escapeHtml(s.ratio.replace('/', ':')) +
        (s.minW ? ' &middot; ' + s.minW + 'px min' : '') +
      '</span>';
  }

  function renderFilled(el, s, entry) {
    el.classList.remove('ed-slot--empty');
    el.setAttribute('data-state', 'filled');

    if (entry.type === 'inline' && entry.svg) {
      el.innerHTML = entry.svg;
      return;
    }

    var src = entry.src || '';
    if (!src) { renderEmpty(el, s); return; }

    if (entry.type === 'embed') {
      // Sandboxed: a live chart or map embed gets to run scripts, nothing else.
      el.innerHTML = '<iframe src="' + escapeHtml(src) + '" loading="lazy" ' +
        'title="' + escapeHtml(entry.alt || s.id) + '" ' +
        'sandbox="allow-scripts allow-popups" referrerpolicy="no-referrer"></iframe>';
      return;
    }

    if (entry.type === 'video') {
      el.innerHTML = '<video src="' + escapeHtml(resolve(src)) + '" playsinline muted ' +
        (entry.poster ? 'poster="' + escapeHtml(resolve(entry.poster)) + '" ' : '') +
        'controls></video>';
      return;
    }

    el.innerHTML = '<img src="' + escapeHtml(resolve(src)) + '" ' +
      'alt="' + escapeHtml(entry.alt || '') + '" loading="lazy" decoding="async">';
  }

  function resolve(src) {
    return /^(https?:|data:|blob:|\/)/.test(src) ? src : ASSET_BASE + src;
  }

  function apply(manifest) {
    var assets = (manifest && manifest.assets) || {};
    var nodes = document.querySelectorAll('[data-slot]');
    var filled = 0;

    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var declared = global.EDS ? global.EDS.slot(el.getAttribute('data-slot')) : null;
      var s = specOf(el, declared);

      if (s.ratio && !el.style.aspectRatio) el.style.aspectRatio = s.ratio;

      var entry = assets[s.id];
      if (entry && (entry.src || entry.svg)) {
        renderFilled(el, s, entry);
        filled++;
      } else if (el.querySelector('svg, img, iframe, video')) {
        // The slot ships with drawn content (the sample chart and map do).
        // That is its default, not a hole — leave it until the manifest fills it.
        el.setAttribute('data-state', 'default');
      } else {
        renderEmpty(el, s);
      }

      if (s.caption) {
        var cap = document.createElement('figcaption');
        cap.className = 'ed-slot__caption';
        cap.textContent = s.caption;
        if (el.parentNode) el.parentNode.insertBefore(cap, el.nextSibling);
      }
    }

    document.documentElement.setAttribute('data-slots-filled', filled + '/' + nodes.length);
    global.dispatchEvent(new CustomEvent('ed:slots-ready', {
      detail: { total: nodes.length, filled: filled }
    }));
  }

  function load() {
    // An inline manifest always wins — it is what makes file:// previews work.
    if (global.ED_MANIFEST) { apply(global.ED_MANIFEST); return; }
    if (typeof fetch !== 'function') { apply(null); return; }
    fetch(MANIFEST_URL, { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(apply)
      .catch(function () { apply(null); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();

  global.EDSlots = { apply: apply, reload: load };
})(typeof window !== 'undefined' ? window : globalThis, document);
