'use client'

import { RelativeTime } from '~/components/ui/relative-time'
import { Link } from '~/i18n/navigation'
import { routeBuilder, Routes } from '~/lib/route-builder'
import { useAggregationSelector } from '~/providers/root/aggregation-data-provider'

import { useHomeQueryData } from '../query'

export const ActivityPostList = () => {
  const { posts } = useHomeQueryData()
  const aggregation = useAggregationSelector((state) => state)
  if (!aggregation) return null
  const { categories, user } = aggregation
  return (
    <div className="paper-home-writing">
      <section>
        <header className="paper-section-heading">
          <span>RECENT WRITING</span>
          <h2>近期笔墨</h2>
        </header>
        <ol className="paper-recent-list">
          {posts.map((post, index) => (
            <li key={post.id}>
              <span className="paper-row-number">
                {String(index + 1).padStart(2, '0')}
              </span>
              <Link
                href={routeBuilder(Routes.Post, {
                  category: post.category.slug,
                  slug: post.slug,
                })}
              >
                <h3>{post.title}</h3>
                <span className="paper-row-category">
                  文章 · {post.category.name}
                </span>
              </Link>
              <time>
                <RelativeTime
                  date={post.created}
                  displayAbsoluteTimeAfterDay={180}
                />
              </time>
            </li>
          ))}
        </ol>
        <Link className="paper-text-link paper-more" href="/posts">
          翻阅全部文稿 <span aria-hidden="true">↗</span>
        </Link>
      </section>
      <aside className="paper-home-notes">
        <section>
          <header className="paper-section-heading">
            <span>COLLECTIONS</span>
            <h2>归于何处</h2>
          </header>
          <ul className="paper-collections">
            {categories.map((category) => (
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
        </section>
        <section>
          <header className="paper-section-heading">
            <span>ABOUT</span>
            <h2>关于这里</h2>
          </header>
          <p>{user.introduce}</p>
          <Link className="paper-text-link" href="/about">
            认识一下 <span aria-hidden="true">↗</span>
          </Link>
        </section>
      </aside>
    </div>
  )
}
