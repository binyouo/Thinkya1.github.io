import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, test } from 'node:test'

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'shiro-content-'))
const originalRoot = process.env.CONTENT_ROOT
const originalNodeEnv = process.env.NODE_ENV
const originalTimezone = process.env.TZ
process.env.CONTENT_ROOT = fixtureRoot
process.env.NODE_ENV = 'test'
process.env.TZ = 'UTC'

const write = (relativePath, content) => {
  const file = path.join(fixtureRoot, 'content', relativePath)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}

write(
  'posts/算法/early.md',
  `---
title: Redis persistence
date: 2025-12-27 01:10:00
updated: 2026-01-03 00:30:00
categories: [Java, Technical Notes, 技术笔记]
tags: [CacheTag, Code Mode, 上下文]
---
UniqueBodyNeedle and persistence internals.
`,
)
write(
  'posts/later.md',
  `---
title: Agent tools
date: 2026-01-01 00:30:00
updated: 2026-01-02 00:30:00
categories: [Java]
---
Redis appears in this body.
`,
)
write(
  'posts/spaced name.md',
  `---
title: Recent publication
date: ${new Date().toISOString()}
categories: [AI]
---
Recent content.
`,
)
write(
  'posts/hidden.md',
  `---
title: Hidden search needle
published: false
categories: [Secret]
---
Hidden search needle.
`,
)
write(
  'pages/about.md',
  `---
title: About the author
date: 2020-01-01 00:00:00
---
PageBodyNeedle.
`,
)
for (let index = 0; index < 22; index++) {
  write(
    `posts/archive-${index}.md`,
    `---\ntitle: Archive ${index}\ndate: 2020-01-01 12:00:00\ncategories: [Archive]\n---\nArchive content.\n`,
  )
}

const { handleGet, handleRequest, getRedirects } = await import('./load.mjs')
const request = async (pathname, params = {}) =>
  handleGet(pathname.split('/'), new URLSearchParams(params)).json()

