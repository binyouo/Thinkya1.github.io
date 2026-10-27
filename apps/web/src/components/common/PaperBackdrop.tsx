'use client'

import { useAtom, useAtomValue } from 'jotai'
import { atomWithStorage } from 'jotai/utils'

import { usePathname } from '~/i18n/navigation'

import { DitheredPaperBackdrop } from './DitheredPaperBackdrop'

const enabledAtom = atomWithStorage('paper-background-effects', true)

export const PaperBackdrop = () => {
  const enabled = useAtomValue(enabledAtom)
  const pathname = usePathname()
  if (!enabled) return null
  return (
    <div className="paper-backdrop" aria-hidden="true">
      <DitheredPaperBackdrop quiet={pathname !== '/'} />
    </div>
  )
}

export const PaperEffectsToggle = () => {
  const [enabled, setEnabled] = useAtom(enabledAtom)
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      className="paper-effects-toggle"
      onClick={() => setEnabled(!enabled)}
    >
      背景效果 <span>{enabled ? '开' : '关'}</span>
    </button>
  )
}
