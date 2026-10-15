'use client'

import type { FC } from 'react'
import * as React from 'react'

import { useIsMobile } from '~/atoms/hooks/viewport'

import { TocAside } from '../toc'

export const ArticleRightAside: Component = ({ children }) => {
  const isMobile = useIsMobile()
  if (isMobile) return <div />

  return <ArticleRightAsideImpl>{children}</ArticleRightAsideImpl>
}

const ArticleRightAsideImpl: FC<{
  children?: React.ReactNode
}> = ({ children }) => (
  <aside className="paper-reading-aside">
    <div className="relative h-full">
      <TocAside as="div" className="h-full ml-4" variant="rail">
        {!!children &&
          React.cloneElement(children as any, {
            className: 'static m-0 mt-3 p-2 translate-y-0 opacity-100',
          })}
      </TocAside>
    </div>
  </aside>
)
