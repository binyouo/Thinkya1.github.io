'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { atom, useAtomValue, useSetAtom } from 'jotai'
import { AnimatePresence, m } from 'motion/react'
import { useTranslations } from 'next-intl'
import type { KeyboardEventHandler } from 'react'
import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import { useIsOwnerLogged } from '~/atoms/hooks/owner'
import { EmptyIcon } from '~/components/icons/empty'
import { MotionButtonBase } from '~/components/ui/button'
import { FABPortable } from '~/components/ui/fab'
import { FloatPopover } from '~/components/ui/float-popover'
import { SITE_CAPABILITIES } from '~/constants/site'
import { microDampingPreset } from '~/constants/spring'
import useDebounceValue from '~/hooks/common/use-debounce-value'
import { useIsClient } from '~/hooks/common/use-is-client'
import { Link } from '~/i18n/navigation'
import { noopArr } from '~/lib/noop'
import { apiClient } from '~/lib/request'
import { jotaiStore } from '~/lib/store'

const searchPanelOpenAtom = atom(false)
const isComposingAtom = atom(false)
export const SearchButton = () => {
  const t = useTranslations('common')
  return (
    <button
      type="button"
      className="paper-search-button"
      onClick={() => jotaiStore.set(searchPanelOpenAtom, true)}
    >
      <i className="i-mingcute-search-line" />
      <span>{t('search_placeholder').replaceAll(/…|\.\.\./g, '')}</span>
      <kbd className="ml-auto text-xs opacity-40">⌘ K</kbd>
    </button>
  )
}
export const SearchFAB = () => {
  const isClient = useIsClient()
  if (!isClient) return null
  return (
    <>
      <FABPortable
        onClick={() => {
          jotaiStore.set(searchPanelOpenAtom, true)
        }}
      >
        <i className="i-mingcute-search-line" />
      </FABPortable>
    </>
  )
}

export const SearchPanelWithHotKey = () => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        jotaiStore.set(searchPanelOpenAtom, true)
      }

      if (
        e.key === 'Escape' &&
        jotaiStore.get(searchPanelOpenAtom) &&
        !jotaiStore.get(isComposingAtom)
      ) {
        e.preventDefault()
        jotaiStore.set(searchPanelOpenAtom, false)
      }
    }
    document.addEventListener('keydown', handler)
    return () => {
      document.removeEventListener('keydown', handler)
    }
  }, [])
  return <SearchPanel />
}

