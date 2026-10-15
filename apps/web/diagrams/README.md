# 文章中的手绘架构图

这里的 `.excalidraw` 是可编辑源文件，可导入 Excalidraw 调整文字、节点和连线。
`blogImage` 记录文章原有图片路径；`canvas` 记录导出尺寸。文章渲染器通过生成的清单切换为手绘图，无需重写正文。

修改后在 `apps/web` 运行 `pnpm diagrams:render`，生成 `public/diagrams/` 下的深浅色 SVG、可下载白板文件，以及渲染器清单。
导出使用 Rough.js 的手绘路径，颜色分别定义在导出脚本中；不会对整张图片应用反色滤镜。

中文字体是 [LXGW WenKai](https://github.com/lxgw/LxgwWenKai) 的按图裁剪版本，内嵌在 SVG 中，许可见 `public/diagrams/fonts/OFL.txt`。
字体子集添加新字符时，需要重新裁剪相应的 WOFF；裁剪字体的内部字体名为 `Blog Diagram Handwriting`。

原图保留供旧链接、RSS 和普通 Markdown 阅读器使用。代码示例与参数截图继续作为普通图片显示。
