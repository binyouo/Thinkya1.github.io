'use client'

import './diagram.css'

import { useEffect, useRef } from 'react'
import { PhotoProvider, PhotoView } from 'react-photo-view'
import type { OverlayRenderProps } from 'react-photo-view/dist/types'

import { useIsDark } from '~/hooks/common/use-is-dark'

import diagrams from './diagrams.json'

export const articleDiagrams: Record<
  string,
  {
    title: string
    width: number
    height: number
    light: string
    dark: string
    source: string
  }
> = diagrams

export const DiagramFigure = ({ src, alt }: { src: string; alt?: string }) => {
  const diagram = articleDiagrams[src]
  const isDark = useIsDark()
  const previewRef = useRef<HTMLButtonElement>(null)
  const caption = alt?.replace(/^[¡!]/, '') || diagram.title
  return (
    <figure className="article-diagram">
      <PhotoProvider
        className="article-diagram-viewer"
        maskOpacity={0.94}
        onVisibleChange={(visible) => {
          if (!visible) previewRef.current?.focus({ preventScroll: true })
        }}
        toolbarRender={(props) => (
          <DiagramToolbar {...props} title={diagram.title} />
        )}
        speed={() =>
          window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 0
            : 200
        }
      >
        <PhotoView
          src={isDark ? diagram.dark : diagram.light}
          width={diagram.width}
          height={diagram.height}
        >
          <button
            ref={previewRef}
            type="button"
            className="article-diagram-preview"
            aria-label={`放大架构图：${diagram.title}`}
          >
            <img
              className="article-diagram-light"
              src={diagram.light}
              alt={caption}
              width={diagram.width}
              height={diagram.height}
              loading="lazy"
              decoding="async"
            />
            <img
              className="article-diagram-dark"
              src={diagram.dark}
              alt=""
              aria-hidden="true"
              width={diagram.width}
              height={diagram.height}
              loading="lazy"
              decoding="async"
            />
          </button>
        </PhotoView>
      </PhotoProvider>
      <figcaption>
        <span>{caption}</span>
        <a href={diagram.source} download>
          下载白板源文件
        </a>
      </figcaption>
    </figure>
  )
}

const DiagramToolbar = ({
  onScale,
  scale,
  onClose,
  title,
}: OverlayRenderProps & { title: string }) => {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
  }, [])
  return (
    <div
      className="article-diagram-toolbar"
      role="toolbar"
      aria-label="架构图查看控制"
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return
        const buttons = Array.from(
          event.currentTarget.querySelectorAll<HTMLButtonElement>(
            'button:not(:disabled)',
          ),
        )
        const first = buttons[0],
          last = buttons.at(-1)
        if (!first || !last) return
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }}
    >
      <span className="article-diagram-viewer-title">{title}</span>
      <button
        type="button"
        aria-label="缩小架构图"
        disabled={scale <= 1}
        onClick={() => onScale(Math.max(1, scale / 1.5))}
      >
        −
      </button>
      <button
        type="button"
        aria-label="放大架构图"
        disabled={scale >= 6}
        onClick={() => onScale(Math.min(6, scale * 1.5))}
      >
        +
      </button>
      <button type="button" onClick={() => onScale(1)}>
        适应屏幕
      </button>
      <button type="button" ref={closeRef} onClick={() => onClose()}>
        关闭
      </button>
    </div>
  )
}
