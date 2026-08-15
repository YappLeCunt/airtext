import Room from './Room'
import Limiter from './Limiter'

interface Env {
  ASSETS: Fetcher
  ROOMS: DurableObjectNamespace
  LIMITER: DurableObjectNamespace
}

export { Room, Limiter }

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(self), clipboard-read=(self), clipboard-write=(self)',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
}

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers)
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(name)) headers.set(name, value)
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

async function enforceIpLimit(request: Request, env: Env): Promise<boolean> {
  const ip = request.headers.get('CF-Connecting-IP') ?? ''
  if (!ip) return true
  const limiterId = env.LIMITER.idFromName(ip)
  const response = await env.LIMITER.get(limiterId).fetch('https://limiter/limit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ip }),
  })
  if (response.status === 429) return false
  return true
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const roomMatch = url.pathname.match(/^\/room\/([A-Z0-9]{8})$/i)
    if (roomMatch) {
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
        return withSecurityHeaders(new Response('WebSocket upgrade required', { status: 426 }))
      }
      const allowed = await enforceIpLimit(request, env)
      if (!allowed) {
        return withSecurityHeaders(new Response('Too many rooms from this network. Try again later.', { status: 429, headers: { 'Retry-After': '3600' } }))
      }
      const roomId = env.ROOMS.idFromName(roomMatch[1].toUpperCase())
      return env.ROOMS.get(roomId).fetch(request)
    }

    return withSecurityHeaders(await env.ASSETS.fetch(request))
  },
}
