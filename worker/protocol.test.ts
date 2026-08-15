import { describe, expect, it } from 'vitest'
import { parseClientMessage } from './protocol'

describe('worker protocol', () => {
  it('accepts hello and clipboard messages', () => {
    expect(parseClientMessage({ type: 'hello', version: 1, device: 'phone' })).not.toBeNull()
    expect(parseClientMessage({ type: 'clipboard-item', id: '1', text: 'hello', createdAt: 1 })).not.toBeNull()
  })

  it('accepts image clipboard messages', () => {
    expect(parseClientMessage({ type: 'clipboard-item', id: '2', text: '', createdAt: 2, kind: 'image', image: 'data:image/png;base64,abc' })).not.toBeNull()
  })

  it('rejects oversized images and bad kinds', () => {
    expect(parseClientMessage({ type: 'clipboard-item', id: '3', text: '', createdAt: 3, kind: 'image', image: 'data:image/png;base64,' + 'x'.repeat(500_001) })).toBeNull()
    expect(parseClientMessage({ type: 'clipboard-item', id: '4', text: '', createdAt: 4, kind: 'video' })).toBeNull()
  })

  it('accepts clear-history messages', () => {
    expect(parseClientMessage({ type: 'clear-history' })).not.toBeNull()
  })

  it('rejects unknown and oversized messages', () => {
    expect(parseClientMessage({ type: 'nope' })).toBeNull()
    expect(parseClientMessage({ type: 'clipboard-item', id: '1', text: 'x'.repeat(100_001), createdAt: 1 })).toBeNull()
  })
})
