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
    ? /(?:Z|[+-]\d{2}:?\d{2})$/i.test(str)
      ? str.replace(' ', 'T')
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
  if (Array.isArray(value))
    return value.map((t) => String(t).trim()).filter(Boolean)
  return String(value)
    .split(/[,，]/)
    .map((t) => t.trim())
    .filter(Boolean)
}

const normalizeCategories = (value) => {
  if (!value) return []
  if (Array.isArray(value))
    return value.map((c) => String(c).trim()).filter(Boolean)
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
let cacheSignature = ''

const loadAll = () => {
  if (cache && process.env.NODE_ENV === 'production') return cache
  const files = walkMarkdown(CONTENT_DIR)
  // Markdown is the editing surface in development. A module-lifetime cache
  // otherwise keeps edits, new posts and deletions invisible until restart.
  const signature = files
    .map((file) => {
      const stat = fs.statSync(file)
      return `${file}:${stat.mtimeMs}:${stat.size}`
    })
    .join('\n')
  if (cache && signature === cacheSignature) return cache
  const categoryMap = new Map()
  const posts = []

  for (const file of files) {
    const rel = path.relative(CONTENT_DIR, file)
    const raw = fs.readFileSync(file, 'utf8')
    const { data, body } = parseFrontMatter(raw)
    if (data.published === false) continue
    const basename = path.basename(file, '.md')
    const categories = normalizeCategories(data.categories)
    const primary = categories[0] || '未分类'
    const category =
      categoryMap.get(categorySlug(primary)) || buildCategory(primary)
    categoryMap.set(category.slug, category)
    category.count += 1

    const created =
      toIso(data.date) || new Date(fs.statSync(file).mtime).toISOString()
    const modified = toIso(data.updated) || created
    const slug = String(data.slug || data.abbrlink || basename)
    const image = firstImage(body)
    const tags = normalizeTags(data.tags)

    posts.push({
      id: hash(rel),
      _rel: rel,
      _categories: categories,
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
  cacheSignature = signature
  return cache
}

const loadPages = () => {
  const pages = []
  for (const file of walkMarkdown(PAGES_DIR)) {
    const rel = path.relative(PAGES_DIR, file)
    const raw = fs.readFileSync(file, 'utf8')
    const { data, body } = parseFrontMatter(raw)
    if (data.published === false) continue
    const slug = String(data.slug || path.basename(file, '.md'))
    pages.push({
      id: hash(`page:${rel}`),
      title: String(data.title || slug),
      slug,
      subtitle: data.subtitle ? String(data.subtitle) : undefined,
      text: body,
      created: toIso(data.date) || fs.statSync(file).mtime.toISOString(),
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
  const { _rel, _categories, ...rest } = post
  return {
    ...rest,
    text: excerpt(post.text),
  }
}

const toDetail = (post) => {
  const { _rel, _categories, ...rest } = post
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
  icon: '/img/avatar.jpg?v=biny-icon-1',
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
    site: {
      favicon: '/img/avatar.jpg?v=biny-icon-1',
      faviconDark: '/img/avatar.jpg?v=biny-icon-1',
    },
    hero: {
      title: {
        template: [
          {
            type: 'h1',
            text: 'biny',
            class: 'text-4xl font-semibold tracking-tight lg:text-5xl',
          },
          { type: 'span', text: ' 的博客', class: 'ml-2 text-2xl lg:text-3xl' },
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
          {
            name: 'GitHub',
            href: 'https://github.com/Thinkya1',
            external: true,
          },
        ],
      },
    ],
    otherInfo: {
      date: String(new Date().getFullYear()),
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

const postPath = (post) =>
  `/posts/${encodeURIComponent(post.category.slug)}/${encodeURIComponent(post.slug)}`

const publicationLastYear = (posts) => ({
  posts: posts
    .filter(
      (post) =>
        new Date(post.created).getTime() >=
        Date.now() - 365 * 24 * 60 * 60 * 1000,
    )
    .map(timelinePost),
  notes: [],
})

const calendarDate = (value) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value))
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]))
}

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

const notFound = () =>
  json({ message: 'Not Found', statusCode: 404 }, { status: 404 })

export const handleGet = (segments, searchParams) => {
  const [head, ...rest] = segments
  const { posts, categories } = loadAll()
  const param = (key) => searchParams.get(key) ?? undefined
  const numberParam = (key, fallback) => {
    const value = Number(param(key))
    return Number.isSafeInteger(value) && value > 0 ? value : fallback
  }

  switch (head) {
    case 'aggregate': {
      if (rest.length > 1) return notFound()
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
            allowComment: post.allowComment,
          })),
          says: [],
        })
      }
      if (rest[0] === 'timeline') {
        const type = param('type')
        const year = Number(param('year')) || 0
        const inYear = (item) =>
          !year || Number(calendarDate(item.created).year) === year
        const list = posts.filter(inYear)
        const timelinePosts =
          type === '1'
            ? []
            : list.map((post) => ({
                ...timelinePost(post),
                url: `${ORIGIN}${postPath(post)}`,
              }))
        const timelineNotes = type === '0' ? [] : []
        return json({ data: { posts: timelinePosts, notes: timelineNotes } })
      }
      if (rest[0] === 'last-year') {
        return json(publicationLastYear(posts))
      }
      if (rest[0] === 'sitemap') {
        return json({
          data: [
            ...posts.map((post) => ({
              url: `${ORIGIN}${postPath(post)}`,
              published_at: post.modified || post.created,
            })),
            ...loadPages().map((page) => ({
              url: `${ORIGIN}/${encodeURIComponent(page.slug)}`,
              published_at: page.modified || page.created,
            })),
          ],
        })
      }
      if (rest[0] === 'feed') {
        return json({
          title: aggregateSeo().title,
          author: 'biny',
          description: aggregateSeo().description,
          url: ORIGIN,
          data: posts.map((post) => ({
            id: post.id,
            title: post.title,
            text: post.text,
            link: `${ORIGIN}${postPath(post)}`,
            created: post.created,
            modified: post.modified,
            images: post.images,
            allowComment: post.allowComment,
          })),
        })
      }
      if (rest[0] === 'stat') {
        return json({
          posts: posts.length,
          words: posts.reduce(
            (total, post) =>
              total +
              (stripMarkdown(post.text).match(/\p{Script=Han}|[\p{L}\p{N}]+/gu)
                ?.length || 0),
            0,
          ),
          days: posts.length
            ? Math.max(
                1,
                Math.floor(
                  (Date.now() - new Date(posts.at(-1).created).getTime()) /
                    86400000,
                ) + 1,
              )
            : 0,
          notes: 0,
          says: 0,
          categories: categories.length,
        })
      }
      if (rest.length) return notFound()
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
      if (rest.length > 2) return notFound()
      // /posts/get-url/:slug  (category redirect)
      if (rest[0] === 'get-url') {
        const slug = rest[1]
        const post = posts.find((p) => p.slug === slug)
        if (!post) return notFound()
        return json({ path: postPath(post).slice('/posts'.length) })
      }
      if (rest[0] === 'latest' && rest.length === 1) {
        return posts.length ? json(toDetail(posts[0])) : notFound()
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
      if (year)
        list = list.filter((p) => Number(calendarDate(p.created).year) === year)
      const categoryFilter = param('category')
      if (categoryFilter)
        list = list.filter(
          (p) =>
            p.category.slug === categoryFilter ||
            p.category.id === categoryFilter,
        )
      const tagFilter = param('tag')
      if (tagFilter) list = list.filter((p) => p.tags.includes(tagFilter))
      const sortBy = param('sortBy') === 'modified' ? 'modified' : 'created'
      const sortOrder = param('sortOrder')
      const direction = sortOrder === '1' || sortOrder === 'asc' ? 1 : -1
      list.sort(
        (a, b) => direction * (new Date(a[sortBy]) - new Date(b[sortBy])),
      )
      const start = (page - 1) * size
      return json({
        data: list.slice(start, start + size).map(toListItem),
        pagination: pager(list.length, size, page),
      })
    }

    case 'categories': {
      if (rest.length > 1) return notFound()
      if (rest.length >= 1) {
        const key = rest[0]
        // tag detail: /categories/:name?tag=1
        if (param('tag') === '1' || param('tag') === 'true') {
          const tagged = posts.filter((post) => post.tags.includes(key))
          return json({ data: tagged.map(toListItem) })
        }
        // category detail by id or slug
        const category = categories.find((c) => c.slug === key || c.id === key)
        if (!category) return notFound()
        return json({
          data: posts
            .filter((p) => p.category.slug === category.slug)
            .map(toListItem),
        })
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
      if (rest.length > 2 || (rest.length === 2 && rest[0] !== 'slug'))
        return notFound()
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
      if (rest.length === 1 && rest[0] === 'latest') return json({ data: null })
      return rest.length
        ? notFound()
        : json(emptyPage(numberParam('size', 10), numberParam('page', 1)))

    case 'says':
    case 'projects':
    case 'topics':
    case 'links':
    case 'recently':
    case 'shorthand':
      if (rest.length === 1 && rest[0] === 'all') return json({ data: [] })
      if (head === 'links' && rest.length === 1 && rest[0] === 'audit')
        return json({ can: false })
      return rest.length
        ? notFound()
        : json(emptyPage(numberParam('size', 10), numberParam('page', 1)))

    case 'comments':
      if (!rest.length || (rest.length === 2 && rest[0] === 'ref')) {
        return json(emptyPage(numberParam('size', 10), numberParam('page', 1)))
      }
      return notFound()

    case 'activity':
      if (rest.length === 1 && rest[0] === 'recent') return json({})
      if (rest.length === 1 && rest[0] === 'rooms')
        return json({
          roomCount: {},
          objects: { posts: [], notes: [], pages: [] },
        })
      if (rest.join('/') === 'last-year/publication')
        return json(publicationLastYear(posts))
      return notFound()

    case 'search': {
      const type = rest[0] || 'algolia'
      if (
        rest.length > 1 ||
        !['algolia', 'post', 'page', 'note'].includes(type)
      )
        return notFound()
      const tokens = (param('keyword') || '')
        .normalize('NFKC')
        .toLocaleLowerCase()
        .trim()
        .split(/\s+/)
        .filter(Boolean)
      const candidates = [
        ...(type === 'algolia' || type === 'post'
          ? posts.map((post) => ({
              ...toListItem(post),
              type: 'post',
              text: post.text,
            }))
          : []),
        ...(type === 'algolia' || type === 'page'
          ? loadPages().map((entry) => ({ ...entry, type: 'page' }))
          : []),
      ]
      // The search panel has no next-page control. Return all matches unless a
      // caller explicitly requests pagination.
      const size = numberParam('size', Math.max(1, candidates.length))
      const page = numberParam('page', 1)
      if (!tokens.length) return json(emptyPage(size, page))
      const normalized = (value) =>
        String(value || '')
          .normalize('NFKC')
          .toLocaleLowerCase()
      const matches = candidates
        .flatMap((entry) => {
          const title = normalized(entry.title)
          const tags = normalized(entry.tags?.join(' '))
          const body = normalized(`${entry.summary || ''} ${entry.text}`)
          if (
            !tokens.every((token) => `${title} ${tags} ${body}`.includes(token))
          )
            return []
          const score = tokens.reduce(
            (score, token) =>
              score +
              (title.includes(token) ? 4 : 0) +
              (tags.includes(token) ? 2 : 0),
            0,
          )
          return [{ entry, score }]
        })
        .sort(
          (a, b) =>
            b.score - a.score ||
            new Date(b.entry.created) - new Date(a.entry.created),
        )
      const start = (page - 1) * size
      return json({
        data: matches
          .slice(start, start + size)
          .map(({ entry }) => ({ ...entry, text: excerpt(entry.text) })),
        pagination: pager(matches.length, size, page),
      })
    }

    case 'server-time':
      return rest.length ? notFound() : json({ t2: Date.now(), t3: Date.now() })

    case 'options':
      if (rest.length === 1 && rest[0] === 'url')
        return json({ data: aggregateUrl() })
      return notFound()

    case 'owner':
      // `check_logged` -> the layout expects `{ ok }`.
      if (rest.length === 1 && rest[0] === 'check_logged')
        return json({ ok: false })
      if (rest.length === 1 && rest[0] === 'allow-login')
        return json({ allow: false })
      return notFound()

    case 'auth':
      if (rest.length === 1 && rest[0] === 'providers')
        return json({ data: [] })
      if (rest.length === 1 && ['get-session', 'session'].includes(rest[0]))
        return json(null)
      return notFound()

    case 'subscribe':
      if (rest.length === 1 && rest[0] === 'status')
        return json({ enable: false, allowTypes: [] })
      return notFound()

    case 'fn':
    case 'serverless':
      return rest.join('/') === 'shiro/status' ? json(null) : notFound()

    case 'like_this':
      return rest.length ? notFound() : json(0)

    default:
      return notFound()
  }
}

