import { describe, expect, it } from 'vitest'
import { parseClientMessage } from './protocol'

describe('worker protocol', () => {
  it('accepts hello and clipboard messages', () => {
    expect(parseClientMessage({ type: 'hello', version: 1, device: 'phone' })).not.toBeNull()
    expect(parseClientMessage({ type: 'clipboard-item', id: '1', text: 'hello', createdAt: 1 })).not.toBeNull()
  })

  it('rejects unknown and oversized messages', () => {
    expect(parseClientMessage({ type: 'nope' })).toBeNull()
    expect(parseClientMessage({ type: 'clipboard-item', id: '1', text: 'x'.repeat(100_001), createdAt: 1 })).toBeNull()
  })
})
