export type DeviceKind = 'desktop' | 'phone'
export type EntrySource = 'this device' | 'other device'

export interface ClipboardEntry {
  id: string
  text: string
  createdAt: number
  source: EntrySource
  image?: string
  kind?: 'text' | 'image'
}

export type RoomStatus = 'idle' | 'connecting' | 'waiting' | 'connected' | 'disconnected' | 'error'

export type ClientMessage =
  | { type: 'hello'; version: 1; device: DeviceKind }
  | { type: 'clipboard-item'; id: string; sealed: string; createdAt: number }
  | { type: 'ack'; id: string }
  | { type: 'clear-history' }
  | { type: 'ping'; timestamp: number }

export type ServerMessage =
  | { type: 'hello'; version: 1; peers: number }
  | { type: 'peer-joined'; peers: number }
  | { type: 'peer-left'; peers: number }
  | { type: 'clipboard-item'; id: string; sealed: string; createdAt: number; source: DeviceKind }
  | { type: 'ack'; id: string }
  | { type: 'clear-history' }
  | { type: 'pong'; timestamp: number }
  | { type: 'error'; code: string; message: string }

export function isServerMessage(value: unknown): value is ServerMessage {
  if (!value || typeof value !== 'object') return false
  const message = value as Record<string, unknown>
  if (typeof message.type !== 'string') return false

  if (message.type === 'hello') {
    return message.version === 1 && typeof message.peers === 'number'
  }
  if (message.type === 'peer-joined' || message.type === 'peer-left') {
    return typeof message.peers === 'number'
  }
  if (message.type === 'ack') return typeof message.id === 'string'
  if (message.type === 'clear-history') return true
  if (message.type === 'clipboard-item') {
    return typeof message.id === 'string' && typeof message.sealed === 'string' && typeof message.createdAt === 'number' && (message.source === 'desktop' || message.source === 'phone')
  }
  if (message.type === 'pong') return typeof message.timestamp === 'number'
  if (message.type === 'error') return typeof message.code === 'string' && typeof message.message === 'string'
  return false
}

export function isClientMessage(value: unknown): value is ClientMessage {
  if (!value || typeof value !== 'object') return false
  const message = value as Record<string, unknown>
  if (message.type === 'hello') return message.version === 1 && (message.device === 'desktop' || message.device === 'phone')
  if (message.type === 'clipboard-item') {
    return typeof message.id === 'string' && typeof message.sealed === 'string' && typeof message.createdAt === 'number'
  }
  if (message.type === 'ack') return typeof message.id === 'string'
  if (message.type === 'clear-history') return true
  if (message.type === 'ping') return typeof message.timestamp === 'number'
  return false
}

export function getRoomIdFromCode(code: string): string | null {
  const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!/^[A-Z0-9]{8}$/.test(normalized)) return null
  return normalized
}

export function createRoomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(bytes, (byte) => byte.toString(36).toUpperCase().padStart(2, '0')).join('').slice(0, 8)
}

export function roomInviteUrl(code: string): string {
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set('join', code)
  return url.toString()
}
