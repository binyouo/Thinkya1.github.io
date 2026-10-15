import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { NormalContainer } from '~/components/layout/container/Normal'
import { PostTagsFAB } from '~/components/modules/post/fab/PostTagsFAB'
import { PostItemComposer } from '~/components/modules/post/PostItemComposer'
import { NothingFound } from '~/components/modules/shared/NothingFound'
import { SearchButton, SearchFAB } from '~/components/modules/shared/SearchFAB'
import { BackToTopFAB } from '~/components/ui/fab'
import { OnlyDesktop } from '~/components/ui/viewport'
import { Link } from '~/i18n/navigation'
import { apiClient } from '~/lib/request'
import { definePrerenderPage } from '~/lib/request.server'

import { PostListDataRevaildate } from './data-revalidate'

interface Props extends LocaleParams {
  page?: string
  size?: string
  sortBy?: string
  orderBy?: string
  view_mode?: string
  lang?: string
}

export const generateMetadata = async (
  props: NextPageParams<{ locale: string }>,
): Promise<Metadata> => {
  const { locale } = await props.params
  const t = await getTranslations({ namespace: 'common', locale })
  return { title: t('page_title_posts') }
}

export default definePrerenderPage<Props>()({
  fetcher: async (params) => {
    const { page, size, orderBy, sortBy, lang, locale } = params || {}
    const [list, tags, categories] = await Promise.all([
      apiClient.post.getList(Number(page) || 1, Number(size) || 10, {
        sortBy: sortBy as any,
        sortOrder: orderBy === 'asc' ? 1 : -1,
        truncate: 310,
        lang: lang === 'original' ? undefined : lang || locale,
      }),
      apiClient.category.getAllTags(),
      apiClient.category.proxy.get<{
        data: { id: string; name: string; slug: string; count: number }[]
      }>(),
    ])
    return { list, tags: tags.data, categories: categories.data }
  },
  Component: async ({ data: result, params, fetchedAt }) => {
    const { data, pagination } = result.list
    if (!data?.length) return <NothingFound />
    const pageHref = (page: number) =>
      `/posts?${new URLSearchParams({ page: String(page), ...(params.sortBy ? { sortBy: params.sortBy } : {}), ...(params.orderBy ? { orderBy: params.orderBy } : {}), ...(params.size ? { size: params.size } : {}), ...(params.lang ? { lang: params.lang } : {}) })}`
    const latest = params.orderBy !== 'asc' && params.sortBy !== 'modified'
    return (
      <NormalContainer className="paper-posts">
        <PostListDataRevaildate fetchedAt={fetchedAt} />
        <header>
          <span>BLOG</span>
          <h1>文章</h1>
        </header>
        <div className="paper-posts-grid">
          <div className="min-w-0">
            <div className="paper-posts-toolbar">
              <span>共 {pagination.total} 篇</span>
              <nav className="paper-sort" aria-label="文章排序">
                <Link href="/posts" aria-current={latest ? 'true' : undefined}>
                  最新
                </Link>
                <Link
                  href="/posts?sortBy=created&orderBy=asc"
                  aria-current={params.orderBy === 'asc' ? 'true' : undefined}
                >
                  最早
                </Link>
                <Link
                  href="/posts?sortBy=modified&orderBy=desc"
                  aria-current={
                    params.sortBy === 'modified' ? 'true' : undefined
                  }
                >
                  最近更新
                </Link>
              </nav>
            </div>
            <ul data-fetch-at={fetchedAt}>
              {data.map((post, index) => (
                <PostItemComposer key={post.id} index={index} data={post} />
              ))}
            </ul>
            <nav className="paper-pagination" aria-label="文章分页">
              {pagination.hasPrevPage ? (
                <Link href={pageHref(pagination.currentPage - 1)}>
                  ← 上一页
                </Link>
              ) : (
                <span>上一页</span>
              )}
              <span>
                第 {pagination.currentPage} 页，共 {pagination.totalPage} 页
              </span>
              {pagination.hasNextPage ? (
                <Link href={pageHref(pagination.currentPage + 1)}>
                  下一页 →
                </Link>
              ) : (
                <span>下一页</span>
              )}
            </nav>
          </div>
          <aside className="paper-post-sidebar" aria-label="搜索与分类">
            <SearchButton />
            <div className="paper-tags">
              {[...result.tags]
                .sort((a, b) => b.count - a.count)
                .slice(0, 14)
                .map((tag) => (
                  <Link
                    key={tag.name}
                    href={`/posts/tag/${encodeURIComponent(tag.name)}`}
                  >
                    {tag.name}
                    <span>({tag.count})</span>
                  </Link>
                ))}
            </div>
            <p>分类</p>
            <ul className="paper-collections">
              {result.categories.map((category) => (
                <li key={category.id}>
                  <Link
                    href={`/posts/category/${encodeURIComponent(category.slug)}`}
                  >
                    {category.name}
                    <span>{category.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        </div>
        <PostTagsFAB />
        <SearchFAB />
        <OnlyDesktop>
          <BackToTopFAB />
        </OnlyDesktop>
      </NormalContainer>
    )
  },
})
