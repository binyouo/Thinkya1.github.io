import { PaperEffectsToggle } from '~/components/common/PaperBackdrop'
import { ThemeSwitcher } from '~/components/ui/theme-switcher'

import { FooterInfo } from './FooterInfo'
import { LocaleSwitcher } from './LocaleSwitcher'

export const Footer = () => (
  <footer data-hide-print className="paper-footer relative z-[1]">
    <div>
      <div>
        <FooterInfo />

        <div className="paper-footer-settings">
          <LocaleSwitcher />
          <ThemeSwitcher />
          <PaperEffectsToggle />
        </div>
      </div>
    </div>
  </footer>
)
