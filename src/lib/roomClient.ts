import type { ClientMessage, DeviceKind, ServerMessage } from '../types'
import { isServerMessage, MAX_SEALED_LENGTH } from '../types'
import { RoomCrypto, seal, open } from './crypto'

export type RoomClientEvent =
  | { type: 'status'; status: 'connecting' | 'waiting' | 'connected' | 'disconnected' | 'error'; message?: string }
  | { type: 'server'; message: ServerMessage }
  | { type: 'decrypted'; payload: { id: string; text: string; createdAt: number; image?: string; kind?: 'text' | 'image' } }
  | { type: 'delivered'; id: string }

const MAX_RECONNECT_ATTEMPTS = 5
const BASE_RECONNECT_DELAY_MS = 1_000
const MAX_RECONNECT_DELAY_MS = 15_000

export type SocketFactory = (url: string) => WebSocket

export class RoomClient {
  private socket: WebSocket | null = null
  private readonly listeners = new Set<(event: RoomClientEvent) => void>()
  private pingTimer: number | undefined
  private reconnectTimer: number | undefined
  private reconnectAttempts = 0
  private manuallyClosed = false
  private readonly crypto: RoomCrypto

  constructor(
    private readonly code: string,
    private readonly device: DeviceKind,
    private readonly createSocket: SocketFactory = (url) => new WebSocket(url),
  ) {
    this.crypto = new RoomCrypto(code)
  }

  subscribe(listener: (event: RoomClientEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  connect(): void {
    this.manuallyClosed = false
    this.reconnectAttempts = 0
    this.openSocket()
  }

  isOpen(): boolean {
    const readyState = this.socket?.readyState
    return readyState === WebSocket.OPEN || readyState === WebSocket.CONNECTING
  }

  private openSocket(): void {
    this.emit({ type: 'status', status: 'connecting' })
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const socketUrl = `${protocol}//${window.location.host}/room/${encodeURIComponent(this.code)}`
    const socket = this.createSocket(socketUrl)
    this.socket = socket

    socket.addEventListener('open', () => {
      if (socket !== this.socket) return
      this.reconnectAttempts = 0
      this.send({ type: 'hello', version: 1, device: this.device })
      this.emit({ type: 'status', status: this.device === 'desktop' ? 'waiting' : 'connecting' })
      // Re-hello periodically so a fresh Durable Object instance (after eviction)
      // re-registers this peer, and the peer-replacement logic swaps stale sockets.
      this.pingTimer = window.setInterval(() => {
        this.send({ type: 'hello', version: 1, device: this.device })
      }, 15_000)
    })

    socket.addEventListener('message', (event) => {
      if (socket !== this.socket) return
      void this.onMessage(event.data as string)
    })

    socket.addEventListener('close', () => {
      if (socket !== this.socket) return
      this.clearPing()
      // A deliberate close() (e.g. leaving the room or reconnecting with a new
      // socket) must not emit "disconnected": the UI would flash an error and
      // a "Start over" button while the new connection is still forming.
      if (this.manuallyClosed) return
      this.emit({ type: 'status', status: 'disconnected' })
      this.scheduleReconnect()
    })

    socket.addEventListener('error', () => {
      if (socket !== this.socket) return
      if (this.manuallyClosed) return
      this.emit({ type: 'status', status: 'error', message: 'Could not reach this room.' })
    })
  }

  private async onMessage(raw: string): Promise<void> {
    try {
      const message: unknown = JSON.parse(raw)
      if (!isServerMessage(message)) {
        this.emit({ type: 'status', status: 'error', message: 'The room sent an invalid message.' })
        return
      }
      if (message.type === 'hello' || message.type === 'peer-joined') {
        if (message.peers === 2) this.emit({ type: 'status', status: 'connected' })
        else this.emit({ type: 'status', status: 'waiting' })
      }
      if (message.type === 'peer-left') {
        // Count-aware: during a reconnect the old socket can be closed before
        // the new one's hello registers, so a "peer-left peers=2" arrives even
        // though both peers are still present. Only drop to "waiting" when a
        // peer actually left.
        this.emit({ type: 'status', status: message.peers === 2 ? 'connected' : 'waiting' })
      }
      if (message.type === 'error') {
        this.emit({ type: 'status', status: 'error', message: message.message })
        // A definitive rejection (another live socket owns this device) should
        // not be retried forever: the server keeps a cooldown anyway, and a
        // loser that keeps reconnecting would keep re-replacing the winner.
        if (message.code === 'device_in_use') this.stopRetrying()
      }
      if (message.type === 'clipboard-item') {
        const plaintext = await open(this.crypto, message.sealed)
        if (plaintext !== null) {
          this.emit({
            type: 'decrypted',
            // Fall back to the outer message's metadata for old-format senders
            // that did not seal id/createdAt inside the payload.
            payload: { ...JSON.parse(plaintext), id: message.id, createdAt: message.createdAt },
          })
          // Acknowledge delivery so the sender can mark the item as delivered.
          this.send({ type: 'ack', id: message.id })
        }
      }
      if (message.type === 'ack') {
        this.emit({ type: 'delivered', id: message.id })
      }
      this.emit({ type: 'server', message })
    } catch {
      this.emit({ type: 'status', status: 'error', message: 'The room sent unreadable data.' })
    }
  }

  send(message: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message))
  }

