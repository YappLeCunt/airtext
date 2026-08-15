import Room from './Room'

interface Env {
  ASSETS: Fetcher
  ROOMS: DurableObjectNamespace
}

export { Room }

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const roomMatch = url.pathname.match(/^\/room\/([A-Z0-9]{8})$/i)
    if (roomMatch) {
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
        return new Response('WebSocket upgrade required', { status: 426 })
      }
      const roomId = env.ROOMS.idFromName(roomMatch[1].toUpperCase())
      return env.ROOMS.get(roomId).fetch(request)
    }

    return env.ASSETS.fetch(request)
  },
}
