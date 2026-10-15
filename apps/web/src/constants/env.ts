import { env } from 'next-runtime-env'

import { isClientSide, isDev } from '~/lib/env'

const trim = (value?: string | null) => (value || '').replace(/\/$/, '')

// The site ships its own Markdown-backed Mix Space compatibility API at
// `/api/v2`, so no external Core server is required. Server-side requests must
// still use an absolute URL, hence the VERCEL_URL fallback.
export const API_URL: string = (() => {
  const configured = trim(env('NEXT_PUBLIC_API_URL'))

  if (isDev) return configured || 'http://localhost:2323/api/v2'

  if (isClientSide) {
    const endpoint =
      trim(env('NEXT_PUBLIC_CLIENT_API_URL')) || configured || '/api/v2'
    // SDKs such as Better Auth require an absolute URL even in the browser.
    return new URL(endpoint, window.location.origin)
      .toString()
      .replace(/\/$/, '')
  }

  if (configured) return configured

  const vercelUrl = process.env.VERCEL_URL
  if (vercelUrl) return `https://${vercelUrl}/api/v2`

  return `http://localhost:${process.env.PORT || 2323}/api/v2`
})()

// Real-time features need a Mix Space gateway. Leave empty to disable.
export const GATEWAY_URL = trim(env('NEXT_PUBLIC_GATEWAY_URL'))
export const SOCKET_ENABLED = !!GATEWAY_URL
