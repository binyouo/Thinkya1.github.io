// Markdown → Mix Space API compatibility layer.
//
// Shiro (@mx-space/api-client) expects a running Mix Space Core backend. This
// module reads the repository's Markdown files instead, and shapes them into
// the same REST payloads so the upstream frontend stays unmodified.
//
// Node-only. Used by the catch-all route handler in
// `src/app/api/v2/[...path]/route.ts` and by `next.config.mjs` for redirects.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { parse as parseYaml } from 'yaml'

// Next bundles this module into the route handler, so `import.meta.url` points
// inside `.next/server`. Resolve content from the app root instead: in dev,
// `next start`, and the standalone server the cwd is the `apps/web` directory.
const WEB_ROOT = process.env.CONTENT_ROOT || process.cwd()
const CONTENT_DIR = path.join(WEB_ROOT, 'content', 'posts')
const PAGES_DIR = path.join(WEB_ROOT, 'content', 'pages')

const ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || 'https://binzi.top'

// ---------------------------------------------------------------------------
// front matter + file scanning
// ---------------------------------------------------------------------------

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

const parseFrontMatter = (raw) => {
  const match = raw.match(FM_RE)
  if (!match) return { data: {}, body: raw }
  let data = {}
  try {
    data = parseYaml(match[1]) || {}
  } catch {
    data = {}
  }
  return { data, body: raw.slice(match[0].length) }
}

const toIso = (value) => {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  const str = String(value).trim()
  if (!str) return null
  // `2026-10-14 19:30:00` has no timezone: treat it as Asia/Shanghai (+08:00).
  const normalized = /\d{2}:\d{2}/.test(str)
    ? str.includes('+') || str.endsWith('Z')
      ? str
      : `${str.replace(' ', 'T')}+08:00`
    : `${str}T00:00:00+08:00`
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const hash = (input, len = 24) =>
  crypto.createHash('sha1').update(input).digest('hex').slice(0, len)

const categorySlug = (name) => {
  const trimmed = String(name || '').trim()
  if (!trimmed) return 'uncategorized'
  // ASCII names are lowercased with spaces to hyphens; CJK stays readable.
  // eslint-disable-next-line no-control-regex
  if (/^[\u0000-\u007F]+$/.test(trimmed)) {
    return trimmed.toLowerCase().replaceAll(/\s+/g, '-')
  }
  return trimmed
}

const firstImage = (markdown) => {
  const match = markdown.match(/!\[[^\]]*\]\(([^)\s]+)/)
  if (!match) return null
  const src = match[1]
  if (src.startsWith('http')) return src
  return `${ORIGIN}${src.startsWith('/') ? '' : '/'}${src}`
}

