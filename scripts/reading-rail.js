'use strict';

// Inject the Yohaku-style reading rail + dark/gold theme without touching the theme.
// Kept in `scripts/` so Hexo auto-loads it; node_modules stays pristine.
// Revert = delete this file + the two source/css|js assets.
const V = '20261013';
hexo.extend.injector.register('head_end',
  `<link rel="stylesheet" href="/css/reading-theme.css?v=${V}">` +
  `<link rel="stylesheet" href="/css/reading-rail.css?v=${V}">`);
hexo.extend.injector.register('body_end',
  `<script src="/js/reading-rail.js?v=${V}" defer></script>`);
