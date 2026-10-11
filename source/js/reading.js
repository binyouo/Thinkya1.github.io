'use strict';

(() => {
  function enhanceReading() {
    const main = document.querySelector('#l_main');
    if (main) main.tabIndex = -1;

    document.querySelectorAll('.u-search-input').forEach(input => {
      input.setAttribute('aria-label', '搜索文章');
      input.setAttribute('type', 'search');
    });

    const controls = { '.s-menu': '打开导航菜单', '.s-search': '打开搜索', '#s-top': '回到顶部' };
    for (const [selector, label] of Object.entries(controls)) {
      document.querySelectorAll(selector).forEach(control => {
        control.setAttribute('aria-label', label);
        control.setAttribute('role', 'button');
        control.setAttribute('tabindex', '0');
      });
    }

    const body = document.querySelector('#post-body');
    if (!body) return;
    const headings = [...body.querySelectorAll('h2[id], h3[id]')];
    if (headings.length && !document.querySelector('.reading-toc')) {
      const details = document.createElement('details');
      details.className = 'reading-toc';
      const summary = document.createElement('summary');
      summary.textContent = '本文目录';
      const nav = document.createElement('nav');
      nav.setAttribute('aria-label', '本文目录');
      const list = document.createElement('ul');
      headings.forEach(heading => {
        const item = document.createElement('li');
        if (heading.tagName === 'H3') item.className = 'reading-toc-child';
        const link = document.createElement('a');
        link.href = `#${encodeURIComponent(heading.id)}`;
        link.textContent = heading.textContent;
        item.append(link);
        list.append(item);
      });
      nav.append(list);
      details.append(summary, nav);
      body.before(details);
    }

    body.querySelectorAll('img').forEach(img => {
      img.decoding = 'async';
      img.loading = 'lazy';
      if (img.closest('a') || !img.getAttribute('src') || img.getAttribute('src').startsWith('data:')) return;
      const link = document.createElement('a');
      link.className = 'reading-image';
      link.href = img.src;
      link.target = '_blank';
      link.rel = 'noopener';
      link.setAttribute('aria-label', `查看大图：${img.alt || '文章配图'}`);
      img.before(link);
      link.append(img);
    });
  }

  document.addEventListener('keydown', event => {
    const target = event.target;
    if (target instanceof Element && target.matches('a[role="button"]') && ['Enter', ' '].includes(event.key)) {
      event.preventDefault();
      target.click();
    }
  });
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target.closest('.reading-toc a') : null;
    if (target) target.closest('details').open = false;
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhanceReading);
  else enhanceReading();
  document.addEventListener('pjax:complete', enhanceReading);
})();
