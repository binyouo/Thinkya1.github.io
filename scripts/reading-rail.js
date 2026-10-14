'use strict';

// Inject the reading rail + theme + article meta, without touching the theme.
// Kept in `scripts/` so Hexo auto-loads it; node_modules stays pristine.
// Revert = delete this file plus source/css/reading-*.css and source/js/reading-*.js
const V = '20261014';
hexo.extend.injector.register('head_end',
  `<link rel="stylesheet" href="/css/reading-theme.css?v=${V}">` +
  `<link rel="stylesheet" href="/css/reading-rail.css?v=${V}">` +
  `<link rel="stylesheet" href="/css/reading-meta.css?v=${V}">`);
hexo.extend.injector.register('body_end',
  `<script src="/js/reading-rail.js?v=${V}" defer></script>` +
  `<script src="/js/reading-toc-extras.js?v=${V}" defer></script>` +
  `<script src="/js/reading-meta.js?v=${V}" defer></script>`);
