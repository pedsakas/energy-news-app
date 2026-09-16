#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   tools/build-site.mjs

   Builds the whole static site from the sources that are the single points of
   truth for it:

     Energy News Landing.dc.html   the landing design (a canvas artboard)
     content/articles.json         the articles
     content/market-sample.json    the sample market rail
     app.config.json               brand, newsletter, reports, live data app
     assets/manifest.json          which media slots are filled
     _ds/…/styles.css              design tokens and shared components
     _ds/…/_ds_bundle.js           slot contract, series palette, formatters
     support.js                    the standalone .dc.html runtime
     image-slot.js                 the media import layer

   Output:

     index.html                    the landing page — the artboard, standalone
     news/<slug>.html              one page per article
     reports.html                  the paid-research catalogue
     preview.html                  the landing page inside a device switcher
     sitemap.xml, robots.txt       only when brand.siteUrl is set

       node tools/build-site.mjs

   Nothing here invents content. Where app.config.json leaves a value empty —
   no newsletter endpoint, no checkout link, no live data app — the page renders
   an explicitly unconnected state and says what to set, rather than shipping a
   control that silently goes nowhere.
   --------------------------------------------------------------------------- */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const readJson = (p) => JSON.parse(read(p));
const write = (p, s) => {
  mkdirSync(dirname(join(ROOT, p)), { recursive: true });
  writeFileSync(join(ROOT, p), s);
};

const DS = '_ds/organic-0b63b13d-34bf-4cfa-86d1-fa35ca34c91c';
const ARTBOARD = 'Energy News Landing.dc.html';

const artboard = read(ARTBOARD);
const supportJs = read('support.js');
const slotJs = read('image-slot.js');
const bundleJs = read(`${DS}/_ds_bundle.js`);
const tokensCss = read(`${DS}/styles.css`);
const config = readJson('app.config.json');
const manifest = readJson('assets/manifest.json');
const articles = readJson('content/articles.json').articles;
const marketSample = readJson('content/market-sample.json');

const brand = config.brand ?? {};
const newsletter = config.newsletter ?? {};
const reports = config.reports ?? {};
const liveApp = config.liveDataApp ?? {};
const theme = config.theme ?? {};

const SITE_URL = String(brand.siteUrl ?? '').trim().replace(/\/$/, '');
const NL_WIRED = String(newsletter.formAction ?? '').trim().length > 0;
const YEAR = new Date().getFullYear();

/* --- escaping ------------------------------------------------------------ */

const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/* An inlined <script> ends at the first "</script" in its text, wherever that
   appears — support.js quotes that very tag in its own header comment. Escaping
   the slash keeps the sequence away from the HTML parser and changes nothing for
   JavaScript: inside a string literal the escape is redundant but harmless, and a
   comment does not care either way. */
const CLOSE_TAG = /<\/(script)/gi;
const inlineJs = (js) =>
  '<' + 'script>' + js.replace(CLOSE_TAG, '<\\/$1') + '<' + '/script>';

/* JSON heading for an HTML attribute, and JSON heading for a <script> body are
   different problems. This one is for an attribute. */
const jsonAttr = (value) => esc(JSON.stringify(value));

/* --- shared page data ---------------------------------------------------- */

const storyHref = (a, fromRoot) => (fromRoot ? '' : '../') + `news/${a.slug}.html`;

const stories = articles.map((a) => ({
  kicker: a.kicker,
  title: a.title,
  dek: a.dek,
  byline: a.byline,
  published: a.published,
  readingTime: `${a.readingTime} read`,
  href: storyHref(a, true)
}));

const newsletterForArtboard = {
  name: newsletter.name ?? 'The weekly briefing',
  headline: 'The week in Nordic and Baltic power, before the week starts',
  bandHeadline: 'Start Monday knowing what moved, and why',
  promise: newsletter.promise ?? '',
  cadence: newsletter.cadence ?? '',
  submitLabel: 'Get the briefing',
  reassurance: 'No spam. One click to leave.',
  action: newsletter.formAction ?? '',
  method: newsletter.method ?? 'post',
  field: newsletter.emailField ?? 'email',
  bullets: [
    'FI, SE, NO, EE, LV and LT day-ahead and balancing spreads, decomposed',
    'Capture prices for wind and solar, tracked against the baseload curve',
    'Connection queues, tenders and interconnector milestones that reprice the curve',
    'Written for people who have to act on it, not for a press round-up'
  ]
};

