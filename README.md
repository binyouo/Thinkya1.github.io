# binzi.top

个人博客，基于 [Shiro](https://github.com/Innei/Shiro) 前端 + 仓库内 Markdown 内容。

Shiro 原本要求一个运行中的 [Mix Space Core](https://github.com/mx-space/core) 后端。
这里把数据层换成了仓库里的 Markdown：`apps/web/src/app/api/v2` 提供一个只读的
Mix Space 兼容接口，直接读取 `content/posts`，因此写作流程仍然只是提交 Markdown，
部署也不需要数据库或独立服务器。

## 结构

```
apps/web/                 Shiro 前端（Next.js 16 App Router）
  content/                文章与页面（Markdown）
    posts/                文章（front matter + 正文）
    pages/                独立页面（如关于）
    .obsidian/            Obsidian vault 配置
  src/app/api/v2/[...path]/route.ts   Mix Space 兼容 API
  src/lib/content/load.mjs            Markdown 读取与聚合
patches/                  pnpm patch（修正依赖里 Next 无法解析的 CSS）
```

## 写作

在 `apps/web/content/posts` 下新建 Markdown，front matter 支持 `title`、`date`、`updated`、
`description`、`categories`、`tags`。分类取第一个值，文章地址为
`/posts/{分类 slug}/{文件名}`，中文分类直接使用中文。

图片放在 `apps/web/public` 下，用绝对路径引用，例如
`![](/images/biny-memory/arch-overview.png)`。

旧 Hexo 链接 `/:year/:month/:day/:title/` 会在构建时生成 308 重定向到新地址。

## 本地开发

```bash
pnpm install
pnpm dev            # http://localhost:2323
```

## 部署

部署到 Vercel，Root Directory 设为 `apps/web`，其余用默认的 Next.js 检测即可。
站点自带 `/api/v2`，不需要额外的 API 服务。

## 许可

前端来自 Shiro，遵循 [AGPL-3.0](./LICENSE) 与 [ADDITIONAL_TERMS](./ADDITIONAL_TERMS.md)，
保留原版权与协议声明。
