'use client'

import { useTranslations } from 'next-intl'
import type { MouseEvent, ReactNode } from 'react'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

import { CircleProgress } from '~/components/icons/Progress'
import { useReadPercent } from '~/hooks/shared/use-read-percent'
import { usePageScrollLocation } from '~/providers/root/page-scroll-info-provider'
import {
  useWrappedElementPosition,
  useWrappedElementSize,
} from '~/providers/shared/WrappedElementProvider'

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export function ReadingRail({
  $headings,
  accessory,
}: {
  $headings: HTMLHeadingElement[]
  accessory?: ReactNode
}) {
  const t = useTranslations('common')
  const scrollY = usePageScrollLocation()
  const percent = useReadPercent()
  const { y: articleY } = useWrappedElementPosition()
  const { h: articleHeight } = useWrappedElementSize()
  const railRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const outlineRef = useRef<HTMLElement>(null)
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pointerInsideRef = useRef(false)
  const keyboardInsideRef = useRef(false)
  const dismissedRef = useRef(false)
  const panelId = useId()
  const [height, setHeight] = useState(480)
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [offsets, setOffsets] = useState<number[]>([])

  const clearTimers = useCallback(() => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current)
  }, [])
  const showOutline = () => {
    if (!$headings.length || dismissedRef.current) return
    clearTimers()
    setClosing(false)
    setOpen(true)
  }
  const hideOutline = useCallback(() => {
    clearTimers()
    setOpen(false)
    setClosing(true)
    const duration =
      Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          '--dropdown-close-dur',
        ),
      ) || 150
    transitionTimerRef.current = setTimeout(() => setClosing(false), duration)
  }, [clearTimers])

  useEffect(() => () => clearTimers(), [clearTimers])
  useEffect(() => {
    if (open && keyboardInsideRef.current) {
      const current =
        outlineRef.current?.querySelector<HTMLAnchorElement>(
          'a[aria-current="location"]',
        ) || outlineRef.current?.querySelector<HTMLAnchorElement>('a')
      current?.focus({ preventScroll: true })
    }
  }, [open])

  // Cache document positions on layout changes; scrolling only reads the cache.
  useEffect(() => {
    setOffsets(
      $headings.map((el) => el.getBoundingClientRect().top + window.scrollY),
    )
  }, [$headings, articleY, articleHeight])

  useEffect(() => {
    const rail = railRef.current
    if (!rail) return
    const observer = new ResizeObserver(() => setHeight(rail.clientHeight))
    observer.observe(rail)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!railRef.current?.contains(event.target as Node)) hideOutline()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, hideOutline])

  const headings = useMemo(
    () =>
      $headings.map((el, index) => {
        const clone = el.cloneNode(true) as HTMLElement
        clone
          .querySelectorAll('del, .katex-container')
          .forEach((node) => node.remove())
        return {
          el,
          title: clone.textContent?.trim() || '',
          depth: Number(el.tagName.slice(1)),
          index,
        }
      }),
    [$headings],
  )
  const rootDepth = Math.min(...headings.map((heading) => heading.depth))
  const activeIndex = Math.max(
    0,
    offsets.findLastIndex((top) => top <= scrollY + 140),
  )
  const currentHeading = headings[activeIndex]
  useEffect(() => {
    if (!open) return
    const list = outlineRef.current?.querySelector('ol')
    const item = list?.querySelector<HTMLElement>('[aria-current="location"]')
    if (!list || !item) return
    const top = item.offsetTop
    if (
      top < list.scrollTop ||
      top + item.offsetHeight > list.scrollTop + list.clientHeight
    ) {
      list.scrollTop = Math.max(0, top - list.clientHeight / 2)
    }
  }, [open, activeIndex])
  const markerY = 12 + ((height - 24) * percent) / 100
  const curveTop = Math.max(0, markerY - 48)
  const curveBottom = Math.min(height, markerY + 48)
  const curve = `M 14 ${curveTop} C 14 ${curveTop + (markerY - curveTop) * 0.55}, 23 ${markerY - (markerY - curveTop) * 0.55}, 23 ${markerY} C 23 ${markerY + (curveBottom - markerY) * 0.55}, 14 ${curveBottom - (curveBottom - markerY) * 0.55}, 14 ${curveBottom}`
  const line = `M 14 0 L 14 ${curveTop} ${curve.slice(curve.indexOf('C'))} L 14 ${height}`

  const navigate = (
    event: MouseEvent<HTMLAnchorElement>,
    heading: HTMLHeadingElement,
  ) => {
    // Keep ordinary anchor behavior for opening a section in another tab.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    if (!pointerInsideRef.current) {
      dismissedRef.current = true
      hideOutline()
      triggerRef.current?.focus({ preventScroll: true })
    }
    const target = document.getElementById(heading.id) || heading
    // An animated traversal loads intervening lazy images and moves the target.
    // Jump directly so the destination remains the browser's scroll anchor.
    window.scrollTo({
      top: target.getBoundingClientRect().top + window.scrollY - 100,
      behavior: 'instant',
    })
  }

  return (
    <div
      ref={railRef}
      className="paper-reading-rail"
      data-expanded={open}
      onPointerDownCapture={(event) => {
        if (event.pointerType === 'mouse') keyboardInsideRef.current = false
      }}
      onPointerEnter={(event) => {
        if (event.pointerType !== 'mouse') return
        pointerInsideRef.current = true
        dismissedRef.current = false
        showOutline()
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== 'mouse') return
        pointerInsideRef.current = false
        dismissedRef.current = false
        if (!keyboardInsideRef.current)
          leaveTimerRef.current = setTimeout(hideOutline, 160)
      }}
      onFocusCapture={(event) => {
        if (event.target.matches(':focus-visible') && !dismissedRef.current) {
          keyboardInsideRef.current = true
          showOutline()
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation()
          dismissedRef.current = true
          keyboardInsideRef.current = false
          hideOutline()
          triggerRef.current?.focus({ preventScroll: true })
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          keyboardInsideRef.current = false
          dismissedRef.current = false
          if (!pointerInsideRef.current) hideOutline()
        }
      }}
    >
      <svg
        width="32"
        height={height}
        viewBox={`0 0 32 ${height}`}
        aria-hidden="true"
      >
        <path d={line} className="paper-rail-line" fill="none" />
        <path d={curve} className="paper-rail-curve" fill="none" />
        <circle cx="23" cy={markerY} r="2.5" className="paper-rail-current" />
      </svg>
      {headings
        .filter((heading) => heading.depth === rootDepth)
        .map((heading) => {
          const position =
            12 +
            (height - 24) *
              clamp(
                ((offsets[heading.index] ?? articleY) - articleY) /
                  (articleHeight || 1),
                0,
                1,
              )
          return (
            <a
              key={heading.el.id}
              href={`#${heading.el.id}`}
              className="paper-rail-stop"
              tabIndex={-1}
              style={{ top: position }}
              aria-label={heading.title}
              aria-current={
                heading.index === activeIndex ? 'location' : undefined
              }
              title={heading.title}
              onClick={(event) => navigate(event, heading.el)}
            >
              <span />
            </a>
          )
        })}
      <button
        ref={triggerRef}
        type="button"
        className="paper-rail-caption"
        style={{ top: clamp(markerY + 16, 0, height - 56) }}
        aria-label={`${t('aria_toc')}${currentHeading ? `：${currentHeading.title}` : ''}`}
        aria-expanded={open}
        tabIndex={open ? -1 : 0}
        aria-controls={panelId}
        disabled={!headings.length}
        onClick={(event) => {
          dismissedRef.current = false
          keyboardInsideRef.current = event.detail === 0
          if (open) hideOutline()
          else showOutline()
        }}
        title={t('aria_toc')}
      >
        {currentHeading && (
          <span className="paper-rail-title">{currentHeading.title}</span>
        )}
        <span className="paper-rail-percent">{percent}%</span>
      </button>
      <nav
        id={panelId}
        ref={outlineRef}
        className={`paper-rail-outline t-dropdown${open ? ' is-open' : closing ? ' is-closing' : ''}`}
        data-origin="top-left"
        data-inactive={!open && !closing}
        aria-label={t('aria_toc')}
        aria-hidden={!open}
        inert={!open}
      >
        <ol>
          {headings.map((heading) => (
            <li key={heading.el.id}>
              <a
                title={heading.title}
                href={`#${heading.el.id}`}
                aria-current={
                  heading.index === activeIndex ? 'location' : undefined
                }
                style={{
                  paddingInlineStart: 12 + (heading.depth - rootDepth) * 10,
                }}
                onClick={(event) => navigate(event, heading.el)}
              >
                {heading.title}
              </a>
            </li>
          ))}
        </ol>
        <svg
          className="paper-rail-rule"
          width="150"
          height="10"
          viewBox="0 0 28 10"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M2 5 C4 8, 7 9, 10 6 C13 3, 15 2, 18 5.5 C20 8, 23 7, 25 5"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className="paper-rail-reading-status">
          <span className="paper-rail-ring">
            <CircleProgress percent={percent} size={14} strokeWidth={1.5} />
            {percent}%
          </span>
          {percent > 10 && (
            <button
              type="button"
              className="paper-rail-back-top"
              onClick={() => window.scrollTo({ top: 0, behavior: 'instant' })}
            >
              <i
                className="i-mingcute-arrow-up-circle-line"
                aria-hidden="true"
              />
              {t('back_to_top')}
            </button>
          )}
        </div>
        {accessory}
      </nav>
    </div>
  )
}
