import { describe, expect, it } from 'vitest'
import { getRoomIdFromCode } from '../types'
import { parseInvite } from './roomClient'

describe('room invites', () => {
  it('accepts a room code with human spacing', () => {
    expect(getRoomIdFromCode('ab12 cd34')).toBe('AB12CD34')
    expect(parseInvite('AB12-CD34')).toBe('AB12CD34')
  })

  it('extracts a room code from an invite URL', () => {
    expect(parseInvite('https://airtext.example/?join=AB12CD34')).toBe('AB12CD34')
  })

  it('rejects incomplete codes', () => {
    expect(getRoomIdFromCode('ABC')).toBeNull()
    expect(parseInvite('not a room code')).toBeNull()
  })
})
