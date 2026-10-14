import 'server-only'

import { cookies, headers as nextHeaders } from 'next/headers'
import { createFetch } from 'ofetch'

import PKG from '~/../package.json'
import { REQUEST_LOCALE } from '~/constants/system'
import { handleGet } from '~/lib/content/load.mjs'

import { createApiClient, createFetchAdapter } from './shared'

const isDev = process.env.NODE_ENV === 'development'

const API_PATH = '/api/v2/'

// Server components fetch this site's own compatibility API. Routing that back
// through the network (and the Vercel CDN) is unreliable, so resolve it in
// process. Any other URL still goes out over fetch.
const inProcessFetch: typeof globalThis.fetch = (input, init) => {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url

  const index = url.indexOf(API_PATH)
  if (index === -1) return globalThis.fetch(input as any, init)

  const afterBase = url.slice(index + API_PATH.length)
  const queryIndex = afterBase.indexOf('?')
  const rawPath = queryIndex === -1 ? afterBase : afterBase.slice(0, queryIndex)
  const rawQuery = queryIndex === -1 ? '' : afterBase.slice(queryIndex + 1)
  const segments = rawPath.split('/').filter(Boolean).map(decodeURIComponent)
  const searchParams = new URLSearchParams(rawQuery)

  return Promise.resolve(handleGet(segments, searchParams))
}

export const $fetch = createFetch({
  fetch: inProcessFetch,
  defaults: {
    timeout: 8000,
    credentials: 'include',
    async onRequest(context) {
      const cookie = await cookies()

      // eslint-disable-next-line prefer-destructuring
      let headers: any = context.options.headers
      if (headers && headers instanceof Headers) {
        headers = Object.fromEntries(headers.entries())
      } else {
        headers = {}
      }

      const cookieHeader = cookie
        .getAll()
        .map((c) => `${c.name}=${c.value}`)
        .join('; ')
      if (cookieHeader) {
        headers['cookie'] = cookieHeader
        context.options.cache = 'no-store'
      }

      context.options.params ??= {}

      if (isDev) {
        console.info(`[Request/Server]: ${context.request}`)
      }

      const { get } = await nextHeaders()

      const ua = get('user-agent')
      const ip =
        get('x-real-ip') ||
        get('x-forwarded-for') ||
        get('remote-addr') ||
        get('cf-connecting-ip')

      if (ip) {
        headers['x-real-ip'] = ip
        headers['x-forwarded-for'] = ip
      }

      headers['User-Agent'] =
        `${ua} NextJS/v${PKG.dependencies.next} ${PKG.name}/${PKG.version}`

      // Add x-lang header from URL (more reliable than getLocale during RSC navigation)
      const referer = get('referer') || get('x-invoke-path')
      const locale = get(REQUEST_LOCALE)

      if (isDev) {
        console.log('locale extracted:', locale, 'from referer:', referer)
      }

      headers['x-lang'] = locale

      context.options.headers = headers
    },
    onResponse(context) {
      if (isDev) {
        console.info(
          `[Response/Server]: ${context.request}`,
          context.response.status,
        )
      }
    },
  },
})
export const apiClient = createApiClient(createFetchAdapter($fetch))

const Noop = () => null
export const attachFetchHeader = () => Noop

export const setGlobalSearchParams = Noop
export const clearGlobalSearchParams = Noop

export const isReactServer = true
