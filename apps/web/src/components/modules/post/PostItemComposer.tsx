'use client'

import type { PostListItem } from '@mx-space/api-client'
import type { FC } from 'react'

import { PostLooseItem } from './PostItem'

declare global {
  export interface Window {
    __POST_LIST_ANIMATED__: boolean
  }
}

export const PostItemComposer: FC<{ data: PostListItem; index: number }> = ({
  data,
}) => <PostLooseItem data={data} />
