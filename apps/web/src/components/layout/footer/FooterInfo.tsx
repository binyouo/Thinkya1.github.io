import 'server-only'

import { fetchAggregationData } from '~/app/[locale]/api'
import { isSiteRouteEnabled } from '~/constants/site'
import { Link } from '~/i18n/navigation'

export const FooterInfo = async () => {
  const { user, theme } = await fetchAggregationData()
  const configured =
    theme.footer?.linkSections.flatMap(
      (section: LinkSection) => section.links,
    ) || []
  const links = [
    { name: '关于我', href: '/about' },
    { name: '文稿', href: '/posts' },
    { name: '时间线', href: '/timeline' },
    { name: '发邮件 ↗', href: `mailto:${user.mail}` },
    {
      name: 'GitHub ↗',
      href: `https://github.com/${user.socialIds?.github || 'Thinkya1'}`,
    },
    { name: 'RSS 订阅', href: '/feed' },
    { name: '站点地图', href: '/sitemap.xml' },
    ...configured,
  ].filter(
    (link, index, all) =>
      all.findIndex((item) => item.href === link.href) === index &&
      (!link.href.startsWith('/') || isSiteRouteEnabled(link.href)),
  )
  const year = new Date().getFullYear()
  return (
    <div className="paper-footer-info">
      <div>
        <Link href="/" className="paper-footer-name">
          {user.name}
        </Link>
        <p className="paper-footer-motto">Stay hungry. Stay foolish.</p>
        <p className="paper-footer-meta">
          © {year} {user.name}
          <span className="mx-2">·</span>
          <a
            href="https://github.com/Innei/Shiro"
            target="_blank"
            rel="noreferrer"
          >
            Shiro ↗
          </a>
          <span className="mx-2">·</span>
          <a href="https://nextjs.org" target="_blank" rel="noreferrer">
            Next.js ↗
          </a>
        </p>
      </div>
      <nav className="paper-footer-links" aria-label="页脚导航">
        {links.map((link) =>
          link.href.startsWith('/') ? (
            <Link key={link.href} href={link.href}>
              {link.name}
            </Link>
          ) : (
            <a
              key={link.href}
              href={link.href}
              target={link.href.startsWith('http') ? '_blank' : undefined}
              rel="noreferrer"
            >
              {link.name}
            </a>
          ),
        )}
      </nav>
    </div>
  )
}
