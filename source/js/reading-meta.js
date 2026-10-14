/* ============================================================
   Article meta: reading stats (busuanzi) + back-to-top button.
   Busuanzi exposes exactly three real counters:
     site_pv (site page views) · site_uv (site visitors) · page_pv (this page)
   There is NO "concurrent readers" number available to a static site —
   that needs a live backend, so this file does not pretend to have one.
   ============================================================ */
(function () {
  'use strict';

  // The official busuanzi host. The popular icodeq.com mirror is currently
  // serving its script but its counter API is down (ROUTER_EXTERNAL_TARGET_
  // CONNECTION_ERROR), so it would render permanent dashes. Verified working:
  //   {site_uv:2, page_pv:1, site_pv:2}
  var BZ_SCRIPT = 'https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js';

  function h(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function mount() {
    var body = document.querySelector('#post-body');
    if (!body) return;
    var article = body.closest('article') || body;

    // ---------- 1. stats row, injected under the article title ----------
    var heading = document.querySelector('.article-title, .post-title, h1');
    var host = heading ? heading.parentElement : null;

    // busuanzi keys every counter to the exact hostname the page runs on. The
    // "localhost" bucket is shared by everyone in the world who runs it
    // locally, so a dev preview shows eight-figure nonsense. Only the real
    // domain has meaningful numbers — anywhere else, skip the row entirely
    // rather than show someone else's traffic.
    var canonical = /(^|\.)binzi\.top$/i.test(location.hostname);
    if (canonical) {
      var stats = h('div', 'yh-stats');
    stats.innerHTML =
      '<span class="yh-stat" title="本篇阅读量">' +
        '<i class="yh-ico-eye" aria-hidden="true"></i>' +
        '<span class="yh-stat-label">阅读</span>' +
        '<span id="busuanzi_value_page_pv" class="yh-stat-num">–</span>' +
      '</span>' +
      '<span class="yh-stat-sep" aria-hidden="true">·</span>' +
      '<span class="yh-stat" title="本站总访问量">' +
        '<span class="yh-stat-label">本站访问</span>' +
        '<span id="busuanzi_value_site_pv" class="yh-stat-num">–</span>' +
      '</span>' +
      '<span class="yh-stat-sep" aria-hidden="true">·</span>' +
      '<span class="yh-stat" title="本站访客数">' +
        '<span class="yh-stat-label">访客</span>' +
        '<span id="busuanzi_value_site_uv" class="yh-stat-num">–</span>' +
      '</span>';

    if (host) {
      host.insertAdjacentElement('afterend', stats);
    } else {
      article.insertBefore(stats, article.firstChild);
    }
    }

    // ---------- 2. back button (fixed, bottom-left of the reading column) ----------
    var back = h('button', 'yh-back');
    back.type = 'button';
    back.setAttribute('aria-label', '返回上一页');
    back.title = '返回';
    back.innerHTML = '<i class="yh-ico-back" aria-hidden="true"></i><span>返回</span>';
    back.addEventListener('click', function () {
      if (history.length > 1) history.back();
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.body.appendChild(back);

    // it appears once you have actually started reading, so it doesn't sit
    // on top of the page header at rest
    function syncBack() {
      var show = window.scrollY > 400;
      back.classList.toggle('yh-back-shown', show);
    }
    window.addEventListener('scroll', syncBack, { passive: true });
    syncBack();

    // ---------- 3. load busuanzi (real counters) ----------
    if (canonical && !document.getElementById('busuanzi-script')) {
      var s = document.createElement('script');
      s.id = 'busuanzi-script';
      s.src = BZ_SCRIPT;
      s.async = true;
      s.referrerPolicy = 'no-referrer-when-downgrade';
      s.onerror = function () {
        // no network / blocked: hide the numbers rather than leave placeholders
        var row = document.querySelector('.yh-stats');
        if (row) row.classList.add('yh-stats-unavailable');
      };
      document.head.appendChild(s);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
