'use client'

import clsx from 'clsx'
import { AnimatePresence, LayoutGroup, m } from 'motion/react'
import { useTranslations } from 'next-intl'
import * as React from 'react'
import { memo, useCallback, useMemo } from 'react'

import { RootPortal } from '~/components/ui/portal'
import useDebounceValue from '~/hooks/common/use-debounce-value'
import { Link, usePathname } from '~/i18n/navigation'
import { clsxm } from '~/lib/helper'
import { useIsScrollUpAndPageIsOver } from '~/providers/root/page-scroll-info-provider'

import type { IHeaderMenu } from '../config'
import { useHeaderConfig } from './HeaderDataConfigureProvider'
import { useMenuOpacity } from './hooks'
import { MenuPopover } from './MenuPopover'

export const HeaderContent = () => (
  <LayoutGroup>
    <AnimatedMenu>
      <ForDesktop />
    </AnimatedMenu>
    <AccessibleMenu />
  </LayoutGroup>
)

const AccessibleMenu: Component = () => {
  const showShow = useDebounceValue(useIsScrollUpAndPageIsOver(600), 120)
  return (
    <RootPortal>
      <AnimatePresence>
        {showShow && (
          <m.div
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            exit={{ y: -20, opacity: 0 }}
            className="pointer-events-none fixed inset-x-0 top-4 z-10 mr-[var(--removed-body-scroll-bar-size)] flex justify-center"
          >
            <ForDesktop />
          </m.div>
        )}
      </AnimatePresence>
    </RootPortal>
  )
}

const AnimatedMenu: Component = ({ children }) => {
  const opacity = useMenuOpacity()

  const shouldHideNavBg = opacity === 0
  return (
    <m.div
      className="duration-100"
      style={{
        opacity,
        visibility: opacity === 0 ? 'hidden' : 'visible',
      }}
    >
      {/* @ts-ignore */}
      {React.cloneElement(children, { shouldHideNavBg })}
    </m.div>
  )
}

const ForDesktop: Component<{
  shouldHideNavBg?: boolean
  animatedIcon?: boolean
}> = ({ className, shouldHideNavBg, animatedIcon = true }) => {
  const { config: headerMenuConfig } = useHeaderConfig()
  const pathname = usePathname()

  return (
    <m.nav
      layout="size"
      className={clsxm(
        'paper-nav relative',
        'pointer-events-auto duration-200',
        shouldHideNavBg && 'bg-none! shadow-none! ring-transparent!',
        className,
      )}
    >
      <div className="flex p-1 font-medium">
        {headerMenuConfig.map((section) => {
          const subItemActive =
            section.subMenu?.findIndex(
              (item) =>
                item.path === pathname ||
                pathname.slice(1) === item.path ||
                pathname.startsWith(`${item.path}/`),
            ) ?? -1

          return (
            <HeaderMenuItem
              iconLayout={animatedIcon}
              section={section}
              key={section.path}
              subItemActive={section.subMenu?.[subItemActive]}
              isActive={
                pathname === section.path ||
                (pathname.startsWith(`${section.path}/`) &&
                  !section.exclude?.includes(pathname)) ||
                subItemActive > -1 ||
                false
              }
            />
          )
        })}
      </div>
    </m.nav>
  )
}

const HeaderMenuItem = memo<{
  section: IHeaderMenu
  isActive: boolean
  subItemActive?: IHeaderMenu
  iconLayout?: boolean
}>(({ section, isActive, subItemActive, iconLayout }) => {
  const t = useTranslations('common')
  const href = useMemo(() => {
    let href = section.path
    if (section.search) {
      href += `?${new URLSearchParams(section.search).toString()}`
    }
    return href
  }, [section.path, section.search])

  const getTitle = useCallback(
    (item: IHeaderMenu) => {
      if (item.titleKey) {
        return t(item.titleKey as any)
      }
      return item.title
    },
    [t],
  )

  return (
    <MenuPopover subMenu={section.subMenu} key={href}>
      <AnimatedItem
        do={section.do}
        href={href}
        isActive={isActive}
        className="transition-[padding]"
      >
        <span className="relative flex items-center">
          {isActive && (
            <m.span
              layoutId={iconLayout ? 'header-menu-icon' : undefined}
              className="mr-2 flex items-center"
            >
              {subItemActive?.icon ?? section.icon}
            </m.span>
          )}
          <m.span layout>
            {subItemActive ? getTitle(subItemActive) : getTitle(section)}
          </m.span>
        </span>
      </AnimatedItem>
    </MenuPopover>
  )
})
HeaderMenuItem.displayName = 'HeaderMenuItem'

function AnimatedItem({
  href,
  children,
  className,
  isActive,
  do: _do,
}: {
  href: string
  children: React.ReactNode
  className?: string
  isActive?: boolean
  do?: () => void
}) {
  const isExternal = href.startsWith('http')
  const As = isExternal ? 'a' : Link
  return (
    <div>
      <As
        href={href}
        className={clsxm(
          'relative block whitespace-nowrap px-3 py-1.5 transition-colors duration-200',
          isActive ? 'text-accent' : 'hover:text-accent/80',
          isActive ? 'active' : '',
          className,
        )}
        target={isExternal ? '_blank' : undefined}
        onClick={_do}
      >
        {children}
        {isActive && (
          <m.span
            className={clsx(
              'pointer-events-none absolute inset-0 rounded-sm border border-current/10',
            )}
            layoutId="active-nav-item"
          />
        )}
      </As>
    </div>
  )
}