export const handleRequest = (
  method,
  segments,
  searchParams = new URLSearchParams(),
) => {
  if (method !== 'GET' && method !== 'HEAD') {
    return json(
      { message: 'This site serves repository content only.', statusCode: 405 },
      {
        status: 405,
        headers: { Allow: 'GET, HEAD' },
      },
    )
  }
  const response = handleGet(segments, searchParams)
  return method === 'HEAD'
    ? new Response(null, { status: response.status, headers: response.headers })
    : response
}

// ---------------------------------------------------------------------------
// redirects (old Hexo permalinks -> /posts/:category/:slug)
// ---------------------------------------------------------------------------

export const getRedirects = () => {
  const { posts } = loadAll()
  const redirects = new Map()
  const add = (source, destination) => {
    // Next matches redirect sources against the encoded request pathname.
    // Encode each segment so nested Hexo paths keep their directory separators.
    const encodedSource = source.split('/').map(encodeURIComponent).join('/')
    redirects.set(encodedSource, {
      source: encodedSource,
      destination,
      permanent: true,
    })
  }
  for (const post of posts) {
    const { year, month, day } = calendarDate(post.created)
    const basename = post._rel.split('/').pop().replace(/\.md$/, '')
    const destination = postPath(post)
    // Hexo's :title is its source-relative slug, including subdirectories.
    // Keep the initial migration's basename aliases as well.
    const titles = new Set([
      post._rel.replace(/\.md$/, ''),
      basename,
      post.slug,
    ])
    const sources = new Set(
      [...titles].flatMap((title) => {
        const source = `/${year}/${month}/${day}/${title}`
        return [source, `${source}/`]
      }),
    )
    for (const source of sources) {
      add(source, destination)
    }
    for (const tag of post.tags) {
      const destination = `/posts/tag/${encodeURIComponent(tag)}`
      for (const name of new Set([tag, tag.replaceAll(/\s+/g, '-')])) {
        add(`/tags/${name}`, destination)
        add(`/tags/${name}/`, destination)
      }
    }
    const categories = post._categories.length
      ? post._categories
      : [post.category.name]
    for (let length = 1; length <= categories.length; length++) {
      const prefix = categories
        .slice(0, length)
        .map((name) => name.replaceAll(/\s+/g, '-'))
        .join('/')
      const destination = `/posts/category/${encodeURIComponent(post.category.slug)}`
      add(`/categories/${prefix}`, destination)
      add(`/categories/${prefix}/`, destination)
    }
  }
  for (const source of ['/archives', '/tags', '/categories']) {
    add(source, '/posts')
    add(`${source}/`, '/posts')
  }
  return [...redirects.values()]
}

export const getContentDir = () => CONTENT_DIR
