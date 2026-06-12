import { describe, expect, it } from 'vitest'
import { isDragonHealthResponseBody } from './dragon-health'

describe('isDragonHealthResponseBody', () => {
  it('accepts Dragon serve health responses', () => {
    expect(isDragonHealthResponseBody(JSON.stringify({
      status: 'ok',
      service: 'dragon',
      mode: 'serve'
    }))).toBe(true)
  })

  it('rejects generic or legacy runtime health responses', () => {
    expect(isDragonHealthResponseBody(JSON.stringify({ status: 'ok' }))).toBe(false)
    expect(isDragonHealthResponseBody(JSON.stringify({
      status: 'ok',
      service: 'codewhale',
      mode: 'serve'
    }))).toBe(false)
  })
})
