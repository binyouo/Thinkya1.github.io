# binzi.top

个人博客，基于 [Shiro](https://github.com/Innei/Shiro) 前端 + 仓库内 Markdown 内容。

Shiro 是基于 Next.js 的博客前端，原版从 [Mix Space Core](https://github.com/mx-space/core)
获取内容。Hexo 则在构建时把 Markdown 生成为静态网站，两者的数据和部署方式不同。

本站目前没有独立服务器，继续使用 Markdown + Git 写作并部署到 Vercel。
`apps/web/src/app/api/v2` 提供只读的 Mix Space 兼容接口，读取
`apps/web/content/posts` 和 `apps/web/content/pages`。服务端渲染直接调用本地内容层，
浏览器通过同源 `/api/v2` 获取数据，因此当前部署不依赖 Core 或数据库。

已接入文章列表与详情、分类和标签筛选、搜索、文章时间线、独立页面、RSS、站点地图和旧链接重定向。
评论、账号登录、点赞、阅读计数、邮件订阅和实时在线状态尚未接入持久化服务；日记、
说说、动态、友链和项目页也没有对应内容源。要启用这些功能，需要接入 Core 等后端服务、
准备其数据库并完成内容迁移。迁移范围和验证记录见 [迁移状态](./docs/shiro-migration-status.md)。

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
`description`、`categories`、`tags`、`slug`、`abbrlink`。分类取第一个值，文章地址为
`/posts/{分类 slug}/{文章 slug}`；文章 slug 依次取 `slug`、`abbrlink` 或文件名，中文分类直接使用中文。

独立页面放在 `apps/web/content/pages`，默认以文件名作为页面地址，如 `about.md` 对应 `/about`。
Obsidian 可直接打开 `apps/web/content`。生产环境的内容随部署更新，发布文章后需要触发一次新部署。

图片放在 `apps/web/public` 下，用绝对路径引用，例如
`![](/images/biny-memory/arch-overview.png)`。

旧 Hexo 链接 `/:year/:month/:day/:title/` 会在构建时生成 308 重定向到新地址。

## 本地开发

```bash
pnpm install
pnpm dev            # http://localhost:2323
pnpm --filter @shiro/web test
pnpm build
```

## 部署

部署到 Vercel，Root Directory 设为 `apps/web`，框架选择 Next.js。
`next.config.mjs` 会把 Markdown 纳入服务端部署产物。站点自带 `/api/v2`，当前只读博客不需要额外的 API 服务。
`NEXT_PUBLIC_SITE_URL` 用于 RSS、站点地图和文章 canonical URL，应设为站点的正式地址；默认是 `https://binzi.top`。

## 许可

前端来自 Shiro，遵循 [AGPL-3.0](./LICENSE) 与 [ADDITIONAL_TERMS](./ADDITIONAL_TERMS.md)，
保留原版权与协议声明。