const SearchPanel = () => {
  const panelOpen = useAtomValue(searchPanelOpenAtom)

  return (
    <Dialog.Root open>
      {panelOpen && <Dialog.Overlay />}
      <Dialog.DialogTitle className="hidden">Search</Dialog.DialogTitle>
      <AnimatePresence>
        {panelOpen && (
          <Dialog.Portal>
            <Dialog.Content>
              <div className="center fixed inset-0 z-20 flex">
                <div
                  className="fixed inset-0 z-[-1]"
                  onClick={() => {
                    jotaiStore.set(searchPanelOpenAtom, false)
                  }}
                  tabIndex={-1}
                />
                <SearchPanelImpl />
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}

type SearchListType = {
  title: string
  subtitle?: string
  url: string
  id: string
}
const currentSelectAtom = atom(0)

const SearchPanelImpl = () => {
  const t = useTranslations('common')
  const [keyword, setKeyword] = useState('')
  const listRef = useRef<HTMLUListElement>(null)
  const setCurrentSelect = useSetAtom(currentSelectAtom)
  const debouncedKeyword = useDebounceValue(keyword.trim(), 360)

  const { data: _data, isFetching } = useQuery({
    queryKey: ['search', debouncedKeyword],
    enabled: !!debouncedKeyword,
    queryFn: ({ queryKey }) => {
      const [, keyword] = queryKey
      return apiClient.search.proxy('algolia').get({
        params: {
          keyword,
        },
      })
    },
    select: useCallback(
      (data: any) => {
        if (!data?.data) {
          return
        }

        const _list: SearchListType[] = data.data
          .map((item: any): SearchListType | undefined => {
            switch (item.type) {
              case 'post': {
                return {
                  title: item.title,
                  subtitle: item.category.name,
                  id: item.id,
                  url: `/posts/${item.category.slug}/${item.slug}`,
                }
              }
              case 'note': {
                return {
                  title: item.title,
                  subtitle: t('search_note'),
                  id: item.id,
                  url: `/notes/${item.nid}`,
                }
              }
              case 'page': {
                return {
                  title: item.title,
                  subtitle: t('search_page'),
                  id: item.id,
                  url: `/${item.slug}`,
                }
              }
            }
          })
          .filter(
            (item: SearchListType | undefined): item is SearchListType =>
              !!item,
          )

        return _list
      },
      [t],
    ),
  })
  const data = debouncedKeyword ? _data || noopArr : noopArr
  useEffect(() => {
    setCurrentSelect(0)
  }, [debouncedKeyword, setCurrentSelect])

  const handleKeyDown: KeyboardEventHandler<HTMLDivElement> = useCallback(
    (e) => {
      if (e.nativeEvent.isComposing || jotaiStore.get(isComposingAtom)) return
      if (!['Enter', 'ArrowDown', 'ArrowUp'].includes(e.key)) return
      e.preventDefault()
      if (!listRef.current || data.length === 0) {
        return
      }
      const $ = listRef.current
      const currentSelect = Math.min(
        jotaiStore.get(currentSelectAtom),
        data.length - 1,
      )
      let nextSelect = currentSelect

      switch (e.key) {
        case 'Enter': {
          $.children.item(currentSelect)?.querySelector('a')?.click()
          return
        }
        case 'ArrowDown': {
          nextSelect = (currentSelect + 1) % data.length
          break
        }
        case 'ArrowUp': {
          nextSelect = (currentSelect - 1 + data.length) % data.length
          break
        }
      }

      setCurrentSelect(nextSelect)
      $.children.item(nextSelect)?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      })
    },
    [data.length, setCurrentSelect],
  )

  const isLogged = useIsOwnerLogged()

  return (
    <m.div
      className={clsx(
        'h-[600px] max-h-[80vh] w-[800px] max-w-screen rounded-none md:h-screen md:max-h-[60vh] md:max-w-[80vw]',
        'flex min-h-[50px] flex-col bg-zinc-50/80 shadow-2xl backdrop-blur-md dark:bg-neutral-900/80 md:rounded-xl',
        'border-0 border-zinc-200 dark:border-zinc-800 md:border',
      )}
      onKeyDown={handleKeyDown}
      role="dialog"
      initial={true}
      exit={{
        y: 20,
        opacity: 0,
      }}
      animate={{
        y: 0,
        transition: microDampingPreset,
      }}
    >
      <input
        autoFocus
        className="w-full shrink-0 border-b border-zinc-200 bg-transparent p-4 px-5 text-lg leading-4 dark:border-neutral-700"
        placeholder={t('search_placeholder')}
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        onCompositionStart={() => {
          jotaiStore.set(isComposingAtom, true)
        }}
        onCompositionEnd={() => {
          jotaiStore.set(isComposingAtom, false)
        }}
      />
      <div />
      <div className="relative h-0 shrink grow overflow-auto">
        <ul className="h-full px-2 py-4" ref={listRef}>
          {data.length === 0 && !isFetching ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center space-y-2">
                {!keyword ? (
                  <i className="i-mingcute-search-line text-[60px]" />
                ) : (
                  <EmptyIcon />
                )}

                <span>{!!debouncedKeyword && t('search_empty')}</span>
              </div>
            </div>
          ) : (
            data.map((item, index) => (
              <SearchItem key={item.id} {...item} index={index} />
            ))
          )}

          {data.length === 0 && isFetching && (
            <div className="center flex h-full grow">
              <div className="loading loading-spinner" />
            </div>
          )}
        </ul>
      </div>

      <div className="flex shrink-0 items-center justify-between px-4 py-2">
        {SITE_CAPABILITIES.authentication && isLogged ? (
          <MotionButtonBase
            onClick={() => {
              window.open(
                apiClient.search.proxy('algolia')('import-json').toString(true),
              )
            }}
          >
            <FloatPopover
              mobileAsSheet
              type="tooltip"
              triggerElement={<i className="i-mingcute-download-2-line" />}
            >
              {t('search_download_index')}
            </FloatPopover>
          </MotionButtonBase>
        ) : (
          <div />
        )}
        <span className="text-xs text-neutral">
          {t('search_keyboard_hint')}
        </span>
      </div>
    </m.div>
  )
}

const SearchItem = memo(function Item({
  index,
  ...item
}: {
  index: number
} & SearchListType) {
  const selectIndex = useAtomValue(currentSelectAtom)
  const isSelect = selectIndex === index
  return (
    <li
      className={clsx(
        'relative flex w-full justify-between px-1',
        'before:content-auto before:absolute before:inset-0 before:rounded-md',
        'before:z-0 hover:before:bg-zinc-200/80 dark:hover:before:bg-zinc-800/80',
        isSelect && 'before:bg-zinc-200/80 dark:before:bg-zinc-800/80',
      )}
      key={item.id}
      onMouseOver={() => {
        startTransition(() => {
          jotaiStore.set(currentSelectAtom, index)
        })
      }}
    >
      <Link
        href={item.url}
        onClick={() => jotaiStore.set(searchPanelOpenAtom, false)}
        className="relative z-10 flex w-full justify-between p-3"
      >
        <span className="block min-w-0 flex-1 shrink-0 truncate">
          {item.title}
        </span>
        <span className="block min-w-0 shrink-0 grow-0 text-zinc-800 dark:text-slate-200/80">
          {item.subtitle}
        </span>
      </Link>
    </li>
  )
})
