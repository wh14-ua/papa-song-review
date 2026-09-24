import { describe, expect, it } from 'vitest'
import { describePlayerError } from './youtube'

describe('describePlayerError', () => {
  it.each([
    [101, 'not-embeddable'],
    [150, 'not-embeddable'],
    [153, 'not-embeddable'],
    [100, 'removed'],
    [2, 'failed'],
    [5, 'failed'],
  ])('código %i → %s', (code, expected) => {
    expect(describePlayerError(code)).toBe(expected)
  })
})
