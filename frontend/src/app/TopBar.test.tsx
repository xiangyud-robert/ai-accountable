import { screen, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { renderWithApp } from '../test-utils'
import { TopBar } from './TopBar'

const DANA = { id: 'user-dana', name: 'Dana Holt', email: 'dana.holt@example.com', initials: 'DH', timezone: null }

function renderBar() {
  return renderWithApp(<TopBar />, { data: [[['me'], DANA]] })
}

describe('TopBar', () => {
  test('has a search area, labelled Search, with the search box in it', () => {
    renderBar()
    const search = screen.getByRole('search', { name: 'Search' })
    expect(within(search).getByRole('combobox', { name: 'Search' })).toHaveAttribute(
      'placeholder',
      'Search organizations, contacts and deals',
    )
  })

  test('is the page’s banner, with the search area on the left and the initials button on the right', () => {
    renderBar()
    const banner = screen.getByRole('banner')
    const search = within(banner).getByRole('search', { name: 'Search' })
    const initials = within(banner).getByRole('button', { name: 'Account, Dana Holt, DH' })
    expect(search.compareDocumentPosition(initials) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(banner.lastElementChild).toBe(initials)
  })
})