after(() => {
  fs.rmSync(fixtureRoot, { recursive: true, force: true })
  for (const [key, value] of Object.entries({
    CONTENT_ROOT: originalRoot,
    NODE_ENV: originalNodeEnv,
    TZ: originalTimezone,
  })) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

test('search finds title, full body, tags and pages with frontend result types', async () => {
  const title = await request('search/algolia', { keyword: 'rEdIs' })
  assert.equal(title.data[0].title, 'Redis persistence')
  assert.equal(title.data[0].type, 'post')
  assert.equal(title.data[0].category.slug, 'java')
  for (const keyword of ['UniqueBodyNeedle', 'CacheTag', 'Redis persistence']) {
    assert.equal(
      (await request('search/algolia', { keyword })).data[0].slug,
      'early',
    )
  }
  const page = await request('search/algolia', { keyword: 'pagebodyneedle' })
  assert.equal(page.data[0].type, 'page')
  assert.equal(page.data[0].slug, 'about')
  assert.equal(
    (await request('search/post', { keyword: 'PageBodyNeedle' })).data.length,
    0,
  )
  assert.equal(
    (await request('search/algolia', { keyword: 'Hidden search needle' })).data
      .length,
    0,
  )
  assert.equal(
    (await request('search/algolia', { keyword: '  ' })).data.length,
    0,
  )
  const secondPage = await request('search/algolia', {
    keyword: 'Archive',
    page: '2',
    size: '5',
  })
  assert.equal(secondPage.data.length, 5)
  assert.equal(secondPage.pagination.total, 22)
  assert.equal(secondPage.pagination.currentPage, 2)
})

test('category totals, filters and modified sorting match published content', async () => {
  const { data } = await request('categories')
  assert.equal(data.find((category) => category.slug === 'java').count, 2)
  assert.equal(
    data.reduce((total, category) => total + category.count, 0),
    25,
  )
  const created = await request('posts', {
    category: 'java',
    sortBy: 'created',
    sortOrder: '-1',
  })
  assert.deepEqual(
    created.data.map((post) => post.slug),
    ['later', 'early'],
  )
  const modified = await request('posts', {
    category: 'java',
    sortBy: 'modified',
    sortOrder: '-1',
  })
  assert.deepEqual(
    modified.data.map((post) => post.slug),
    ['early', 'later'],
  )
  assert.equal(
    (await request('posts', { tag: 'CacheTag' })).data[0].slug,
    'early',
  )
  assert.equal(
    (await request('posts', { year: '2026', category: 'java' })).data[0].slug,
    'later',
  )
})

test('homepage publication endpoint, unlimited feed and sitemap expose the content', async () => {
  const publication = await request('activity/last-year/publication')
  assert.ok(publication.posts.some((post) => post.slug === 'spaced name'))
  assert.ok(
    publication.posts.every(
      (post) => new Date(post.created).getFullYear() !== 2020,
    ),
  )
  const feed = await request('aggregate/feed')
  assert.equal(feed.data.length, 25)
  assert.equal(
    feed.data.find((post) => post.title === 'Recent publication').allowComment,
    false,
  )
  assert.ok(
    feed.data
      .find((post) => post.title === 'Recent publication')
      .link.endsWith('/posts/ai/spaced%20name'),
  )
  const sitemap = await request('aggregate/sitemap')
  assert.equal(sitemap.data.length, 26)
  assert.ok(sitemap.data.some((item) => item.url.endsWith('/about')))
})

test('legacy links keep Shanghai dates and the Hexo source-relative title in UTC', async () => {
  const redirects = getRedirects()
  const nested = redirects.find(
    (rule) => rule.source === '/2025/12/27/%E7%AE%97%E6%B3%95/early/',
  )
  assert.equal(nested?.destination, '/posts/java/early')
  assert.ok(redirects.some((rule) => rule.source === '/2025/12/27/early/'))
  assert.ok(!redirects.some((rule) => rule.source.startsWith('/2025/12/26/')))
  assert.equal(
    redirects.find(
      (rule) => rule.source === '/categories/Java/Technical-Notes/',
    )?.destination,
    '/posts/category/java',
  )
  assert.equal(
    redirects.find((rule) => rule.source === '/tags/Code-Mode/')?.destination,
    '/posts/tag/Code%20Mode',
  )
  assert.equal(
    redirects.find((rule) => rule.source === '/tags/Code%20Mode/')?.destination,
    '/posts/tag/Code%20Mode',
  )
  assert.equal(
    redirects.find(
      (rule) => rule.source === '/tags/%E4%B8%8A%E4%B8%8B%E6%96%87/',
    )?.destination,
    '/posts/tag/%E4%B8%8A%E4%B8%8B%E6%96%87',
  )
  assert.equal(
    redirects.find(
      (rule) =>
        rule.source ===
        '/categories/Java/Technical-Notes/%E6%8A%80%E6%9C%AF%E7%AC%94%E8%AE%B0/',
    )?.destination,
    '/posts/category/java',
  )
  assert.ok(redirects.every((rule) => !/[\u4E00-\u9FFF ]/.test(rule.source)))
  assert.equal(
    new Set(redirects.map((rule) => rule.source)).size,
    redirects.length,
  )
  assert.deepEqual(await request('posts/get-url/spaced name'), {
    path: '/ai/spaced%20name',
  })
})

test('unsupported operations fail honestly and disabled features have usable response shapes', async () => {
  for (const pathname of [
    'missing',
    'aggregate/missing',
    'posts/java/early/extra',
    'notes/missing',
    'activity/missing',
  ]) {
    assert.equal(
      handleGet(pathname.split('/'), new URLSearchParams()).status,
      404,
    )
  }
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const response = handleRequest(method, ['posts'])
    assert.equal(response.status, 405)
    assert.equal(response.headers.get('Allow'), 'GET, HEAD')
  }
  const head = handleRequest('HEAD', ['posts'])
  assert.equal(head.status, 200)
  assert.equal(await head.text(), '')
  assert.deepEqual(await request('auth/providers'), { data: [] })
  assert.equal(await request('auth/get-session'), null)
  assert.deepEqual(await request('subscribe/status'), {
    enable: false,
    allowTypes: [],
  })
  assert.deepEqual(await request('activity/rooms'), {
    roomCount: {},
    objects: { posts: [], notes: [], pages: [] },
  })
})

test('development content edits, additions and deletions refresh the loaded corpus', async () => {
  await request('posts')
  write(
    'posts/refresh.md',
    '---\ntitle: Newly written content\n---\nRefreshNeedle.\n',
  )
  assert.equal(
    (await request('search/algolia', { keyword: 'RefreshNeedle' })).data.length,
    1,
  )
  write(
    'posts/refresh.md',
    '---\ntitle: Edited content with a longer name\n---\nEditedNeedle.\n',
  )
  assert.equal(
    (await request('search/algolia', { keyword: 'RefreshNeedle' })).data.length,
    0,
  )
  assert.equal(
    (await request('search/algolia', { keyword: 'EditedNeedle' })).data.length,
    1,
  )
  fs.unlinkSync(path.join(fixtureRoot, 'content/posts/refresh.md'))
  assert.equal(
    (await request('search/algolia', { keyword: 'EditedNeedle' })).data.length,
    0,
  )
})
