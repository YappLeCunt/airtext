import type { ClientMessage, DeviceKind, ServerMessage } from '../types'
import { isServerMessage } from '../types'

export type RoomClientEvent =
  | { type: 'status'; status: 'connecting' | 'waiting' | 'connected' | 'disconnected' | 'error'; message?: string }
  | { type: 'server'; message: ServerMessage }

export class RoomClient {
  private socket: WebSocket | null = null
  private readonly listeners = new Set<(event: RoomClientEvent) => void>()
  private pingTimer: number | undefined

  constructor(private readonly code: string, private readonly device: DeviceKind) {}

  subscribe(listener: (event: RoomClientEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  connect(): void {
    this.emit({ type: 'status', status: 'connecting' })
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const socketUrl = `${protocol}//${window.location.host}/room/${encodeURIComponent(this.code)}`
    this.socket = new WebSocket(socketUrl)
    this.socket.addEventListener('open', () => {
      this.send({ type: 'hello', version: 1, device: this.device })
      this.emit({ type: 'status', status: this.device === 'desktop' ? 'waiting' : 'connecting' })
      this.pingTimer = window.setInterval(() => this.send({ type: 'ping', timestamp: Date.now() }), 20_000)
    })
    this.socket.addEventListener('message', (event) => {
      try {
        const message: unknown = JSON.parse(event.data as string)
        if (!isServerMessage(message)) {
          this.emit({ type: 'status', status: 'error', message: 'The room sent an invalid message.' })
          return
        }
        if (message.type === 'hello' || message.type === 'peer-joined') {
          if (message.peers === 2) this.emit({ type: 'status', status: 'connected' })
          else this.emit({ type: 'status', status: 'waiting' })
        }
        if (message.type === 'peer-left') this.emit({ type: 'status', status: 'waiting' })
        if (message.type === 'error') this.emit({ type: 'status', status: 'error', message: message.message })
        this.emit({ type: 'server', message })
      } catch {
        this.emit({ type: 'status', status: 'error', message: 'The room sent unreadable data.' })
      }
    })
    this.socket.addEventListener('close', () => {
      this.clearPing()
      this.emit({ type: 'status', status: 'disconnected' })
    })
    this.socket.addEventListener('error', () => this.emit({ type: 'status', status: 'error', message: 'Could not reach this room.' }))
  }

  send(message: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message))
  }

  close(): void {
    this.clearPing()
    this.socket?.close()
    this.socket = null
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
  try {
    const url = new URL(input)
    return url.searchParams.get('join')?.trim().toUpperCase() ?? null
  } catch {
    const code = input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    return /^[A-Z0-9]{8}$/.test(code) ? code : null
  }
}
