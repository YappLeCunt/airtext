import { describe, expect, it } from 'vitest'
import { RoomCrypto, seal, open } from './crypto'

describe('room crypto', () => {
  it('seals and opens a message with the same key', async () => {
    const a = new RoomCrypto('ABCD1234')
    const b = new RoomCrypto('ABCD1234')
    const sealed = await seal(a, JSON.stringify({ text: 'secret note' }))
    expect(sealed).toContain('.')
    expect(await open(b, sealed)).toBe('{"text":"secret note"}')
  })

  it('fails to open with a different key', async () => {
    const a = new RoomCrypto('ABCD1234')
    const b = new RoomCrypto('WXYZ5678')
    const sealed = await seal(a, 'top secret')
    expect(await open(b, sealed)).toBeNull()
  })
})