const tiers = (reports.tiers ?? []).map((t) => ({ ...t, currency: reports.currency }));

/* --- component props, from app.config.json ------------------------------- */

const props = {
  brandName: brand.name ?? 'Energy Desk',
  brandTagline: brand.tagline ?? '',
  brandContact: brand.contact ?? '',
  newsletterJson: JSON.stringify(newsletterForArtboard),
  tiersJson: JSON.stringify(tiers),
  storiesJson: JSON.stringify(stories),
  railJson: JSON.stringify(marketSample.rail ?? []),
  liveDataUrl: liveApp.url ?? '',
  liveDataLabel: liveApp.label ?? 'Open the live data app',
  accent: theme.accent ?? '#e7963d',
  density: theme.density ?? 'editorial',
  showMarketRail: theme.showMarketRail ?? true
};

/* --- head ---------------------------------------------------------------- */

/* One inline SVG favicon rather than a binary in the repo: a bidding-zone node
   with a flow arrow through it, in the accent. */
const FAVICON =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
    '<rect width="32" height="32" rx="6" fill="#14110e"/>' +
    '<path d="M5 22 L13 10 L19 18 L27 7" fill="none" stroke="' + (theme.accent ?? '#e7963d') +
    '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  );

function head({ title, description, path, extraCss = '', ogType = 'website' }) {
  const canonical = SITE_URL ? `${SITE_URL}/${path}`.replace(/\/index\.html$/, '/') : '';
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="color-scheme" content="dark">
<link rel="icon" href="${FAVICON}">
${canonical ? `<link rel="canonical" href="${esc(canonical)}">\n` : ''}<meta property="og:type" content="${esc(ogType)}">
<meta property="og:site_name" content="${esc(brand.name ?? '')}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
${canonical ? `<meta property="og:url" content="${esc(canonical)}">\n` : ''}<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">${extraCss}`;
}

/* --- the landing page ---------------------------------------------------- */

/* The artboard is a complete document already. The build swaps its single
   <script src="./support.js"> line for the runtime, the props and the manifest,
   appends the media layer, and fills out the <head> it ships with — which is
   deliberately minimal, because on the canvas the editor owns it. */
function buildLandingDocument(source) {
  const inlineHead = [
    inlineJs(bundleJs),
    inlineJs(
      'window.ED_PROPS = ' + JSON.stringify(props) + ';\n' +
      'window.ED_MANIFEST = ' + JSON.stringify({ assets: manifest.assets ?? {} }) + ';'
    ),
    inlineJs(supportJs)
  ].join('\n');

  let doc = source.replace(
    /<script src="\.\/support\.js"><\/script>/,
    () => inlineHead
  );
  if (doc === source) {
    console.error(`! the support.js head line was not found in ${ARTBOARD} — keep it verbatim`);
    process.exit(1);
  }

  doc = doc.replace('</body>', inlineJs(slotJs) + '\n</body>');
  return doc;
}

/* On the canvas the artboard's markup has to live inside <x-dc>, and its styles
   inside <helmet>, because that is the format. In a static page both cost
   something: the browser parses "{{ chart.gridPath }}" as a live SVG path,
   fails, and logs it; and the stylesheet only applies once boot() has moved it.
   Neither is necessary here, so the build hoists the helmet into <head> and
   parks the markup in an inert <template> that support.js picks up instead. */
function staticiseArtboard(doc) {
  const xdc = doc.match(/<x-dc>([\s\S]*?)<\/x-dc>/);
  if (!xdc) {
    console.error(`! no <x-dc> block found in ${ARTBOARD}`);
    process.exit(1);
  }
  const helmet = xdc[1].match(/<helmet>([\s\S]*?)<\/helmet>/);
  if (!helmet) {
    console.error(`! no <helmet> block found in ${ARTBOARD}`);
    process.exit(1);
  }

  // head() already emits the font preconnects and the Google Fonts link.
  const helmetHead = helmet[1]
    .replace(/<link rel="preconnect"[^>]*>\s*/g, '')
    .replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>\s*/g, '')
    .trim();

  const markup = xdc[1].replace(/<helmet>[\s\S]*?<\/helmet>/, '').trim();

  // Parked as raw text, so guard the one sequence that would end it early.
  if (/<\/script/i.test(markup)) {
    console.error(`! the artboard markup contains a </script sequence, which cannot be parked as text`);
    process.exit(1);
  }

  return {
    helmetHead,
    doc: doc.replace(
      xdc[0],
      '<x-dc></x-dc>\n<' + 'script type="text/plain" id="ed-artboard-src">\n' + markup + '\n<' + '/script>'
    )
  };
}

