import { describe, expect, it } from 'vitest'
import { normalizeHistory } from './historyStore'

describe('clipboard history', () => {
  it('keeps the newest copy of duplicate text', () => {
    const result = normalizeHistory([
      { id: 'old', text: 'same', createdAt: 1, source: 'this device' },
      { id: 'new', text: 'same', createdAt: 2, source: 'other device' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('new')
  })

  it('drops blank items and sorts newest first', () => {
    const result = normalizeHistory([
      { id: 'blank', text: '  ', createdAt: 3, source: 'this device' },
      { id: 'old', text: 'old', createdAt: 1, source: 'this device' },
      { id: 'new', text: 'new', createdAt: 2, source: 'this device' },
    ])
    expect(result.map((entry) => entry.id)).toEqual(['new', 'old'])
  })
})
