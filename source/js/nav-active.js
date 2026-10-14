/* ============================================================
   Keep the right nav item highlighted on section sub-pages.

   The theme matches on an exact pathname (`/categories/` -> 分类), so
   `/categories/AI/`, `/tags/Agent/` and `/archives/2026/` end up with nothing
   highlighted. This picks the menu item with the longest matching path prefix
   and marks it instead, and does nothing when the theme already found one.
   ============================================================ */
(function () {
  'use strict';

  function sync() {
    var nav = document.querySelector('#l_header .yh-nav');
    if (!nav) return;

    var links = Array.prototype.slice.call(
      nav.querySelectorAll('.nav-list-h > li > a[href]')
    );
    if (!links.length) return;

    // The theme has already run and picked a winner on exact pages — keep it.
    if (nav.querySelector('.nav-list-h .menuitem.active')) return;

    var here = location.pathname.replace(/\/+$/, '') || '/';
    var best = null;
    var bestLen = -1;

    links.forEach(function (a) {
      var p;
      try { p = new URL(a.href, location.origin).pathname; } catch (e) { return; }
      p = p.replace(/\/+$/, '') || '/';

      var hit = p === '/' ? here === '/' : (here === p || here.indexOf(p + '/') === 0);
      if (hit && p.length > bestLen) { best = a; bestLen = p.length; }
    });

    if (!best) return;
    best.classList.add('active');
  }

  function boot() {
    sync();
    setTimeout(sync, 200);   // after the theme's own selection pass
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  document.addEventListener('pjax:success', boot);
  document.addEventListener('pjax:end', boot);
})();
