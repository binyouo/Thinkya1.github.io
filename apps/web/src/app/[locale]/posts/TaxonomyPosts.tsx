import type { PostModel } from '@mx-space/api-client'

import { NormalContainer } from '~/components/layout/container/Normal'
import { PostItemComposer } from '~/components/modules/post/PostItemComposer'
import { SearchFAB } from '~/components/modules/shared/SearchFAB'
import { Link } from '~/i18n/navigation'

export const TaxonomyPosts = ({
  title,
  posts,
}: {
  title: string
  posts: PostModel[]
}) => (
  <NormalContainer className="paper-posts">
    <header className="mb-12 space-y-3">
      <Link href="/posts" className="text-sm opacity-70">
        ← 文稿
      </Link>
      <h1 className="text-3xl font-semibold">{title}</h1>
      <p className="text-sm opacity-70">{posts.length} 篇文稿</p>
    </header>
    <ul>
      {posts.map((post, index) => (
        <PostItemComposer key={post.id} index={index} data={post} />
      ))}
    </ul>
    <SearchFAB />
  </NormalContainer>
)
