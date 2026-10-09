// 深色模式仍会单独给导航与移动端目录添加阴影，统一移除。
hexo.extend.injector.register('head_end', `<style id="flat-surfaces">
.l_header,
.article,
.widget,
#l_side .toc-wrapper {
  box-shadow: none !important;
}
</style>`);
