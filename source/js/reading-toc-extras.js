/* ============================================================
   TOC column accessories, ported from innei.in's TocAside:
     · a hand-drawn wavy rule under the heading list
     · a ring-progress read indicator + percentage
     · a "back to top" control that appears after you scroll
   The wavy path is picked at random from the reference's own five curves.
   ============================================================ */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  // verbatim from the reference bundle (_next/.../0e5j0s4h3kad_.js)
  var WAVES = [
    'M2 7 C4 2, 7 2, 9 5.5 C11 9, 14 9, 16 5 C18 1, 21 2, 24 6',
    'M2 6 C5 3, 8 3, 10 6 C12 9, 15 8, 18 5 C20 3, 23 4, 26 7',
    'M2 5 C4 8, 7 9, 10 6 C13 3, 15 2, 18 5.5 C20 8, 23 7, 25 5',
    'M2 7.5 C5 4, 8 3, 11 6 C13 8, 16 9, 19 5.5 C21 3, 23 4, 26 6',
    'M2 6.5 C4 3, 7 2.5, 9 5 C11 8, 14 8, 17 5 C19 2, 22 3, 25 6.5'
  ];

  function readPercent() {
    var doc = document.documentElement;
    var total = doc.scrollHeight - window.innerHeight;
    if (total <= 0) return 100;
    return Math.min(100, Math.max(0, (window.scrollY / total) * 100));
  }

  function svgEl(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs.hasOwnProperty(k)) e.setAttribute(k, attrs[k]);
    return e;
  }

  function mount() {
    var toc = document.querySelector('#l_side .toc-wrapper');
    if (!toc) return;
    var content = toc.querySelector('.content') || toc;

    // ---------- 1. wavy rule ----------
    var wavy = svgEl('svg', {
      class: 'yh-toc-wavy',
      viewBox: '0 0 28 10',
      fill: 'none',
      preserveAspectRatio: 'none'
    });
    wavy.appendChild(svgEl('path', {
      d: WAVES[Math.floor(Math.random() * WAVES.length)]
    }));
    content.appendChild(wavy);

    // ---------- 2. ring progress + percentage ----------
    var readout = document.createElement('div');
    readout.className = 'yh-toc-readout';

    var ringWrap = document.createElement('div');
    ringWrap.className = 'yh-toc-ring';

    var SIZE = 14, SW = 2, R = (SIZE - SW) / 2, CIRC = 2 * Math.PI * R;
    var ring = svgEl('svg', { width: SIZE, height: SIZE, viewBox: '0 0 ' + SIZE + ' ' + SIZE });
    ring.appendChild(svgEl('circle', {
      cx: SIZE / 2, cy: SIZE / 2, r: R, fill: 'none',
      stroke: 'rgba(168,168,168,0.35)', 'stroke-width': SW
    }));
    var arc = svgEl('circle', {
      cx: SIZE / 2, cy: SIZE / 2, r: R, fill: 'none',
      stroke: 'var(--yh-accent, #ac9753)', 'stroke-width': SW,
      'stroke-linecap': 'round', class: 'yh-toc-ring-progress',
      'stroke-dasharray': CIRC, 'stroke-dashoffset': CIRC,
      transform: 'rotate(-90 ' + SIZE / 2 + ' ' + SIZE / 2 + ')'
    });
    ring.appendChild(arc);

    var pct = document.createElement('span');
    pct.className = 'yh-toc-pct';
    pct.textContent = '0%';

    ringWrap.appendChild(ring);
    ringWrap.appendChild(pct);

    // ---------- 3. back to top ----------
    var top = document.createElement('button');
    top.type = 'button';
    top.className = 'yh-toc-top';
    top.setAttribute('aria-label', '回到顶部');
    var up = svgEl('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none' });
    up.appendChild(svgEl('path', {
      d: 'M12 19V5M5 12l7-7 7 7',
      stroke: 'currentColor', 'stroke-width': 2,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round'
    }));
    var topLabel = document.createElement('span');
    topLabel.textContent = '回到顶部';
    top.appendChild(up);
    top.appendChild(topLabel);
    top.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    readout.appendChild(ringWrap);
    readout.appendChild(top);
    content.appendChild(readout);

    // ---------- sync ----------
    var last = -1;
    function sync() {
      var p = readPercent();
      var r = Math.round(p);
      if (r !== last) {
        last = r;
        pct.textContent = r + '%';
        arc.setAttribute('stroke-dashoffset', String(CIRC - (p / 100) * CIRC));
      }
      top.classList.toggle('yh-toc-top-shown', window.scrollY > 400);
    }
    window.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync, { passive: true });
    sync();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