/* Order matters: the artboard is staticised while it is still only markup. Once
   support.js has been inlined the document contains JavaScript that talks about
   these very tags, and a tag-shaped match would find the prose first. */
const landing = staticiseArtboard(artboard);
const landingDoc = buildLandingDocument(landing.doc);

const landingHead = head({
  title: `${brand.name} — ${brand.tagline}`,
  description: brand.description ?? brand.tagline ?? '',
  path: 'index.html'
});

write(
  'index.html',
  landingDoc
    .replace('<html>', '<html lang="en">')
    .replace('<meta charset="utf-8">', landingHead + '\n' + landing.helmetHead)
);

/* --- page chrome shared by the non-artboard pages ------------------------- */

const NAV = [
  { label: 'Analysis', href: 'index.html#analysis' },
  { label: 'Markets', href: 'index.html#markets' },
  { label: 'Reports', href: 'reports.html' }
];

/* "Analysis · Lithuania" -> "Lithuania". The landing footer names markets, so
   these do too. */
const marketOf = (a) => (a.kicker.split('·').pop() || a.section).trim();

const FOOTER_COLS = [
  { title: 'Analysis', links: articles.map((a) => ({ label: marketOf(a), href: `news/${a.slug}.html` })) },
  { title: 'Research', links: [
    { label: 'Reports', href: 'reports.html' },
    { label: 'Methodology', href: 'reports.html#methodology' },
    { label: 'Live data app', href: liveApp.url || 'index.html#live-data-app' }
  ] },
  { title: 'Desk', links: [
    { label: 'Newsletter', href: 'index.html#subscribe' },
    { label: 'About', href: 'reports.html#about' },
    { label: 'Contact', href: 'index.html#contact' }
  ] }
];

/* `up` is "" for a root page and "../" for a page under news/. Links are written
   root-relative in the tables above and rewritten here, so a page can move
   between depths without every href being restated. */
