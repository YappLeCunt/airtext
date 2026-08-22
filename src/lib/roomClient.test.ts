import { describe, expect, it } from 'vitest'
import { getRoomIdFromCode, MAX_SEALED_LENGTH, MAX_TEXT_LENGTH } from '../types'
import { parseInvite, RoomClient } from './roomClient'

describe('room invites', () => {
  it('accepts a room code with human spacing', () => {
    expect(getRoomIdFromCode('ab12 cd34')).toBe('AB12CD34')
    expect(parseInvite('AB12-CD34')).toBe('AB12CD34')
  })

  it('extracts a room code from an invite URL', () => {
    expect(parseInvite('https://airtext.example/#join=AB12CD34')).toBe('AB12CD34')
    expect(parseInvite('https://airtext.example/?join=AB12CD34')).toBe('AB12CD34')
  })

  it('rejects incomplete codes', () => {
    expect(getRoomIdFromCode('ABC')).toBeNull()
    expect(parseInvite('not a room code')).toBeNull()
    expect(parseInvite('https://airtext.example/#join=SHORT')).toBeNull()
  })
})

// Test-only globals for vitest's node environment: the stubs provide exactly
// the members the client reads (location for the socket URL, OPEN for state
// checks). Real sockets are never opened — the DI factory below injects a fake.
const stubWindow = { location: { protocol: 'https:', host: 'airtext.example' } } as unknown as Window & typeof globalThis
globalThis.window = stubWindow
const stubWebSocket = { OPEN: 1 } as unknown as typeof WebSocket
globalThis.WebSocket = stubWebSocket

interface SentMessage {
  sealed: string
}

describe('sendClipboardItem size guard', () => {
  function clientWithFakeSocket() {
    const sent: string[] = []
    const fake = {
      readyState: 1,
      send: (data: string) => { sent.push(data) },
      close: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }
    // The fake implements every WebSocket member RoomClient touches; the
    // factory parameter is the DI seam that lets tests inject it.
    const createSocket = () => fake as unknown as WebSocket
    const client = new RoomClient('AB12CD34', 'desktop', createSocket)
    client.connect()
    return { client, sent }
  }

  it('sends an item at the documented text limit', async () => {
    const { client, sent } = clientWithFakeSocket()
    await client.sendClipboardItem('id-1', 1, { text: 'a'.repeat(MAX_TEXT_LENGTH), kind: 'text' })
    expect(sent).toHaveLength(1)
    const message = JSON.parse(sent[0]) as SentMessage
    expect(message.sealed.length).toBeLessThanOrEqual(MAX_SEALED_LENGTH)
  })

  it('rejects an item whose sealed form exceeds the transfer budget', async () => {
    const { client, sent } = clientWithFakeSocket()
    const oversized = 'a'.repeat(MAX_TEXT_LENGTH) + 'A'.repeat(600_000)
    await expect(client.sendClipboardItem('id-2', 2, { text: oversized, kind: 'text' })).rejects.toThrow(/too large/)
    expect(sent).toHaveLength(0)
  })
})