  async sendClipboardItem(id: string, createdAt: number, payload: { text: string; image?: string; kind?: 'text' | 'image' }): Promise<void> {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected. The room is reconnecting — try again in a moment.')
    }
    const sealedPayload = await seal(this.crypto, JSON.stringify({ ...payload, id, createdAt }))
    if (sealedPayload.length > MAX_SEALED_LENGTH) {
      throw new Error('This item is too large to share in one piece.')
    }
    this.send({ type: 'clipboard-item', id, sealed: sealedPayload, createdAt })
  }

  close(): void {
    this.manuallyClosed = true
    this.clearPing()
    this.clearReconnect()
    this.socket?.close()
    this.socket = null
  }

  private scheduleReconnect(): void {
    if (this.manuallyClosed || this.reconnectTimer !== undefined) return
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return
    const delay = Math.min(BASE_RECONNECT_DELAY_MS * 2 ** this.reconnectAttempts, MAX_RECONNECT_DELAY_MS)
    this.reconnectAttempts += 1
    this.emit({ type: 'status', status: 'error', message: 'Connection lost. Reconnecting…' })
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = undefined
      this.openSocket()
    }, delay)
  }

  private stopRetrying(): void {
    this.manuallyClosed = true
    this.clearPing()
    this.clearReconnect()
  }

  private clearReconnect(): void {
    if (this.reconnectTimer !== undefined) window.clearTimeout(this.reconnectTimer)
    this.reconnectTimer = undefined
  }

  private clearPing(): void {
    if (this.pingTimer !== undefined) window.clearInterval(this.pingTimer)
    this.pingTimer = undefined
  }

  private emit(event: RoomClientEvent): void {
    this.listeners.forEach((listener) => listener(event))
  }
}

export function parseInvite(input: string): string | null {
  const text = input.trim()
  try {
    const url = new URL(text)
    const fromQuery = url.searchParams.get('join')?.trim().toUpperCase()
    if (fromQuery) return /^[A-Z0-9]{8}$/.test(fromQuery) ? fromQuery : null
    // Current invites carry the code in the fragment (#join=CODE).
    const fromHash = /(?:^|[#&])join=([A-Za-z0-9]{8})(?:$|&)/.exec(url.hash)
    return fromHash ? fromHash[1].toUpperCase() : null
  } catch {
    const code = text.toUpperCase().replace(/[^A-Z0-9]/g, '')
    return /^[A-Z0-9]{8}$/.test(code) ? code : null
  }
}
