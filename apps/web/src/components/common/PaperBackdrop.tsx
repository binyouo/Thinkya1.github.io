'use client'

import { useAtom, useAtomValue } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import type { CSSProperties } from 'react'

const enabledAtom = atomWithStorage('paper-background-effects', true)

export const PaperBackdrop = () => {
  const enabled = useAtomValue(enabledAtom)
  if (!enabled) return null
  return (
    <div className="paper-backdrop" aria-hidden="true">
      {Array.from({ length: 32 }, (_, index) => (
        <span
          key={index}
          style={
            {
              left: `${(index * 31 + 7) % 100}%`,
              top: `${(index * 47 + 9) % 100}%`,
              '--paper-delay': `${-(index % 13)}s`,
              '--paper-turn': `${index * 29}deg`,
            } as CSSProperties
          }
        />
      ))}
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
