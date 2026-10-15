import type { PostListItem } from '@mx-space/api-client'
import { memo } from 'react'
import RemoveMarkdown from 'remove-markdown'

import { Link } from '~/i18n/navigation'
import { routeBuilder, Routes } from '~/lib/route-builder'

import { PostMetaBar } from './PostMetaBar'

const PaperPostItem = ({ data }: { data: PostListItem }) => {
  const excerpt = RemoveMarkdown(data.summary || data.text || '')
    .replaceAll(/\s+/g, ' ')
    .trim()
  return (
    <li className="paper-post">
      <h2>
        <Link
          href={routeBuilder(Routes.Post, {
            category: data.category.slug,
            slug: data.slug,
          })}
        >
          {data.title}
        </Link>
      </h2>
      {excerpt && <p className="paper-post-excerpt">{excerpt.slice(0, 200)}</p>}
      <PostMetaBar meta={data} compact className="post-meta-bar" />
    </li>
  )
}

export const PostLooseItem = memo(PaperPostItem)
export const PostCompactItem = memo(PaperPostItem)
