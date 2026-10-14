/* ============================================================
   Yohaku-style reading rail — port of innei.in's TocAside rail.
   Algorithm transcribed 1:1 from _next/static/chunks/0e5j0s4h3kad_.js

   Core idea: a vertical line at x=8 that BULGES to the right at the
   current reading position. The bulge amplitude is driven by scroll
   velocity with inertia, and its edges fade near the track's ends.
   ============================================================ */
(function () {
  'use strict';

  var ACTIVE_CLASS = 'yh-rail-active';
  var VISIBLE_CLASS = 'yh-rail-visible';

  // --- constants lifted from the reference implementation ---
  var X = 8;            // path x
  var RAIL_W = 48;      // w-12 container width, also the viewBox width
  var BULGE_MIN = 56;   // _ = 56 + 2.2 * A
  var BULGE_K = 2.2;
  var WIDTH_BASE = 8;   // s = 8 + F
  var RIPPLE_T = 9000;  // ms, the slow sine on the bulge amplitude
  var EASE_TAU = 140;   // ms, how fast we chase the target (activation)

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  // The exact path builder from the reference:
  //   M8 0 L8 a  C8 D-.45_, s D-.3_, s D  C s D+.3_, 8 D+.45_, 8 n  L8 c
  // `len` is the bulge length (_), `total` is the FULL track height (c) — the
  // tail of the path runs from the bulge all the way to the bottom.
  function buildPath(D, s, len, total) {
    var a = Math.max(0, D - len);
    var n = Math.min(total, D + len);
    return 'M' + X + ' 0' +
      ' L' + X + ' ' + a +
      ' C' + X + ' ' + (D - 0.45 * len) + ',' + s + ' ' + (D - 0.3 * len) + ',' + s + ' ' + D +
      ' C' + s + ' ' + (D + 0.3 * len) + ',' + X + ' ' + (D + 0.45 * len) + ',' + X + ' ' + n +
      ' L' + X + ' ' + total;
  }

  function mount() {
    // ---- find the article & its headings ----
    var body = document.querySelector('#post-body');
    if (!body) return;

    var raw = body.querySelectorAll('h2[id], h3[id]');
    if (!raw.length) return;

    // Build the TOC model: { heading, title, anchorId, depth }
    var rootDepth = 99;
    var headings = [];
    for (var i = 0; i < raw.length; i++) {
      var h = raw[i];
      var depth = parseInt(h.tagName.slice(1), 10);
      if (depth < rootDepth) rootDepth = depth;
      headings.push({
        el: h,
        title: (h.textContent || '').replace(/\s+/g, ' ').trim(),
        anchorId: h.id,
        depth: depth,
        ratio: 0          // filled in by computeRatios(); a fixed structural map
      });
    }

    // ---- build the DOM skeleton ----
    var rail = document.createElement('div');
    rail.className = 'yh-rail';
    rail.setAttribute('aria-hidden', 'true');

    var track = document.createElement('div');
    track.className = 'yh-rail-track';

    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'yh-rail-svg');
    svg.setAttribute('preserveAspectRatio', 'none');
    // viewBox matches the CSS pixel box; we set it on resize
    svg.setAttribute('viewBox', '0 0 ' + X + ' 800');

    var basePath = document.createElementNS(NS, 'path');
    basePath.setAttribute('class', 'yh-rail-base');

    var progPath = document.createElementNS(NS, 'path');
    progPath.setAttribute('class', 'yh-rail-progress');
    progPath.setAttribute('pathLength', '1');

    svg.appendChild(basePath);
    svg.appendChild(progPath);

    // dots, one per heading
    var dots = [];
    for (var d = 0; d < headings.length; d++) {
      var c = document.createElementNS(NS, 'circle');
      c.setAttribute('class', 'yh-rail-dot' + (headings[d].depth === rootDepth ? ' is-root' : ''));
      c.setAttribute('cx', String(X));
      c.setAttribute('cy', '0');
      c.setAttribute('r', headings[d].depth === rootDepth ? '1.75' : '1.25');
      svg.appendChild(c);
      dots.push(c);
    }

    var readout = document.createElement('div');
    readout.className = 'yh-rail-readout';
    var titleEl = document.createElement('span');
    titleEl.className = 'yh-rail-title';
    var pctEl = document.createElement('span');
    pctEl.className = 'yh-rail-percent';
    pctEl.textContent = '0%';
    readout.appendChild(titleEl);
    readout.appendChild(pctEl);

    track.appendChild(svg);
    track.appendChild(readout);
    rail.appendChild(track);

    // Placement: the rail lives in the empty left gutter, just outside the
    // article's left edge — matching the reference screenshot, and keeping it
    // clear of the right-hand TOC column (only ~64px of slack there).
    document.body.appendChild(rail);

    // right-edge hairline
    var edge = document.createElement('div');
    edge.className = 'yh-edge-progress';
    var edgeFill = document.createElement('i');
    edgeFill.style.height = '0%';
    edge.appendChild(edgeFill);
    document.body.appendChild(edge);

    // ---- state ----
    var trackH = 0;        // px height of the track
    var target = 0;        // 0..1 activation
    var cur = 0;           // eased activation
    var shownPct = 0;      // eased read percentage
    var lastY = null;      // for velocity
    var vel = 0;           // smoothed scroll velocity (px/s)
    var amp = 0;           // bulge amplitude (px)
    var ampVel = 0;
    var raf = null;
    var lastT = 0;
    var trackTopAbs = 0;   // absolute y of the track's top edge

    // The reference builds a FIXED map of where each heading sits inside the whole
    // document: ratio = (heading.top - root.top) / root.height, then cy = ratio * trackH.
    // Dots therefore do not move as you scroll — they are the article's structure.
    function computeRatios() {
      var rootEl = document.querySelector('#post-body') ||
                   document.querySelector('#post') ||
                   document.querySelector('#l_main') ||
                   document.body;
      var top = rootEl.getBoundingClientRect().top;
      var height = rootEl.offsetHeight || 1;
      for (var i = 0; i < headings.length; i++) {
        var r = (headings[i].el.getBoundingClientRect().top - top) / height;
        headings[i].ratio = Math.min(1, Math.max(0, r));
      }
    }

    function measure() {
      // keep the structural map fresh whenever layout can have shifted
      computeRatios();
      // Horizontal anchor. Two candidates, in order of preference:
      //   a) tucked in the gutter just left of the article
      //   b) pushed to the far left edge, which is what makes room for the
      //      read-out label (it sits 36px right of the line and is up to 150px
      //      wide, so it needs ~186px of clearance before the text starts)
      var articleEl = document.querySelector('#post-body') ||
                      document.querySelector('#post') ||
                      document.querySelector('#l_main');
      var LABEL_LEFT = 36;      // .yh-rail-readout { left: 36px }
      var LABEL_W = 150;        // .yh-rail-title { max-width: 140px } + slack
      var RAIL_W_PX = 48;       // w-12
      // On wide screens the CSS hides the read-out label (the TOC already names
      // the headings) and the article is a centred column with a wide gutter, so
      // the rail can always sit next to the text — no label clearance needed.
      var wide = window.matchMedia('(min-width: 1200px)').matches;
      var left = 16;
      var artLeft = articleEl ? Math.round(articleEl.getBoundingClientRect().left) : 0;
      if (articleEl) {
        var GUTTER = (wide ? 32 : RAIL_W_PX) + (wide ? 16 : 28);
        var near = artLeft - GUTTER;                  // (a)
        if (wide) {
          left = Math.max(0, near);
        } else {
          var roomNear = artLeft - (near + LABEL_LEFT); // space left for the label
          left = roomNear >= LABEL_W ? near : 16;      // (b) fall back to the edge
        }
      }
      rail.style.left = Math.max(0, left) + 'px';

      // The invisible hover strip should cover the gutter next to the article,
      // wherever that gutter happens to be once the column is centred.
      if (gutter && articleEl && artLeft > left + 24) {
        gutter.style.left = left + 'px';
        gutter.style.width = (artLeft - left) + 'px';
      }

      // If even the far-left position cannot fit the label, drop the label and
      // keep the rail itself — a bare line still reads as a progress indicator.
      var room = articleEl
        ? Math.round(articleEl.getBoundingClientRect().left) - (left + LABEL_LEFT)
        : LABEL_W;
      rail.classList.toggle('yh-rail-no-label', room < LABEL_W);

      var r = track.getBoundingClientRect();
      trackH = r.height || 0;
      trackTopAbs = r.top;
      var H = Math.max(1, trackH);
      // viewBox spans the FULL container width so nothing gets stretched;
      // the path lives at x=8 inside it, exactly like the reference.
      svg.setAttribute('viewBox', '0 0 ' + RAIL_W + ' ' + H);
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.style.width = RAIL_W + 'px';
      svg.style.height = H + 'px';
    }

    // ---- read percentage, same definition the reference uses ----
    function readPercent() {
      var doc = document.documentElement;
      var total = (doc.scrollHeight - window.innerHeight);
      if (total <= 0) return 100;
      return clamp((window.scrollY / total) * 100, 0, 100);
    }

    function activeIndex() {
      // the heading whose top is closest to (but not far past) the viewport top band
      var best = 0;
      var probe = window.innerHeight * 0.25;
      for (var i = 0; i < headings.length; i++) {
        if (headings[i].el.getBoundingClientRect().top <= probe) best = i;
        else break;
      }
      return best;
    }

    function frame(t) {
      var dt = lastT ? (t - lastT) : 16;
      lastT = t;
      if (dt > 64) dt = 64;   // clamp after a stall

      // activation ease (reference: 1 - exp(-dt/140))
      var k = 1 - Math.exp(-dt / EASE_TAU);
      cur += (target - cur) * k;
      if (Math.abs(target - cur) < 0.002) cur = target;

      // scroll velocity, smoothed
      var y = window.scrollY;
      if (lastY === null) lastY = y;
      var inst = (y - lastY) / dt * 1000;
      lastY = y;
      vel += (inst - vel) * Math.min(1, dt / 80);

      // bulge amplitude driven by |velocity| with inertia
      var targetAmp = Math.min(14, 0.012 * Math.abs(vel));
      var sub = Math.min(dt, 64) / 1000;
      ampVel += (90 * (targetAmp - amp) - 2 * Math.sqrt(90) * 0.75 * ampVel) * sub;
      amp = Math.max(-4, amp + ampVel * sub);

      // NOTE: the reference adds a constant "breathing" baseline here
      // (`10.4 + 0.6*sin(t/9s*2π)`), which means its line is never straight —
      // it always keeps a ~10px bulge. The requested behaviour is two distinct
      // states (idle = plain line, scrolling = curve), so the bulge is driven by
      // scroll velocity ONLY and decays to zero when the page settles.

      if (!trackH) { raf = requestAnimationFrame(frame); return; }

      var pct = readPercent();
      var tgtD = pct / 100 * trackH;
      shownPct += (tgtD - shownPct) * Math.min(1, 1.4 * k);

      var D = shownPct <= 0 ? tgtD : shownPct;

      // edge falloff: bulge fades out near both ends of the track
      var len = BULGE_MIN + BULGE_K * amp;
      var edgeF = clamp(Math.min(D / len, (trackH - D) / len), 0, 1);
      var F = cur * amp * edgeF;
      var s = WIDTH_BASE + F;

      var d = buildPath(D, s, len, trackH);
      basePath.setAttribute('d', d);
      progPath.setAttribute('d', d);
      progPath.setAttribute('stroke-dashoffset', String(0.06 - D / trackH));

      // dots sit at their fixed structural position; only cx reacts to the bulge
      for (var i = 0; i < dots.length; i++) {
        var cy = headings[i].ratio * trackH;
        dots[i].setAttribute('cy', String(cy));
        // cx drifts outward as the bulge approaches (reference formula)
        var near = Math.abs(cy - D) / len;
        var off = near >= 1 ? 0 : F * Math.pow(Math.cos(near * Math.PI / 2), 2);
        dots[i].setAttribute('cx', String(X + off));
      }

      // current heading gets the accent dot
      var ai = activeIndex();
      for (var j = 0; j < dots.length; j++) {
        if (j === ai) { dots[j].classList.add('is-current'); dots[j].setAttribute('r', '2.5'); }
        else {
          dots[j].classList.remove('is-current');
          dots[j].setAttribute('r', headings[j].depth === rootDepth ? '1.75' : '1.25');
        }
      }
      titleEl.textContent = headings[ai].title;

      // readout rides the reading position
      readout.style.transform = 'translateY(' + D + 'px) translateY(-50%)';

      var p = Math.round(pct);
      if (p !== lastShownPct) { pctEl.textContent = p + '%'; lastShownPct = p; }
      edgeFill.style.height = pct + '%';

      raf = requestAnimationFrame(frame);
    }
    var lastShownPct = -1;

    // ---- activation: HOVER-REVEALED ----
    // Matches the reference (it reveals on hovering the aside) and the requested
    // behaviour: the rail is hidden at rest and fades in when the pointer enters
    // the reading area. It also reveals while actively scrolling, so the line is
    // visible during the gesture that gives it its curve.
    function setActive(on) {
      target = on ? 1 : 0;
      if (on) { rail.classList.add(ACTIVE_CLASS); rail.classList.add(VISIBLE_CLASS); }
      else rail.classList.remove(ACTIVE_CLASS);
    }

    var hovering = false;
    var scrollIdle = null;

    function reveal() {
      setActive(true);
      if (scrollIdle) clearTimeout(scrollIdle);
      // keep it up briefly after the gesture, then fall back to hover state
      scrollIdle = setTimeout(function () { if (!hovering) setActive(false); }, 1100);
    }

    // hover targets: the article, the TOC column, and the rail's own hit area
    var article = document.querySelector('#post-body');
    var hoverTargets = [
      article,
      article && (article.closest('article') || article),
      document.querySelector('#l_side'),
      rail
    ].filter(Boolean);
    hoverTargets.forEach(function (el) {
      el.addEventListener('mouseenter', function () { hovering = true; setActive(true); });
      el.addEventListener('mouseleave', function () { hovering = false; setActive(false); });
    });

    // the gutter strip left of the article is a thin hover target of its own,
    // so the rail is reachable without having to hover the text
    var gutter = document.createElement('div');
    gutter.className = 'yh-rail-gutter';
    gutter.setAttribute('aria-hidden', 'true');
    gutter.addEventListener('mouseenter', function () { hovering = true; setActive(true); });
    gutter.addEventListener('mouseleave', function () { hovering = false; setActive(false); });
    document.body.appendChild(gutter);

    window.addEventListener('scroll', reveal, { passive: true });

    window.addEventListener('resize', measure, { passive: true });
    measure();
    // lay the geometry out once (dots need positions) but stay hidden at rest
    target = 0; cur = 1;
    readout.style.transform = 'translateY(' + (readPercent() / 100 * trackH) + 'px) translateY(-50%)';
    raf = requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
