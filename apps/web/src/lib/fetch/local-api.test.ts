import { describe, expect, it, vi } from 'vitest'

import { createLocalApiFetch } from './local-api'

describe('Markdown API server transport', () => {
  it('loads aggregation without requesting the public deployment', async () => {
    const network = vi.fn<typeof fetch>()
    const fetchLocal = createLocalApiFetch(
      'https://preview.example/api/v2',
      network,
    )
    const response = await fetchLocal(
      'https://preview.example/api/v2/aggregate?theme=shiro',
    )
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.url.webUrl).toBeTruthy()
    expect(body.user.username).toBe('biny')
    expect(network).not.toHaveBeenCalled()
  })

  it('preserves external requests even when their path contains /api/v2', async () => {
    const network = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('external'))
    const fetchLocal = createLocalApiFetch(
      'https://preview.example/api/v2',
      network,
    )
    const url = 'https://external.example/api/v2/aggregate'
    expect(await (await fetchLocal(url)).text()).toBe('external')
    expect(network).toHaveBeenCalledWith(url, undefined)
  })

  it('does not turn write requests into successful reads', async () => {
    const fetchLocal = createLocalApiFetch('https://preview.example/api/v2')
    const response = await fetchLocal(
      new Request('https://preview.example/api/v2/like_this', {
        method: 'POST',
      }),
    )
    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('GET, HEAD')
  })

  it('handles HEAD and malformed URL segments without network access', async () => {
    const fetchLocal = createLocalApiFetch('https://preview.example/api/v2')
    expect(
      await (await fetchLocal('/api/v2/aggregate', { method: 'HEAD' })).text(),
    ).toBe('')
    expect((await fetchLocal('/api/v2/posts/%E0%A4%A')).status).toBe(400)
    expect((await fetchLocal('/api/v2/missing')).status).toBe(404)
  })
})