const stripMarkdown = (markdown) =>
  markdown
    .replaceAll(/```[\s\S]*?```/g, ' ')
    .replaceAll(/`[^`]*`/g, ' ')
    .replaceAll(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replaceAll(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replaceAll(/^#{1,6}\s+/gm, '')
    .replaceAll(/[*_~>]/g, '')
    .replaceAll(/\s+/g, ' ')
    .trim()

const excerpt = (markdown, limit = 310) => {
  const text = stripMarkdown(markdown)
  return text.length > limit ? `${text.slice(0, limit)}…` : text
}

const normalizeTags = (value) => {
  if (!value) return []
  if (Array.isArray(value)) return value.map((t) => String(t).trim()).filter(Boolean)
  return String(value)
    .split(/[,，]/)
    .map((t) => t.trim())
    .filter(Boolean)
}

const normalizeCategories = (value) => {
  if (!value) return []
  if (Array.isArray(value)) return value.map((c) => String(c).trim()).filter(Boolean)
  return String(value)
    .split(/[,，/]/)
    .map((c) => c.trim())
    .filter(Boolean)
}

const walkMarkdown = (dir) => {
  if (!fs.existsSync(dir)) return []
  const out = []
  const stack = [dir]
  while (stack.length) {
    const current = stack.pop()
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) stack.push(full)
      else if (entry.isFile() && entry.name.endsWith('.md')) out.push(full)
    }
  }
  return out.sort()
}

const buildCategory = (name) => {
  const slug = categorySlug(name)
  return { id: hash(`category:${slug}`), type: 0, name, slug, count: 0 }
}

let cache = null

const loadAll = () => {
  if (cache) return cache
  const files = walkMarkdown(CONTENT_DIR)
  const categoryMap = new Map()
  const posts = []

  for (const file of files) {
    const rel = path.relative(CONTENT_DIR, file)
    const raw = fs.readFileSync(file, 'utf8')
    const { data, body } = parseFrontMatter(raw)
    const basename = path.basename(file, '.md')
    const categories = normalizeCategories(data.categories)
    const primary = categories[0] || '未分类'
    const category = buildCategory(primary)
    categoryMap.set(category.slug, category)
    category.count += 1

    const created = toIso(data.date) || new Date(fs.statSync(file).mtime).toISOString()
    const modified = toIso(data.updated) || created
    const slug = String(data.slug || data.abbrlink || basename)
    const image = firstImage(body)
    const tags = normalizeTags(data.tags)

    posts.push({
      id: hash(rel),
      _rel: rel,
      title: String(data.title || basename),
      slug,
      category,
      tags,
      summary: data.description ? String(data.description) : null,
      text: body,
      created,
      modified,
      images: image
        ? [{ src: image, width: 0, height: 0, type: 'image', accent: '' }]
        : [],
      meta: image ? { cover: image } : null,
      count: { read: 0, like: 0 },
      copyright: true,
      allowComment: false,
      contentFormat: 'markdown',
      isPublished: true,
    })
  }

  posts.sort((a, b) => new Date(b.created) - new Date(a.created))
  cache = { posts, categories: [...categoryMap.values()] }
  return cache
}

const loadPages = () => {
  const pages = []
  for (const file of walkMarkdown(PAGES_DIR)) {
    const rel = path.relative(PAGES_DIR, file)
    const raw = fs.readFileSync(file, 'utf8')
    const { data, body } = parseFrontMatter(raw)
    const slug = String(data.slug || path.basename(file, '.md'))
    pages.push({
      id: hash(`page:${rel}`),
      title: String(data.title || slug),
      slug,
      subtitle: data.subtitle ? String(data.subtitle) : undefined,
      text: body,
      created: toIso(data.date) || new Date().toISOString(),
      modified: toIso(data.updated) || null,
      contentFormat: 'markdown',
      allowComment: false,
      images: [],
      order: data.order ?? 0,
      type: 0,
    })
  }
  return pages
}

// ---------------------------------------------------------------------------
// payload builders
// ---------------------------------------------------------------------------

const toListItem = (post) => {
  const { _rel, ...rest } = post
  return {
    ...rest,
    text: excerpt(post.text),
  }
}

const toDetail = (post) => {
  const { _rel, ...rest } = post
  return rest
}

const pager = (total, size, page) => {
  const totalPage = Math.max(1, Math.ceil(total / size))
  return {
    total,
    size,
    currentPage: page,
    totalPage,
    hasPrevPage: page > 1,
    hasNextPage: page < totalPage,
  }
}

const aggregateUser = () => ({
  id: 'owner',
  username: 'biny',
  name: 'biny',
  introduce: '我是 biny，记录一下自己的学习过程。',
  mail: 'zhubinjian06@163.com',
  url: `${ORIGIN}/about`,
  avatar: '/img/avatar.jpg',
  socialIds: {
    github: 'Thinkya1',
    email: 'zhubinjian06@163.com',
  },
  created: '2020-01-01T00:00:00.000Z',
  modified: new Date().toISOString(),
  v: 1,
  lastLoginTime: new Date().toISOString(),
  postID: '',
})

const aggregateSeo = () => ({
  title: 'biny 的博客',
  description: '记录学习过程与技术笔记。',
  icon: '/favicon.ico',
  keywords: ['biny', '博客', '技术笔记'],
})

const aggregateUrl = () => ({
  webUrl: ORIGIN,
  adminUrl: ORIGIN,
  serverUrl: ORIGIN,
  wsUrl: '',
})

const aggregateTheme = () => ({
  config: {
    site: { favicon: '/favicon.ico', faviconDark: '/favicon.ico' },
    hero: {
      title: {
        template: [
          { type: 'h1', text: 'biny' },
          { type: 'span', text: ' 的博客', class: 'ml-2' },
        ],
      },
      description: '记录学习过程与技术笔记。',
      hitokoto: { random: false, custom: 'Stay hungry, stay foolish.' },
    },
    module: {
      subscription: {},
      og: { avatar: '/img/avatar.jpg' },
      donate: { enable: false, link: '', qrcode: [] },
      bilibili: { liveId: 0 },
      activity: { enable: false, endpoint: '' },
      openpanel: { enable: false, id: '', url: '' },
      rss: { custom_elements: [], noRSS: false },
      signature: { svg: '', animated: true },
      posts: { mode: 'loose' },
    },
  },
  footer: {
    linkSections: [
      {
        name: '友链',
        links: [
          { name: 'GitHub', href: 'https://github.com/Thinkya1', external: true },
        ],
      },
    ],
    otherInfo: {
      date: `© ${new Date().getFullYear()} biny`,
    },
  },
})

const timelinePost = (post) => ({
  id: post.id,
  title: post.title,
  slug: post.slug,
  created: post.created,
  modified: post.modified,
  category: post.category,
})

const emptyPage = (size = 10, page = 1) => ({
  data: [],
  pagination: pager(0, size, page),
})

// ---------------------------------------------------------------------------
// GET dispatch
// ---------------------------------------------------------------------------

const json = (data, init) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...init?.headers,
    },
  })

const notFound = () => json({ message: 'Not Found', statusCode: 404 }, { status: 404 })

export const handleGet = (segments, searchParams) => {
  const [head, ...rest] = segments
  const { posts, categories } = loadAll()
  const param = (key) => searchParams.get(key) ?? undefined
  const numberParam = (key, fallback) => {
    const value = Number(param(key))
    return Number.isFinite(value) && value > 0 ? value : fallback
  }

  switch (head) {
    case 'aggregate': {
      if (rest[0] === 'top') {
        const size = numberParam('size', 5)
        return json({
          notes: [],
          posts: posts.slice(0, size).map((post) => ({
            id: post.id,
            slug: post.slug,
            title: post.title,
            created: post.created,
            category: post.category,
            images: post.images,
          })),
          says: [],
        })
      }
      if (rest[0] === 'timeline') {
        const type = param('type')
        const year = Number(param('year')) || 0
        const inYear = (item) =>
          !year || new Date(item.created).getFullYear() === year
        const list = posts.filter(inYear)
        const timelinePosts =
          type === '1' ? [] : list.map((post) => ({ ...timelinePost(post), url: `${ORIGIN}/posts/${post.category.slug}/${post.slug}` }))
        const timelineNotes = type === '0' ? [] : []
        return json({ data: { posts: timelinePosts, notes: timelineNotes } })
      }
      if (rest[0] === 'last-year') {
        const since = Date.now() - 365 * 24 * 60 * 60 * 1000
        const recent = posts.filter((post) => new Date(post.created).getTime() >= since)
        const source = recent.length ? recent : posts.slice(0, 20)
        return json({
          posts: source.map((post) => ({
            id: post.id,
            slug: post.slug,
            title: post.title,
            created: post.created,
            category: post.category,
          })),
          notes: [],
        })
      }
      if (rest[0] === 'sitemap') {
        return json({
          data: posts.map((post) => ({
            url: `${ORIGIN}/posts/${post.category.slug}/${post.slug}`,
            published_at: post.created,
          })),
        })
      }
      if (rest[0] === 'feed') {
        return json({
          title: aggregateSeo().title,
          author: 'biny',
          description: aggregateSeo().description,
          url: ORIGIN,
          data: posts.slice(0, 20).map((post) => ({
            id: post.id,
            title: post.title,
            text: post.text,
            link: `${ORIGIN}/posts/${post.category.slug}/${post.slug}`,
            created: post.created,
            modified: post.modified,
            images: post.images,
          })),
        })
      }
      if (rest[0] === 'stat') {
        return json({ posts: posts.length, notes: 0, says: 0, categories: categories.length })
      }
      // aggregate root
      return json({
        user: aggregateUser(),
        seo: aggregateSeo(),
        url: aggregateUrl(),
        categories,
        theme: aggregateTheme(),
        pageMeta: loadPages().map((page) => ({
          title: page.title,
          id: page.id,
          slug: page.slug,
          order: page.order,
        })),
        latestNoteId: { id: '', nid: 0 },
      })
    }

    case 'posts': {
      // /posts/get-url/:slug  (category redirect)
      if (rest[0] === 'get-url') {
        const slug = rest[1]
        const post = posts.find((p) => p.slug === slug)
        if (!post) return notFound()
        return json({ path: `/${post.category.slug}/${post.slug}` })
      }
      // /posts/:category/:slug (detail)
      if (rest.length >= 2) {
        const [category, slug] = rest
        const post = posts.find(
          (p) => p.slug === slug && p.category.slug === category,
        )
        if (!post) return notFound()
        return json(toDetail(post))
      }
      // /posts/:id (by id)
      if (rest.length === 1) {
        const post = posts.find((p) => p.id === rest[0])
        if (!post) return notFound()
        return json(toDetail(post))
      }
      // list
      const page = numberParam('page', 1)
      const size = numberParam('size', 10)
      let list = [...posts]
      const year = Number(param('year')) || 0
      if (year) list = list.filter((p) => new Date(p.created).getFullYear() === year)
      const categoryFilter = param('category')
      if (categoryFilter) list = list.filter((p) => p.category.slug === categoryFilter)
      const sortOrder = param('sortOrder')
      if (sortOrder === '1') list.reverse()
      const start = (page - 1) * size
      return json({
        data: list.slice(start, start + size).map(toListItem),
        pagination: pager(list.length, size, page),
      })
    }

    case 'categories': {
      if (rest.length >= 1) {
        const key = rest[0]
        // tag detail: /categories/:name?tag=1
        if (param('tag')) {
          const tagged = posts.filter((post) => post.tags.includes(key))
          return json({ data: tagged.map(toListItem) })
        }
        // category detail by id or slug
        const category = categories.find((c) => c.slug === key || c.id === key)
        if (!category) return notFound()
        return json({ data: posts.filter((p) => p.category.slug === category.slug).map(toListItem) })
      }
      const type = param('type')
      if (type === '1') {
        const tagMap = new Map()
        for (const post of posts) {
          for (const tag of post.tags) {
            tagMap.set(tag, (tagMap.get(tag) || 0) + 1)
          }
        }
        return json({
          data: [...tagMap.entries()].map(([name, count]) => ({ name, count })),
        })
      }
      return json({ data: categories })
    }

    case 'pages': {
      const pages = loadPages()
      if (rest[0] === 'slug' && rest[1]) {
        const page = pages.find((p) => p.slug === rest[1])
        if (!page) return notFound()
        return json(page)
      }
      if (rest.length === 1) {
        const page = pages.find((p) => p.id === rest[0] || p.slug === rest[0])
        if (!page) return notFound()
        return json(page)
      }
      return json({ data: pages, pagination: pager(pages.length, 10, 1) })
    }

    case 'notes':
      if (rest[0] === 'latest') return json({ data: null })
      return json(emptyPage(numberParam('size', 10), numberParam('page', 1)))

    case 'says':
    case 'projects':
    case 'topics':
    case 'links':
    case 'recently':
    case 'shorthand':
      if (rest[0] === 'all') return json({ data: [] })
      if (head === 'links' && rest[0] === 'audit') return json({ can: false })
      return json(emptyPage(numberParam('size', 10), numberParam('page', 1)))

    case 'comments':
      return json(emptyPage(numberParam('size', 10), numberParam('page', 1)))

    case 'activity':
      if (rest[0] === 'recent') return json({})
      if (rest[0] === 'rooms') return json({})
      if (rest[0] === 'last-year') return json({ posts: [], notes: [] })
      return json({})

    case 'search':
      return json({ data: [] })

    case 'server-time':
      return json({ t2: Date.now(), t3: Date.now() })

    case 'options':
      if (rest[0] === 'url') return json({ data: aggregateUrl() })
      return json({})

    case 'owner':
      // `check_logged` -> the layout expects `{ ok }`.
      if (rest[0] === 'check_logged') return json({ ok: false })
      if (rest[0] === 'allow-login') return json({})
      return json({})

    case 'auth':
      return json({})

    case 'serverless':
      return json(null)

    case 'like_this':
      return json(0)

    default:
      return json(emptyPage(numberParam('size', 10), numberParam('page', 1)))
  }
}

// ---------------------------------------------------------------------------
// redirects (old Hexo permalinks -> /posts/:category/:slug)
// ---------------------------------------------------------------------------

export const getRedirects = () => {
  const { posts } = loadAll()
  const list = []
  for (const post of posts) {
    const date = new Date(post.created)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const basename = post._rel.split('/').pop().replace(/\.md$/, '')
    const destination = `/posts/${post.category.slug}/${post.slug}`
    const sources = new Set([
      `/${year}/${month}/${day}/${basename}`,
      `/${year}/${month}/${day}/${basename}/`,
      `/${year}/${month}/${day}/${post.slug}`,
      `/${year}/${month}/${day}/${post.slug}/`,
    ])
    for (const source of sources) {
      list.push({ source, destination, permanent: true })
    }
  }
  list.push(
    { source: '/archives', destination: '/posts', permanent: true },
    { source: '/archives/', destination: '/posts', permanent: true },
    { source: '/tags', destination: '/posts', permanent: true },
    { source: '/tags/', destination: '/posts', permanent: true },
    { source: '/categories', destination: '/posts', permanent: true },
    { source: '/categories/', destination: '/posts', permanent: true },
  )
  return list
}

export const getContentDir = () => CONTENT_DIR
