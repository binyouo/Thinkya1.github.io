import { handleGet } from '~/lib/content/load.mjs'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ path: string[] }>
}

const handle = async (request: Request, context: RouteContext) => {
  const { path } = await context.params
  const { searchParams } = new URL(request.url)
  return handleGet(path ?? [], searchParams)
}

export const GET = handle
export const POST = handle
export const PUT = handle
export const PATCH = handle
export const DELETE = handle
