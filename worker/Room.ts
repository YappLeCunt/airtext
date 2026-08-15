import { encode, MAX_TEXT_LENGTH, parseClientMessage, type DeviceKind } from './protocol'

interface Env {
  ROOMS: DurableObjectNamespace
}

interface Peer {
  socket: WebSocket
  device: DeviceKind | null
  lastMessageAt: number
}

const ROOM_TTL_MS = 30 * 60 * 1000
const MAX_PEERS = 2
const MAX_RATE_PER_SECOND = 1
const RATE_WINDOW_MS = 1_000

export class Room {
  private readonly peers = new Map<WebSocket, Peer>()
  private cleanupTimer: number | undefined

  constructor(private readonly state: DurableObjectState, private readonly env: Env) {}

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('WebSocket upgrade required', { status: 426 })
    }

    const origin = request.headers.get('Origin')
    const requestUrl = new URL(request.url)
    if (origin && new URL(origin).host !== requestUrl.host) return new Response('Origin rejected', { status: 403 })
    if (this.peers.size >= MAX_PEERS) return new Response('Room is full', { status: 409 })

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket]
    server.accept()
    const peer: Peer = { socket: server, device: null, lastMessageAt: 0 }
    this.peers.set(server, peer)
    this.scheduleCleanup()

    server.addEventListener('message', (event) => this.onMessage(peer, event.data))
    server.addEventListener('close', () => this.onClose(peer))
    server.addEventListener('error', () => this.onClose(peer))
    server.send(encode({ type: 'hello', version: 1, peers: this.peers.size }))
    this.broadcast({ type: 'peer-joined', peers: this.peers.size }, server)

    return new Response(null, { status: 101, webSocket: client })
  }

  private onMessage(peer: Peer, raw: string | ArrayBuffer): void {
    if (typeof raw !== 'string' || raw.length > MAX_TEXT_LENGTH + 500) {
      this.sendError(peer.socket, 'payload_too_large', 'This clipboard item is too large.')
      return
    }
    const now = Date.now()
    if (now - peer.lastMessageAt < RATE_WINDOW_MS / MAX_RATE_PER_SECOND) {
      this.sendError(peer.socket, 'rate_limited', 'Too many messages. Slow down and try again.')
      return
    }
    peer.lastMessageAt = now
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      this.sendError(peer.socket, 'invalid_json', 'The room received invalid data.')
      return
    }
    const message = parseClientMessage(parsed)
    if (!message) {
      this.sendError(peer.socket, 'invalid_message', 'The room received an unsupported message.')
      return
    }
    if (message.type === 'hello') {
      peer.device = message.device
      peer.socket.send(encode({ type: 'hello', version: 1, peers: this.peers.size }))
      this.broadcast({ type: 'peer-joined', peers: this.peers.size }, peer.socket)
      return
    }
    if (message.type === 'ping') {
      peer.socket.send(encode({ type: 'pong', timestamp: message.timestamp }))
      return
    }
    if (message.type === 'clipboard-item') {
      if (!peer.device) {
        this.sendError(peer.socket, 'not_ready', 'Identify this device before sharing text.')
        return
      }
      this.broadcast({ ...message, type: 'clipboard-item', source: peer.device }, peer.socket)
    }
    if (message.type === 'clear-history') {
      this.broadcast({ type: 'clear-history' }, peer.socket)
    }
  }

  private onClose(peer: Peer): void {
    if (!this.peers.delete(peer.socket)) return
    this.broadcast({ type: 'peer-left', peers: this.peers.size })
    this.scheduleCleanup()
  }

  private broadcast(message: Parameters<typeof encode>[0], except?: WebSocket): void {
    const data = encode(message)
    this.peers.forEach(({ socket }) => {
      if (socket !== except) socket.send(data)
    })
  }

  private sendError(socket: WebSocket, code: string, message: string): void {
    socket.send(encode({ type: 'error', code, message }))
  }

  private scheduleCleanup(): void {
    if (this.cleanupTimer !== undefined) return
    this.cleanupTimer = setTimeout(() => {
      this.cleanupTimer = undefined
      if (this.peers.size === 0) this.state.storage.deleteAll()
    }, ROOM_TTL_MS) as unknown as number
  }
}

export default Room
