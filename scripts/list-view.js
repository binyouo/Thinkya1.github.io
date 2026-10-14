'use strict';

// Swap the Volantis list layouts (home / category / tag / archive) for a single
// editorial row list, ported from innei.in/categories/tech.
//
// The theme lives in node_modules and must stay pristine, so instead of copying
// it we replace the loaded views at generate time. `before_generate` runs after
// `theme.process()` (which reads the theme's own layout files) and before any
// route is rendered, so the override always wins — including in `hexo server`
// watch mode, where the theme box re-processes files on change.
const fs = require('fs');
const path = require('path');

// Templates live OUTSIDE scripts/ on purpose: Hexo loads every file under
// scripts/ as a JS module, so an .ejs file placed there is executed as code and
// throws "Unexpected token '<'" (harmless during `hexo generate`, but it spams
// the dev server and would break if a future version stopped swallowing it).
const VIEW_DIR = path.join(__dirname, '..', 'view-templates');

function readView(name) {
  return fs.readFileSync(path.join(VIEW_DIR, name), 'utf8');
}

const LIST_VIEW = readView('list.ejs');
const LIST_LAYOUTS = ['index', 'archive', 'category', 'tag'];

// The header is included via partial(), which resolves against the theme's
// layout dir first. Registering it as a theme view is what lets us override it.
const HEADER_VIEW = readView('header.ejs');
const HEADER_PATH = '_partial/header.ejs';

hexo.extend.filter.register('before_generate', function () {
  LIST_LAYOUTS.forEach(function (name) {
    hexo.theme.setView(name + '.ejs', LIST_VIEW);
  });
  hexo.theme.setView(HEADER_PATH, HEADER_VIEW);
});
