import type { PostModel } from '@mx-space/api-client'
import { notFound } from 'next/navigation'

import { apiClient } from '~/lib/request'

import { TaxonomyPosts } from '../../TaxonomyPosts'

type Props = { params: Promise<{ tag: string }> }

export async function generateMetadata({ params }: Props) {
  const { tag } = await params
  return { title: `标签：${decodeURIComponent(tag)}` }
}

export default async function TagPage({ params }: Props) {
  const { tag } = await params
  const name = decodeURIComponent(tag)
  const { data } = await apiClient.category
    .proxy(name)
    .get<{ data: PostModel[] }>({
      params: { tag: true },
    })
  if (!data.length) notFound()
  return <TaxonomyPosts title={`# ${name}`} posts={data} />
}
