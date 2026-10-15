import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET } from './route'

const { getFeed, getAggregate } = vi.hoisted(() => ({
  getFeed: vi.fn(),
  getAggregate: vi.fn(),
}))

vi.mock('~/lib/request', () => ({
  apiClient: {
    aggregate: {
      proxy: { feed: { get: getFeed } },
      getAggregateData: getAggregate,
    },
  },
}))

// These UI parsers import browser components. Ordinary Markdown still uses
// the real compiler and React renderer exercised by the feed route.
vi.mock('~/components/ui/markdown/parsers/container', () => ({
  ContainerRule: { order: 0, match: () => null },
}))
vi.mock('~/components/ui/markdown/parsers/ins', () => ({
  InsertRule: { order: 0, match: () => null },
}))
vi.mock('~/components/ui/markdown/parsers/mention', () => ({
  MentionRule: { order: 0, match: () => null },
}))
vi.mock('~/components/ui/markdown/parsers/spoiler', () => ({
  SpoilerRule: { order: 0, match: () => null },
}))

const article = {
  id: 'memory-system',
  title: '记忆系统',
  text: [
    '## 正文保留',
    '',
    '![架构](/images/biny-memory/arch-overview.png)',
    '',
    '![局部图](./detail.png)',
    '',
    '[关于](/about) [另一篇](./next-post) [段落](#正文保留)',
    '',
    '```ts',
    'const memory = true',
    '```',
  ].join('\n'),
  link: 'https://binzi.top/posts/ai/memory-system',
  created: '2026-10-14T00:00:00.000Z',
  modified: null,
  images: [
    {
      src: 'https://binzi.top/images/biny-memory/arch-overview.png',
      height: 480,
      width: 640,
    },
  ],
  allowComment: false,
}

beforeEach(() => {
  vi.clearAllMocks()
  const theme = {
    config: {
      site: { favicon: '/favicon.ico' },
      module: { rss: { noRSS: false, custom_elements: [] } },
    },
  }
  getAggregate.mockResolvedValue({
    seo: { title: 'biny 的博客', description: '技术笔记' },
    theme,
    $raw: { theme },
  })
  getFeed.mockResolvedValue({
    author: 'biny',
    url: 'https://binzi.top',
    data: [article],
  })
})

describe('RSS article rendering', () => {
  it('retains the full article and resolves images and links outside the site', async () => {
    const response = await GET()
    const xml = await response.text()

    expect(response.headers.get('Content-Type')).toBe('application/xml')
    expect(xml).toContain('正文保留')
    expect(xml).toContain('const memory = true')
    expect(xml).toContain(
      'src="https://binzi.top/images/biny-memory/arch-overview.png"',
    )
    expect(xml).toContain('height="480" width="640"')
    expect(xml).toContain('src="https://binzi.top/posts/ai/detail.png"')
    expect(xml).toContain('href="https://binzi.top/about"')
    expect(xml).toContain('href="https://binzi.top/posts/ai/next-post"')
    expect(xml).toContain(
      'href="https://binzi.top/posts/ai/memory-system#%E6%AD%A3%E6%96%87%E4%BF%9D%E7%95%99"',
    )
    expect(xml).toContain('Shiro (https://github.com/Innei/Shiro)')
    expect(xml).toContain('该渲染由 Shiro API 生成')
    expect(xml).not.toContain('当前内容无法在 RSS 阅读器中正确渲染')
    expect(xml).not.toContain('看完了？说点什么呢')
  })

  it('shows the comment link only when the article explicitly enables comments', async () => {
    getFeed.mockResolvedValue({
      author: 'biny',
      url: 'https://binzi.top',
      data: [{ ...article, allowComment: true }],
    })

    const xml = await (await GET()).text()

    expect(xml).toContain(
      'href="https://binzi.top/posts/ai/memory-system#comments"',
    )
    expect(xml).toContain('看完了？说点什么呢')
  })

  it('keeps the article when an image URL cannot be parsed', async () => {
    getFeed.mockResolvedValue({
      author: 'biny',
      url: 'https://binzi.top',
      data: [{ ...article, text: '正文仍在。\n\n![坏地址](http://[invalid)' }],
    })

    const xml = await (await GET()).text()

    expect(xml).toContain('正文仍在。')
    expect(xml).not.toContain('当前内容无法在 RSS 阅读器中正确渲染')
  })
})
