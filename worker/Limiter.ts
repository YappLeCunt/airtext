const MAX_PER_IP_PER_HOUR = 100
const WINDOW_MS = 60 * 60 * 1000
const KEY_PREFIX = 'ip:'

interface RateState {
  count: number
  windowStart: number
}

export class Limiter {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname !== '/limit' || request.method !== 'POST') {
      return new Response('Not found', { status: 404 })
    }
    let body: { ip?: string }
    try {
      body = (await request.json()) as { ip?: string }
    } catch {
      return new Response('Invalid body', { status: 400 })
    }
    const ip = typeof body.ip === 'string' && body.ip.length <= 64 ? body.ip : ''
    if (!ip) return new Response('Missing ip', { status: 400 })

    const key = KEY_PREFIX + ip
    const now = Date.now()
    const existing = (await this.state.storage.get<RateState>(key)) ?? { count: 0, windowStart: now }
    if (now - existing.windowStart >= WINDOW_MS) {
      existing.count = 0
      existing.windowStart = now
    }
    existing.count += 1
    await this.state.storage.put(key, existing)
    if (existing.count > MAX_PER_IP_PER_HOUR) {
      return new Response('Rate limit exceeded', { status: 429, headers: { 'Retry-After': '3600' } })
    }
    return new Response('OK', { status: 200 })
  }
}

export default Limiter
