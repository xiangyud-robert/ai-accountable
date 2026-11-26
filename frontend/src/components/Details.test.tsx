import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { Details } from './Details'

const terms = () => screen.getAllByRole('term').map((dt) => dt.textContent)
const definitions = () => screen.getAllByRole('definition').map((dd) => dd.textContent)

describe('Details', () => {
  test('lists each label with its value, in order', () => {
    render(
      <Details
        items={[
          ['Industry', 'Logistics'],
          ['Website', <a href="https://harborlogistics.com">harborlogistics.com</a>],
        ]}
      />,
    )
    expect(terms()).toEqual(['Industry', 'Website'])
    expect(definitions()).toEqual(['Logistics', 'harborlogistics.com'])
    expect(screen.getByRole('link', { name: 'harborlogistics.com' })).toHaveAttribute(
      'href',
      'https://harborlogistics.com',
    )
  })

  test('an empty value shows a dash, but zero is a value', () => {
    render(
      <Details
        items={[
          ['Phone', null],
          ['Job title', undefined],
          ['Open deals', 0],
        ]}
      />,
    )
    expect(definitions()).toEqual(['-', '-', '0'])
  })
})