const rel = (href, up) => (/^(https?:|mailto:|#)/.test(href) ? href : up + href);

function marketRail(up) {
  const rows = (marketSample.rail ?? []).map((r) => {
    const n = Number(r.change);
    const color = n > 0 ? 'var(--up)' : n < 0 ? 'var(--down)' : 'var(--muted-on-ink)';
    const sign = n > 0 ? '+' : '';
    return `<div class="ed-rail__quote"><span class="ed-rail__code">${esc(r.code)}</span>` +
      `<span class="ed-num" style="font-size:13px">${esc(r.value)}</span>` +
      `<span class="ed-num" style="font-size:11px;color:${color}">${sign}${n.toFixed(2)}%</span></div>`;
  }).join('');
  const chip = liveApp.url
    ? '<span class="ed-chip ed-chip--live">Live</span>'
    : '<span class="ed-chip">Sample feed</span>';
  return `<div class="ed-rail"><div class="ed-wrap ed-rail__inner">${chip}
<div class="ed-rail-list" style="display:flex;align-items:center;gap:28px;flex-grow:1">${rows}</div>
</div></div>`;
}

function masthead(up) {
  const links = NAV.map((n) => `<a class="ed-navlink" href="${esc(rel(n.href, up))}">${esc(n.label)}</a>`).join('');
  return `<header class="ed-wrap ed-masthead">
<a class="ed-story-link" href="${esc(up)}index.html" style="display:flex;align-items:baseline;gap:14px">
<span style="font-family:var(--display);font-size:27px;font-weight:600;letter-spacing:-0.02em;color:var(--paper)">${esc(brand.name)}</span>
<span style="font-family:var(--mono);font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:var(--muted-on-paper)">Nordics&nbsp;&amp;&nbsp;Baltics</span>
</a>
<nav class="ed-nav">${links}
<a class="ed-cta ed-cta--ghost" style="min-height:40px;padding:0 16px;font-size:14px" href="${esc(up)}index.html#subscribe">Subscribe</a>
</nav></header>
<hr class="ed-hairline">`;
}

/* The signup, rendered in whichever of its two states the config puts it in.
   `id` keeps the label/input pair unique when a page carries more than one. */
function signupForm(id) {
  if (NL_WIRED) {
    return `<form class="ed-signup__row" action="${esc(newsletter.formAction)}" method="${esc(newsletter.method ?? 'post')}" target="_blank" rel="noopener">
<label class="ed-vh" for="${esc(id)}">Email address</label>
<input class="ed-input" id="${esc(id)}" type="email" name="${esc(newsletter.emailField ?? 'email')}" placeholder="you@company.com" autocomplete="email" required>
<button class="ed-cta" type="submit">Get the briefing</button>
</form>`;
  }
  return `<div class="ed-signup__row" aria-hidden="true">
<span class="ed-input ed-input--dead">you@company.com</span>
<span class="ed-cta ed-cta--dead">Get the briefing</span>
</div>
<p class="ed-warn">Not connected — set newsletter.formAction in app.config.json.<br>The field above stays inert until you do, so no address is taken and dropped.</p>`;
}

function signupBand(idPrefix) {
  return `<section style="margin-top:96px;background:var(--ink-raised);border-block:1px solid var(--rule-on-ink)" id="subscribe">
<div class="ed-wrap ed-band-grid">
<div style="display:flex;flex-direction:column;gap:12px;max-width:56ch">
<p class="ed-kicker">${esc(newsletter.name ?? 'The weekly briefing')}</p>
<h2 style="font-size:30px">Start Monday knowing what moved, and why</h2>
<p style="font-size:16px;line-height:1.55;color:#a9a29a">${esc(newsletter.promise ?? '')}</p>
</div>
<div style="display:flex;flex-direction:column;gap:10px">
${signupForm(idPrefix + '-email')}
<p style="font-family:var(--mono);font-size:11px;letter-spacing:0.04em;color:var(--muted-on-paper)">${esc(newsletter.cadence ?? '')} &middot; No spam. One click to leave.</p>
</div></div></section>`;
}

function footer(up) {
  const cols = FOOTER_COLS.map((c) => {
    const links = c.links
      .map((l) => `<a class="ed-navlink" style="font-size:14px" href="${esc(rel(l.href, up))}">${esc(l.label)}</a>`)
      .join('');
    return `<div class="ed-foot-col"><p class="ed-kicker" style="color:var(--muted-on-paper)">${esc(c.title)}</p>${links}</div>`;
  }).join('');
  return `<footer class="ed-wrap" style="padding-block:56px 64px">
<div class="ed-foot-grid">
<div style="display:flex;flex-direction:column;gap:12px">
<span style="font-family:var(--display);font-size:22px;font-weight:600;letter-spacing:-0.02em">${esc(brand.name)}</span>
<p style="font-size:14px;line-height:1.5;color:var(--muted-on-ink);max-width:34ch">${esc(brand.tagline ?? '')}</p>
<p style="font-family:var(--mono);font-size:11px;letter-spacing:0.06em;color:var(--muted-on-paper)">${esc(brand.contact ?? '')}</p>
</div>${cols}</div>
<hr class="ed-hairline" style="margin-top:44px">
<p style="padding-top:20px;font-family:var(--mono);font-size:11px;line-height:1.6;letter-spacing:0.06em;color:var(--muted-on-paper)">
&copy; ${YEAR} ${esc(brand.name)} &middot; Independent research. Nothing here is investment advice.
Market figures are sample values until the live data app is connected.
</p></footer>`;
}

/* Every non-artboard page is this shell. The media layer runs last, after the
   markup it rewrites is in the document. */
function page({ title, description, path, up, body, ogType }) {
  return `<!doctype html>
<html lang="en">
<head>
${head({ title, description, path, ogType, extraCss: `\n<link rel="stylesheet" href="${up}site.css">` })}
</head>
<body class="ed-root">
${body}
${inlineJs(bundleJs)}
${inlineJs(
  `window.ED_ASSET_BASE = ${JSON.stringify(up + 'assets/')};\n` +
  'window.ED_MANIFEST = ' + JSON.stringify({ assets: manifest.assets ?? {} }) + ';'
)}
${inlineJs(slotJs)}
</body>
</html>
`;
}

/* --- article rendering --------------------------------------------------- */

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
function longDate(iso) {
  const t = Date.parse(iso);
  if (isNaN(t)) return String(iso);
  const d = new Date(t);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function slotFigure(slotId, caption, ratioOverride) {
  const declared = { 'finland-photo': ['photo', '16/9', 2000], 'finland-chart': ['chart', '16/9', 1800],
    'lithuania-chart': ['chart', '4/3', 1400], 'lithuania-grid-chart': ['chart', '16/9', 1800] }[slotId]
    || ['chart', '16/9', 1600];
  const [kind, declaredRatio, minW] = declared;
  const ratio = ratioOverride ?? declaredRatio;
  return `<figure class="ed-slot ed-slot--empty" data-slot="${esc(slotId)}" data-kind="${esc(kind)}" data-ratio="${esc(ratio)}" data-min-width="${minW}" style="aspect-ratio:${ratio.replace('/', ' / ')}">
<span class="ed-slot__id">${esc(slotId)}</span>
<span class="ed-slot__spec">${esc(kind)} &middot; ${esc(ratio.replace('/', ':'))} &middot; ${minW}px min</span>
</figure>
<figcaption class="ed-slot__caption">${esc(caption ?? '')}</figcaption>`;
}

function renderBlock(b) {
  switch (b.type) {
    case 'h2':
      return `<h2>${esc(b.text)}</h2>`;
    case 'p':
      return `<p>${esc(b.text)}</p>`;
    case 'list':
      return `<ul class="ed-prose__list">${b.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
    case 'pull':
      return `<blockquote class="ed-pull">${esc(b.text)}</blockquote>`;
    case 'note':
      return `<aside class="ed-note"><p class="ed-note__title">${esc(b.title)}</p><p>${esc(b.text)}</p></aside>`;
    case 'figure':
      return `<div>${slotFigure(b.slot, b.caption)}</div>`;
    case 'table':
      return `<div class="ed-table-wrap"><table class="ed-table">
<caption>${esc(b.caption ?? '')}</caption>
<thead><tr>${b.head.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>
<tbody>${b.rows.map((r) => `<tr>${r.map((c, i) => (i === 0 ? `<th scope="row" style="color:var(--paper);font-family:var(--body);font-size:15px;font-weight:500;letter-spacing:0;text-transform:none">${esc(c)}</th>` : `<td>${esc(c)}</td>`)).join('')}</tr>`).join('')}</tbody>
</table></div>`;
    case 'sources':
      return `<h2 id="sources">Sources</h2>
<ul class="ed-sources">${b.items.map((s) =>
        `<li><a href="${esc(s.url)}" target="_blank" rel="noopener nofollow">${esc(s.title)}</a></li>`).join('')}</ul>`;
    default:
      console.warn(`! unknown block type "${b.type}" — skipped`);
      return '';
  }
}

function articlePage(a, index) {
  const other = articles[(index + 1) % articles.length];
  const up = '../';
  const body = `${marketRail(up)}
${masthead(up)}
<main class="ed-wrap">
<article class="ed-article">
<header class="ed-article__head">
<p class="ed-kicker">${esc(a.kicker)}</p>
<h1 class="ed-article__title">${esc(a.title)}</h1>
<p class="ed-article__dek">${esc(a.dek)}</p>
<p class="ed-article__meta">${esc(a.byline)} &middot; <time datetime="${esc(a.published)}">${esc(longDate(a.published))}</time> &middot; ${esc(a.readingTime)} read</p>
</header>
<div style="padding-top:28px">${slotFigure(a.leadSlot, a.leadCaption, '16/9')}</div>
<div class="ed-prose">${a.body.map(renderBlock).join('\n')}</div>
<hr class="ed-hairline">
<aside class="ed-signup" style="margin-top:36px">
<div style="display:flex;flex-direction:column;gap:8px">
<p class="ed-kicker">${esc(newsletter.name ?? 'The weekly briefing')}</p>
<h2 style="font-size:24px">Get the next one before it is public</h2>
<p style="font-size:15px;line-height:1.55;color:#a9a29a">${esc(newsletter.promise ?? '')}</p>
</div>
${signupForm('article-email')}
<p style="font-family:var(--mono);font-size:11px;letter-spacing:0.04em;color:var(--muted-on-paper)">${esc(newsletter.cadence ?? '')} &middot; No spam. One click to leave.</p>
</aside>
<div style="display:flex;flex-wrap:wrap;gap:16px;justify-content:space-between;padding-block:44px 0">
<a class="ed-backlink" href="${up}index.html">&larr; All analysis</a>
<a class="ed-backlink" href="${other.slug}.html">Next: ${esc(marketOf(other))} &rarr;</a>
</div>
</article>
</main>
${signupBand('article-band')}
${footer(up)}`;

  return page({
    title: `${a.title} — ${brand.name}`,
    description: a.summary ?? a.dek,
    path: `news/${a.slug}.html`,
    up,
    ogType: 'article',
    body
  });
}

articles.forEach((a, i) => write(`news/${a.slug}.html`, articlePage(a, i)));

/* --- reports page -------------------------------------------------------- */

const CURRENCY = { EUR: '€', USD: '$', GBP: '£' };

function tierCard(t) {
  const priced = String(t.price ?? '').trim().length > 0;
  const buyable = String(t.checkoutUrl ?? '').trim().length > 0;
  const cur = CURRENCY[reports.currency] ?? reports.currency ?? '€';
  const features = (t.features ?? []).map((f) =>
    `<li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg><span>${esc(f)}</span></li>`
  ).join('');
  return `<div class="ed-tier${t.featured ? ' ed-tier--featured' : ''}">
<div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
<h3 style="font-family:var(--display);font-weight:500;font-size:20px;margin:0">${esc(t.name)}</h3>
<span class="ed-chip${t.featured ? ' ed-chip--accent' : ''}">${esc(t.kind)}</span>
</div>
<div class="ed-tier__price">
<span class="ed-tier__amount${priced ? '' : ' ed-tier__amount--tbc'}">${priced ? esc(cur + t.price) : 'Price on request'}</span>
<span class="ed-tier__unit">${esc(t.unit ?? '')}</span>
</div>
<p style="font-size:14px;line-height:1.55;color:#a9a29a;margin:0">${esc(t.summary ?? '')}</p>
<ul class="ed-ticks">${features}</ul>
<div class="ed-tier__spacer"></div>
<a class="ed-cta ed-cta--block${t.featured && buyable ? '' : ' ed-cta--ghost'}" href="${esc(buyable ? t.checkoutUrl : 'index.html#subscribe')}">${esc(buyable ? (t.cta ?? 'Buy') : 'Join the waitlist')}</a>
<p style="font-family:var(--mono);font-size:11px;line-height:1.5;letter-spacing:0.04em;margin:0;color:${buyable ? 'var(--muted-on-paper)' : 'var(--thermal)'}">${
    buyable ? 'Secure checkout. Invoice on request.' : 'Not on sale yet — this button subscribes you to the newsletter, and you hear first.'
  }</p>
</div>`;
}

const FAQ = [
  { q: 'What exactly is in a report?',
    a: 'A single market and a single question. Hourly-resolution price decomposition, the series behind every chart as CSV, and scenario ranges with the assumptions written out rather than buried in an appendix.' },
  { q: 'Do I need the subscription to get the newsletter?',
    a: 'No. The newsletter is free and always will be. The subscription buys the underlying data, the trackers and the analyst time.' },
  { q: 'Which markets do you cover?',
    a: 'The Nordic and Baltic bidding zones — FI, SE1–SE4, NO1–NO5, DK1–DK2, EE, LV and LT — plus the interconnectors between them and into continental Europe.' },
  { q: 'Where does the data come from?',
    a: 'Published TSO and exchange data, the regulators, and the companies themselves. Every figure in a report is traceable to a source, and corrections are published with a date.' },
  { q: 'Can you run a question for us?',
    a: 'Yes. Commissioned work is priced on the question, not on page count. Model review — marking your own capture-price assumptions against ours — is the most common request.' },
  { q: 'Is this investment advice?',
    a: 'No. It is independent market research. We do not hold positions in the assets we write about, and we do not take payment to reach a conclusion.' }
];

const reportsBody = `${marketRail('')}
${masthead('')}
<main class="ed-wrap">
<section style="display:flex;flex-direction:column;gap:14px;max-width:64ch;padding-block:52px 0">
<p class="ed-kicker">Research</p>
<h1 style="font-family:var(--display);font-weight:500;letter-spacing:-0.012em;font-size:clamp(34px,4.2vw,52px);line-height:1.05;margin:0">The newsletter is free. The working behind it is what you pay for.</h1>
<p style="font-size:17px;line-height:1.65;color:#a9a29a">Deep-dives on one market and one question at a time, with the series, the assumptions and the scenario ranges shipped alongside the prose. Buy a single report, or subscribe to the lot.</p>
</section>

<section class="ed-tier-grid" style="padding-block:40px 0" id="pricing">${tiers.map(tierCard).join('')}</section>

<section style="padding-block:72px 0" id="methodology">
<h2 style="font-family:var(--display);font-weight:500;font-size:28px;margin:0 0 8px">Methodology, in short</h2>
<p style="font-size:16px;line-height:1.65;color:#a9a29a;max-width:70ch;margin:0 0 28px">
Prices come from the day-ahead and intraday exchanges; volumes, flows and balancing data from the TSOs.
Capture prices are computed against metered generation profiles, not against a modelled shape. Every chart
ships with the series that produced it, so you can disagree with us using our own numbers.
</p>
<div class="ed-faq" id="about">${FAQ.map((f) =>
  `<div><p class="ed-faq__q">${esc(f.q)}</p><p class="ed-faq__a">${esc(f.a)}</p></div>`).join('')}</div>
</section>
</main>
${signupBand('reports-band')}
${footer('')}`;

write('reports.html', page({
  title: `Research and reports — ${brand.name}`,
  description: 'Paid deep-dives and data trackers on the Nordic and Baltic power markets. Single reports, a quarterly research subscription, or commissioned analysis.',
  path: 'reports.html',
  up: '',
  body: reportsBody
}));

/* --- the design preview -------------------------------------------------- */

/* The artboard rides to the browser as base64 inside a text/plain block.
   Escaping it as text would mean un-escaping it on the other side, which would
   also undo the "</script" sequences inlineJs() deliberately hid. Base64 carries
   no such sequence to begin with. */
const parked = Buffer.from(landingDoc, 'utf8').toString('base64');
const filledCount = Object.keys(manifest.assets ?? {}).length;
const slotCount = (artboard.match(/data-slot="/g) ?? []).length;

write('preview.html', `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(brand.name)} — landing preview</title>
<link rel="icon" href="${FAVICON}">
<style>
@import url("${DS}/styles.css");

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
  <span class="pv-title">${esc(brand.name)} — landing</span>
  <span class="pv-meta">${filledCount}/${slotCount} media slots filled &middot; newsletter: ${
    NL_WIRED ? esc(newsletter.formAction) : 'not connected'
  } &middot; live data app: ${liveApp.url ? esc(liveApp.url) : 'not set'}</span>
  <span class="pv-spacer"></span>
  <div class="pv-group" role="group" aria-label="Viewport width">
    <button class="pv-btn" type="button" data-w="1440" aria-pressed="true">Desktop</button>
    <button class="pv-btn" type="button" data-w="834" aria-pressed="false">Tablet</button>
    <button class="pv-btn" type="button" data-w="390" aria-pressed="false">Phone</button>
  </div>
</div>

<div class="pv-stage">
  <div class="pv-frame" id="pv-frame"><iframe id="pv-doc" title="${esc(brand.name)} landing page"></iframe></div>
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
`);

/* --- sitemap ------------------------------------------------------------- */

const pages = ['', 'reports.html', ...articles.map((a) => `news/${a.slug}.html`)];

if (SITE_URL) {
  write('sitemap.xml',
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    pages.map((p) => `  <url><loc>${esc(`${SITE_URL}/${p}`)}</loc></url>`).join('\n') +
    '\n</urlset>\n');
  write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
}

/* --- report -------------------------------------------------------------- */

console.log(`built ${pages.length + 1} pages`);
console.log(`  index.html          landing (${filledCount}/${slotCount} media slots filled)`);
for (const a of articles) console.log(`  news/${a.slug}.html`);
console.log('  reports.html        ' + tiers.length + ' pricing tiers, ' +
  tiers.filter((t) => String(t.checkoutUrl ?? '').trim()).length + ' wired to checkout');
console.log('  preview.html        design preview');
console.log(`  newsletter          ${NL_WIRED ? newsletter.formAction : 'NOT CONNECTED — set newsletter.formAction in app.config.json'}`);
console.log(`  live data app       ${liveApp.url || 'not set'}`);
console.log(`  site url            ${SITE_URL || 'not set — canonical, og:url and sitemap.xml are skipped'}`);
