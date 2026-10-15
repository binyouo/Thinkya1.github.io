import { afterEach, describe, expect, it, vi } from 'vitest'

const { runtimeEnv } = vi.hoisted(() => ({ runtimeEnv: vi.fn() }))
vi.mock('next-runtime-env', () => ({ env: runtimeEnv }))
vi.mock('~/lib/env', () => ({ isClientSide: true, isDev: false }))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
  runtimeEnv.mockReset()
})

describe('production browser API address', () => {
  it('uses the current deployment origin so SDK initialization accepts the URL', async () => {
    vi.stubGlobal('window', { location: { origin: 'https://preview.example' } })
    const { API_URL } = await import('./env')
    expect(API_URL).toBe('https://preview.example/api/v2')
    expect(new URL(`${API_URL}/auth`).origin).toBe('https://preview.example')
  })

  it('resolves relative overrides and preserves absolute overrides', async () => {
    vi.stubGlobal('window', { location: { origin: 'https://preview.example' } })
    runtimeEnv.mockImplementation((name: string) =>
      name === 'NEXT_PUBLIC_CLIENT_API_URL' ? '/custom/api/' : undefined,
    )
    expect((await import('./env')).API_URL).toBe(
      'https://preview.example/custom/api',
    )
    vi.resetModules()
    runtimeEnv.mockImplementation((name: string) =>
      name === 'NEXT_PUBLIC_CLIENT_API_URL'
        ? 'https://api.example/v2/'
        : undefined,
    )
    expect((await import('./env')).API_URL).toBe('https://api.example/v2')
  })
})
