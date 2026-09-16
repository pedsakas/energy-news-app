/* ---------------------------------------------------------------------------
   support.js — a minimal standalone runtime for .dc.html Design Components.

   Inside the Claude Design canvas this file is IGNORED: the editor replaces the
   `<script src="./support.js"></script>` head line with its own inline runtime
   before rendering an artboard. Keep that head line exactly as it is.

   Outside the canvas — opening `Energy News Landing.dc.html` straight from disk
   — this runtime stands in for it, so the artboard renders in a plain browser
   without a build step. It implements the parts of the format the artboard
   actually uses:

     {{ dotted.path }}   in text nodes and attributes (dotted lookup only)
     <sc-for list as>    repeat, with {{ $index }} in scope
     <sc-if value>       conditional subtree
     <helmet>            contents hoisted into <head>
     onClick="{{ fn }}"  event handlers bound from renderVals()
     data-props          prop defaults and editor metadata

   It is a preview aid, not a reimplementation of Design Components. Anything
   the canvas supports and this does not will simply not render here.
   --------------------------------------------------------------------------- */

(function (global, document) {
  'use strict';

  if (global.__ED_SUPPORT__) return;
  global.__ED_SUPPORT__ = true;

  /* --- DCLogic ------------------------------------------------------------ */

  function DCLogic(props) {
    this.props = props || {};
    this.state = {};
  }
  DCLogic.prototype.setState = function (patch) {
    var next = typeof patch === 'function' ? patch(this.state, this.props) : patch;
    for (var k in next) if (Object.prototype.hasOwnProperty.call(next, k)) this.state[k] = next[k];
    if (this.__rerender) this.__rerender();
  };
  DCLogic.prototype.forceUpdate = function () { if (this.__rerender) this.__rerender(); };
  DCLogic.prototype.renderVals = function () { return {}; };
  DCLogic.prototype.componentDidMount = function () {};

  global.DCLogic = DCLogic;

  /* --- value lookup ------------------------------------------------------- */

  var SVG_NS = 'http://www.w3.org/2000/svg';

  var HOLE = /\{\{\s*([^{}]+?)\s*\}\}/g;
  var WHOLE_HOLE = /^\{\{\s*([^{}]+?)\s*\}\}$/;

  function lookup(path, scope) {
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (path === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    if (/^'.*'$/.test(path) || /^".*"$/.test(path)) return path.slice(1, -1);

    var parts = path.split('.');
    var cur = scope;
    for (var i = 0; i < parts.length; i++) {
      if (cur === null || cur === undefined) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function interpolate(str, scope) {
    return str.replace(HOLE, function (_, path) {
      var v = lookup(path, scope);
      return v === undefined || v === null ? '' : String(v);
    });
  }

  function truthy(v) {
    return Array.isArray(v) ? v.length > 0 : !!v;
  }

  /* Parsing the template is what makes the console noisy. The moment the parser
     builds <path d="{{ chart.gridPath }}">, SVG tries to read that as a path,
     fails, and logs — once per attribute, before any of our code has looked at
     it. The values are of course replaced a moment later, so the page is
     correct and the log is pure noise; but 77 lines of it on a page load is not
     something to leave lying around.

     So any attribute whose value still holds a {{ … }} is renamed to a data-*
     attribute before the markup is parsed. Nothing validates data-*. The
     original name is restored in renderNode, which is the only thing that reads
     these attributes anyway. */
  var HOLE_ATTR = /(\s)((?!data-hole-)[a-zA-Z_:][-\w:.]*)(\s*=\s*(?:"[^"]*\{\{[^"]*"|'[^']*\{\{[^']*'))/g;

  function shield(html) {
    return html.replace(HOLE_ATTR, function (_, ws, name, rest) {
      return ws + 'data-hole-' + name + rest;
    });
  }

  var SHIELD_PREFIX = 'data-hole-';

  /* Read an attribute that may have been shielded on the way in. */
  function attrOf(node, name) {
    return node.getAttribute(name) || node.getAttribute(SHIELD_PREFIX + name) || '';
  }

  /* --- rendering ---------------------------------------------------------- */

  function renderNodes(sourceNodes, scope, out) {
    for (var i = 0; i < sourceNodes.length; i++) renderNode(sourceNodes[i], scope, out);
  }

  function renderNode(node, scope, out) {
    if (node.nodeType === 3) {                       // text
      var text = node.nodeValue;
      out.appendChild(document.createTextNode(
        HOLE.test(text) ? (HOLE.lastIndex = 0, interpolate(text, scope)) : text
      ));
      HOLE.lastIndex = 0;
      return;
    }
    if (node.nodeType === 8) return;                 // comment — drop
    if (node.nodeType !== 1) return;

    var tag = node.tagName.toLowerCase();

    if (tag === 'sc-for') {
      var listAttr = attrOf(node, 'list');
      var m = listAttr.match(WHOLE_HOLE);
      var list = m ? lookup(m[1], scope) : [];
      var as = attrOf(node, 'as') || 'item';
      if (!Array.isArray(list)) list = [];
      for (var j = 0; j < list.length; j++) {
        var child = Object.create(scope);
        child[as] = list[j];
        child.$index = j;
        renderNodes(node.childNodes, child, out);
      }
      return;
    }

    if (tag === 'sc-if') {
      var valAttr = attrOf(node, 'value');
      var vm = valAttr.match(WHOLE_HOLE);
      var val = vm ? lookup(vm[1], scope) : valAttr;
      if (truthy(val)) renderNodes(node.childNodes, scope, out);
      return;
    }

    if (tag === 'dc-import') {
      var name = attrOf(node, 'name') || 'component';
      var note = document.createElement('div');
      note.setAttribute('style',
        'padding:12px;border:1px dashed rgba(246,243,238,.28);border-radius:3px;' +
        'font:12px ui-monospace,monospace;color:#97918a');
      note.textContent = '<dc-import name="' + name + '"> renders on the canvas, not in this standalone preview';
      out.appendChild(note);
      return;
    }

    var el = node.namespaceURI === SVG_NS
      ? document.createElementNS(SVG_NS, node.tagName)
      : document.createElement(tag);

    for (var a = 0; a < node.attributes.length; a++) {
      var attr = node.attributes[a];
      var an = attr.name, av = attr.value;
      if (an.indexOf(SHIELD_PREFIX) === 0) an = an.slice(SHIELD_PREFIX.length);
      if (an.indexOf('hint-') === 0) continue;

      var whole = av.match(WHOLE_HOLE);

      if (/^on[a-z]/.test(an)) {
        var fn = whole ? lookup(whole[1], scope) : null;
        if (typeof fn === 'function') el.addEventListener(an.slice(2).toLowerCase(), fn);
        continue;
      }

      if (whole) {
        var raw = lookup(whole[1], scope);
        if (raw === undefined || raw === null || raw === false) continue;
        el.setAttribute(an, raw === true ? '' : String(raw));
      } else {
        el.setAttribute(an, interpolate(av, scope));
      }
    }

    renderNodes(node.childNodes, scope, el);
    out.appendChild(el);
  }

  /* Render a node's children into a detached fragment (used for the root). */
  function renderElement(node, scope) {
    var frag = document.createDocumentFragment();
    renderNodes(node.childNodes, scope, frag);
    return frag;
  }

  /* --- boot --------------------------------------------------------------- */

  function readProps(scriptEl) {
    var defaults = {};
    var raw = scriptEl && scriptEl.getAttribute('data-props');
    if (!raw) return defaults;
    var spec;
    try { spec = JSON.parse(raw); } catch (e) {
      console.warn('[support.js] data-props is not valid JSON:', e.message);
      return defaults;
    }
    for (var k in spec) {
      if (k === '$preview') continue;
      if (spec[k] && typeof spec[k] === 'object' && 'default' in spec[k]) defaults[k] = spec[k]['default'];
    }
    // The canvas supplies prop values through its tweak chips. Standalone, they
    // come from app.config.json, injected by tools/build-preview.mjs.
    var override = global.ED_PROPS;
    if (override && typeof override === 'object') {
      for (var o in override) if (Object.prototype.hasOwnProperty.call(override, o)) defaults[o] = override[o];
    }
    return defaults;
  }

  function boot() {
    var root = document.querySelector('x-dc');
    if (!root) return;

    /* The static build parks the markup as raw text and hoists the helmet into
       the head itself. Raw text is the point: an inert template still builds
       SVG elements, and an SVG element parses "{{ chart.gridPath }}" as a path
       the moment the attribute is set, fails, and logs it — before any of this
       has run. Text is never parsed until we hand it over below. Hoisting the
       styles also stops them applying a frame late. On the canvas, and when the
       .dc.html is opened straight from disk, nothing is parked and the markup
       sits inside the x-dc element as authored. */
    var parked = document.getElementById('ed-artboard-src');
    var sourceHtml = parked ? (parked.textContent || parked.innerHTML) : root.innerHTML;

    var template = document.createElement('template');
    template.content.appendChild(document.createRange().createContextualFragment(shield(sourceHtml)));

    var helmet = template.content.querySelector('helmet');
    if (helmet) {
      while (helmet.firstChild) document.head.appendChild(helmet.firstChild);
      helmet.parentNode.removeChild(helmet);
    }

    var scriptEl = document.querySelector('script[data-dc-script]');
    var Comp = null;
    if (scriptEl && scriptEl.textContent.trim()) {
      try {
        Comp = new Function('DCLogic', scriptEl.textContent + '\n;return Component;')(DCLogic);
      } catch (e) {
        console.error('[support.js] component script failed:', e);
      }
    }

    var instance = Comp ? new Comp(readProps(scriptEl)) : new DCLogic(readProps(scriptEl));

    function draw() {
      var vals = instance.renderVals() || {};
      var scope = Object.create(vals);
      scope.props = instance.props;
      scope.state = instance.state;
      root.innerHTML = '';
      root.appendChild(renderElement(template.content, scope));
    }

    instance.__rerender = draw;
    draw();
    if (typeof instance.componentDidMount === 'function') instance.componentDidMount();

    global.__ED_COMPONENT__ = instance;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis, document);
