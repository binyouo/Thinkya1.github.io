import { handleRequest } from '~/lib/content/load.mjs'

// Only the configured API origin is local. A third-party URL containing the
// same pathname must still use the network.
export const createLocalApiFetch = (
  apiUrl: string,
  networkFetch: typeof globalThis.fetch = globalThis.fetch,
): typeof globalThis.fetch => {
  const base = new URL(apiUrl, 'http://localhost:2323')
  const apiPath = base.pathname.replace(/\/$/, '')

  return async (input, init) => {
    const rawUrl = input instanceof Request ? input.url : String(input)
    const url = new URL(rawUrl, base)
    if (
      url.origin !== base.origin ||
      (url.pathname !== apiPath && !url.pathname.startsWith(`${apiPath}/`))
    ) {
      return networkFetch(input, init)
    }

    const method =
      init?.method || (input instanceof Request ? input.method : 'GET')
    try {
      const segments = url.pathname
        .slice(apiPath.length)
        .split('/')
        .filter(Boolean)
        .map(decodeURIComponent)
      return handleRequest(method, segments, url.searchParams)
    } catch (error) {
      if (!(error instanceof URIError)) throw error
      return Response.json(
        { message: 'Invalid URL', statusCode: 400 },
        { status: 400 },
      )
    }
  }
}
