/* ---------------------------------------------------------------------------
   Boreal Grid — design-system bundle
   Design system id: organic-0b63b13d-34bf-4cfa-86d1-fa35ca34c91c

   Exposes the tokens that cannot live in CSS alone: the categorical series
   palette used by charts, the media-slot contract, and the number/date
   formatters the market rail and data panels share.

   Loaded as a plain <script> (no modules) so it works from file:// as well as
   from a server. Everything hangs off window.EDS.
   --------------------------------------------------------------------------- */

(function (global) {
  'use strict';

  /* Accent hues share L=0.74 / C=0.14 in oklch so no series shouts louder than
     another. Charts must use the literal hex, not the CSS variable: SVG
     rasterisers and PDF export do not always resolve custom properties. */
  var SERIES = [
    { id: 's1', hex: '#e7963d', oklch: 'oklch(0.74 0.14 65)',  name: 'Thermal / amber' },
    { id: 's2', hex: '#00c7a6', oklch: 'oklch(0.74 0.14 175)', name: 'Renewable / teal' },
    { id: 's3', hex: '#b995f6', oklch: 'oklch(0.74 0.14 300)', name: 'Third series / violet' }
  ];

  var COLOR = {
    ink: '#14110e',
    inkRaised: '#221e1a',
    inkSunk: '#0d0b09',
    paper: '#f6f3ee',
    mutedOnInk: '#97918a',
    ruleOnInk: 'rgba(246, 243, 238, 0.14)',
    thermal: '#e7963d',
    renewable: '#00c7a6',
    up: '#3fbf7f',
    down: '#e5644a'
  };

  /* -------------------------------------------------------------------------
     Media-slot contract.

     Every picture, graph, map or video on the landing page is declared here
     once, and referenced by id from both the artboard and preview.html. A slot
     is filled by adding an entry with the same id to assets/manifest.json —
     nothing in the markup has to change.

       kind    photo | chart | map | video | logo
       ratio   intrinsic aspect the layout reserves, as "w/h"
       minW    smallest source width that still looks sharp at 2x
     ------------------------------------------------------------------------- */
  var SLOTS = [
    { id: 'masthead-logo',      kind: 'logo',  ratio: '4/1',  minW: 480,
      note: 'Optional. Replaces the wordmark set in type.' },
    { id: 'finland-photo',      kind: 'photo', ratio: '16/9', minW: 2000,
      note: 'Finland lead story. Full-bleed within the hero column, and the article lead.' },
    { id: 'finland-chart',      kind: 'chart', ratio: '16/9', minW: 1800,
      note: 'Finland article: day-ahead against balancing energy.' },
    { id: 'lithuania-chart',    kind: 'chart', ratio: '4/3',  minW: 1400,
      note: 'Lithuania feature. Static export or a live embed URL.' },
    { id: 'lithuania-grid-chart', kind: 'chart', ratio: '16/9', minW: 1800,
      note: 'Lithuania article: connection queue against firm transmission capacity.' },
    { id: 'prices-chart',       kind: 'chart', ratio: '16/9', minW: 1800,
      note: 'Day-ahead power panel. Ships with a drawn sample; replace with the live chart.' },
    { id: 'flows-map',          kind: 'map',   ratio: '4/3',  minW: 1400,
      note: 'Nordic-Baltic corridor map. Ships with a drawn sample; replace with the live map.' }
  ];

  var SLOT_BY_ID = {};
  for (var i = 0; i < SLOTS.length; i++) SLOT_BY_ID[SLOTS[i].id] = SLOTS[i];

  /* Formatters shared by the market rail and the data panels. */
  function price(value, dp) {
    if (value === null || value === undefined || value === '') return '—';
    var n = Number(value);
    if (!isFinite(n)) return String(value);
    return n.toFixed(dp === undefined ? 2 : dp);
  }

  function change(value, dp) {
    if (value === null || value === undefined || value === '') return '—';
    var n = Number(value);
    if (!isFinite(n)) return String(value);
    return (n > 0 ? '+' : '') + n.toFixed(dp === undefined ? 2 : dp) + '%';
  }

  function direction(value) {
    var n = Number(value);
    if (!isFinite(n) || n === 0) return 'flat';
    return n > 0 ? 'up' : 'down';
  }

  function changeColor(value) {
    var d = direction(value);
    return d === 'up' ? COLOR.up : d === 'down' ? COLOR.down : COLOR.mutedOnInk;
  }

  /* "14 min ago" from an ISO timestamp; falls back to the raw string so an
     unfilled [PLACEHOLDER] shows through instead of rendering "Invalid Date". */
  function timeAgo(iso, now) {
    var t = Date.parse(iso);
    if (isNaN(t)) return String(iso);
    var secs = Math.max(0, ((now === undefined ? Date.now() : now) - t) / 1000);
    if (secs < 90) return 'just now';
    var mins = Math.round(secs / 60);
    if (mins < 60) return mins + ' min ago';
    var hours = Math.round(mins / 60);
    if (hours < 24) return hours + (hours === 1 ? ' hour ago' : ' hours ago');
    var days = Math.round(hours / 24);
    return days + (days === 1 ? ' day ago' : ' days ago');
  }

  global.EDS = {
    SERIES: SERIES,
    COLOR: COLOR,
    SLOTS: SLOTS,
    slot: function (id) { return SLOT_BY_ID[id] || null; },
    price: price,
    change: change,
    direction: direction,
    changeColor: changeColor,
    timeAgo: timeAgo
  };
})(typeof window !== 'undefined' ? window : globalThis);
