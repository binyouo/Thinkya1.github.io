import type { CategoryModel, PostModel } from '@mx-space/api-client'
import { notFound } from 'next/navigation'

import { apiClient } from '~/lib/request'

import { TaxonomyPosts } from '../../TaxonomyPosts'

type Props = { params: Promise<{ category: string }> }

export async function generateMetadata({ params }: Props) {
  const { category } = await params
  return { title: `分类：${decodeURIComponent(category)}` }
}

export default async function CategoryPage({ params }: Props) {
  const { category } = await params
  const slug = decodeURIComponent(category)
  const { data: categories } = await apiClient.category.proxy.get<{
    data: CategoryModel[]
  }>()
  const selected = categories.find((item) => item.slug === slug)
  if (!selected) notFound()
  const { data } = await apiClient.category
    .proxy(slug)
    .get<{ data: PostModel[] }>()
  return <TaxonomyPosts title={selected.name} posts={data} />
}
