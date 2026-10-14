'use strict';

// Inject the stylesheets and scripts this site adds on top of Volantis, without
// touching the theme. Kept in `scripts/` so Hexo auto-loads it; node_modules
// stays pristine.
// Revert = delete this file plus source/css/*.css and source/js/*.js.
const V = '20261014';
hexo.extend.injector.register('head_end',
  `<link rel="stylesheet" href="/css/reading-theme.css?v=${V}">` +
  `<link rel="stylesheet" href="/css/toc.css?v=${V}">` +
  `<link rel="stylesheet" href="/css/reading-meta.css?v=${V}">` +
  `<link rel="stylesheet" href="/css/list.css?v=${V}">` +
  `<link rel="stylesheet" href="/css/header.css?v=${V}">`);
hexo.extend.injector.register('body_end',
  `<script src="/js/reading-toc-extras.js?v=${V}" defer></script>` +
  `<script src="/js/reading-meta.js?v=${V}" defer></script>` +
  `<script src="/js/nav-active.js?v=${V}" defer></script>`);
