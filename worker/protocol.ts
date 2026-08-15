export type DeviceKind = 'desktop' | 'phone'

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

const MAX_TEXT_LENGTH = 100_000
const MAX_SEALED_LENGTH = 700_000

export function parseClientMessage(value: unknown): ClientMessage | null {
  if (!value || typeof value !== 'object') return null
  const message = value as Record<string, unknown>
  if (message.type === 'hello' && message.version === 1 && (message.device === 'desktop' || message.device === 'phone')) {
    return message as ClientMessage
  }
  if (
    message.type === 'clipboard-item' &&
    typeof message.id === 'string' &&
    message.id.length <= 80 &&
    typeof message.sealed === 'string' &&
    message.sealed.length > 0 &&
    message.sealed.length <= MAX_SEALED_LENGTH &&
    typeof message.createdAt === 'number'
  ) {
    return message as ClientMessage
  }
  if (message.type === 'ping' && typeof message.timestamp === 'number') return message as ClientMessage
  if (message.type === 'ack' && typeof message.id === 'string' && message.id.length <= 80) return message as ClientMessage
  if (message.type === 'clear-history') return message as ClientMessage
  return null
}

export function encode(message: ServerMessage): string {
  return JSON.stringify(message)
}

export { MAX_TEXT_LENGTH, MAX_SEALED_LENGTH }
