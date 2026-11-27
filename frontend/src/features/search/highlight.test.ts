import { describe, expect, test } from 'vitest'
import { highlight } from './highlight'

describe('highlight', () => {
  test('the match at the start of the name', () => {
    expect(highlight('Harbor Logistics', 'har')).toEqual({ before: '', match: 'Har', after: 'bor Logistics' })
  })

  test('the match in the middle, at the first place it’s found', () => {
    expect(highlight('Harbor Logistics', 'gist')).toEqual({ before: 'Harbor Lo', match: 'gist', after: 'ics' })
    expect(highlight('Harbor Logistics', 'o')).toEqual({ before: 'Harb', match: 'o', after: 'r Logistics' })
  })

  test('in another case, the name keeps its own', () => {
    expect(highlight('Harbor Logistics', 'LOGI')).toEqual({ before: 'Harbor ', match: 'Logi', after: 'stics' })
    expect(highlight('émile dupont', 'ÉMILE')).toEqual({ before: '', match: 'émile', after: ' dupont' })
  })

  test('ignores spaces around the search, as the server does', () => {
    expect(highlight('Cobalt Bank', '  bank ')).toEqual({ before: 'Cobalt ', match: 'Bank', after: '' })
  })

  test('nothing when the search isn’t in the name, or is empty', () => {
    expect(highlight('Harbor Logistics', 'acme')).toBeNull()
    expect(highlight('Harbor Logistics', '   ')).toBeNull()
  })

  test('nothing when folding the case changes the name’s length, so the places don’t line up', () => {
    // "İ" lowercases to "i" and a combining dot, one letter longer, as it does in Python.
    expect('İstanbul Trading'.toLowerCase()).toHaveLength('İstanbul Trading'.length + 1)
    expect(highlight('İstanbul Trading', 'trading')).toBeNull()
  })
})
