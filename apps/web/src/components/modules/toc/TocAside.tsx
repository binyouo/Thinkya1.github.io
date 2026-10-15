'use client'

import { m } from 'motion/react'
import type * as React from 'react'
import {
  startTransition,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react'

import { useIsImmersiveReadingEnabled } from '~/atoms/hooks/reading'
import { MAIN_CONTENT_ID } from '~/constants/dom-id'
import { DOMCustomEvents } from '~/constants/event'
import { Spring } from '~/constants/spring'
import { useForceUpdate } from '~/hooks/common/use-force-update'
import { clsxm } from '~/lib/helper'
import { throttle } from '~/lib/lodash'
import { useWrappedElement } from '~/providers/shared/WrappedElementProvider'

import { ReadingRail } from './ReadingRail'
import { useTocHeadingStrategy } from './TocHeadingStrategy'
import { TocTree } from './TocTree'

export type TocAsideProps = {
  treeClassName?: string
  variant?: 'tree' | 'rail'
}

export interface TocSharedProps {
  accessory?: React.ReactNode | React.FC

  as?: React.ElementType
}
export interface TocAsideRef {
  getContainer: () => HTMLUListElement | null
}
export const TocAside = ({
  ref,
  className,
  children,
  treeClassName,
  accessory,
  variant = 'tree',
  as: As = 'aside',
}: TocAsideProps &
  TocSharedProps &
  ComponentType & { ref?: React.RefObject<TocAsideRef | null> }) => {
  const containerRef = useRef<HTMLUListElement>(null)
  const $article = useWrappedElement()
  const isImmersive = useIsImmersiveReadingEnabled()

  const [forceUpdate, updated] = useForceUpdate()

  useEffect(() => {
    const handler = () => {
      startTransition(() => {
        forceUpdate()
      })
    }
    document.addEventListener(DOMCustomEvents.RefreshToc, handler)
    return () => {
      document.removeEventListener(DOMCustomEvents.RefreshToc, handler)
    }
  }, [forceUpdate])

  useImperativeHandle(ref, () => ({
    getContainer: () => containerRef.current,
  }))

  if ($article === undefined) {
    throw new TypeError('<Toc /> must be used in <WrappedElementProvider />')
  }
  const queryHeadings = useTocHeadingStrategy()
  const $headings = useMemo(() => {
    if (!$article) {
      return []
    }
    return queryHeadings(document.getElementById(MAIN_CONTENT_ID) || $article)
  }, [$article, updated, queryHeadings])

  useEffect(() => {
    if (!$article) return
    let headings = $headings
    const refresh = () => {
      const root = document.getElementById(MAIN_CONTENT_ID) || $article
      const next = queryHeadings(root)
      if (
        next.length === headings.length &&
        next.every((el, index) => el === headings[index])
      )
        return
      headings = next
      forceUpdate()
    }
    refresh()
    const observer = new MutationObserver(refresh)
    // The markdown root itself can be replaced when responsive wrappers change.
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [$article, $headings, queryHeadings, forceUpdate])

  useEffect(() => {
    const setMaxWidth = throttle(() => {
      if (containerRef.current) {
        containerRef.current.style.maxWidth = `${
          window.innerWidth -
          containerRef.current.getBoundingClientRect().x -
          30
        }px`
      }
    }, 14)
    setMaxWidth()

    window.addEventListener('resize', setMaxWidth)
    return () => {
      window.removeEventListener('resize', setMaxWidth)
    }
  }, [])

  return (
    <m.aside
      className={clsxm('st-toc z-[3]', 'relative font-sans', className)}
      animate={{
        opacity: variant === 'rail' ? 1 : isImmersive ? 0.2 : 1,
      }}
      transition={Spring.presets.smooth}
      style={{
        pointerEvents:
          variant === 'rail' ? 'auto' : isImmersive ? 'none' : 'auto',
      }}
    >
      {variant === 'rail' ? (
        <ReadingRail $headings={$headings} accessory={children} />
      ) : (
        <TocTree
          $headings={$headings}
          containerRef={containerRef}
          className={clsxm('absolute max-h-[75vh]', treeClassName)}
          accessory={accessory}
        />
      )}
      {variant !== 'rail' && children}
    </m.aside>
  )
}
TocAside.displayName = 'TocAside'
