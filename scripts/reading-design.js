'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Keep the theme dependency intact; override only its article-list presentation.
hexo.extend.filter.register('before_generate', function () {
  hexo.theme.setView('_partial/post.ejs', fs.readFileSync(
    path.join(hexo.base_dir, 'layout/post-preview.ejs'), 'utf8'
  ));
});

hexo.extend.injector.register('head_end',
  '<link rel="stylesheet" href="/css/reading.css?v=20261012">');
hexo.extend.injector.register('body_begin',
  '<a class="skip-to-content" href="#l_main">跳到正文</a>');
hexo.extend.injector.register('body_end',
  '<script src="/js/reading.js?v=20261012" defer></script>');
