'use client'

import { useQuery } from '@tanstack/react-query'
import Image from 'next/image'
import { useTranslations } from 'next-intl'

import { Link } from '~/i18n/navigation'
import { apiClient } from '~/lib/request'
import {
  useAggregationSelector,
  useAppConfigSelector,
} from '~/providers/root/aggregation-data-provider'

export const Hero = () => {
  const t = useTranslations('common')
  const owner = useAggregationSelector((state) => state.user)
  const hero = useAppConfigSelector((config) => config.hero)!
  const { data: stats } = useQuery({
    queryKey: ['site-writing-stats'],
    queryFn: () =>
      apiClient.aggregate.proxy.stat.get<{
        posts: number
        words: number
        days: number
      }>(),
  })
  if (!owner) return null
  const quote = hero.hitokoto?.custom || owner.introduce
  return (
    <section className="paper-hero" aria-label={owner.name}>
      <Image
        src={owner.avatar!}
        alt={t('aria_site_owner_avatar')}
        width={98}
        height={98}
        priority
        className="paper-hero-avatar"
      />
      <h1>
        Hi, I'm <span>{owner.name}</span>
        <span className="paper-wave" aria-hidden="true">
          👋
        </span>
      </h1>
      <p className="paper-hero-heading">
        在代码里探索，<em>在文字里记录。</em>
      </p>
      <p className="paper-hero-description">{hero.description}</p>
      <div className="paper-hero-footnote">
        <p className="paper-hero-quote">{`「 ${quote} 」`}</p>
        {stats && (
          <p className="paper-hero-stats">
            {stats.posts} 篇<span>·</span>
            {stats.words.toLocaleString()} 字<span>·</span>
            {stats.days} 天
          </p>
        )}
        <div className="paper-socials">
          <Link href="/feed" aria-label="RSS">
            <i className="i-mingcute-rss-line" />
          </Link>
          <a href={`mailto:${owner.mail}`} aria-label="Email">
            <i className="i-mingcute-mail-line" />
          </a>
          {owner.socialIds?.github && (
            <a
              href={`https://github.com/${owner.socialIds.github}`}
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub"
            >
              <i className="i-mingcute-github-line" />
            </a>
          )}
        </div>
      </div>
    </section>
  )
}
