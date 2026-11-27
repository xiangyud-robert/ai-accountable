import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { person } from '../test-utils'
import { AddedBy } from './AddedBy'

const DANA = person('Dana Holt')
const JOEL = person('Joel Abara')

const ADDED = { created_at: '2026-11-12T09:30:00', created_by: DANA }

describe('AddedBy', () => {
  test('says who added the record and who last changed it, each with the date', () => {
    const { container } = render(<AddedBy record={{ ...ADDED, updated_at: '2026-11-20T16:05:00', updated_by: JOEL }} />)
    expect([...container.querySelectorAll('p')].map((line) => line.textContent)).toEqual([
      'Added by Dana Holt on Nov 12, 2026',
      'Last changed by Joel Abara on Nov 20, 2026',
    ])
  })

  test('leaves out the second line until the record has been changed', () => {
    render(<AddedBy record={{ ...ADDED, updated_at: ADDED.created_at, updated_by: DANA }} />)
    expect(screen.getByText('Added by Dana Holt on Nov 12, 2026')).toBeInTheDocument()
    expect(screen.queryByText(/Last changed/)).not.toBeInTheDocument()
  })

  test('the person who added it changing it later counts as a change', () => {
    render(<AddedBy record={{ ...ADDED, updated_at: '2026-11-13T10:00:00', updated_by: DANA }} />)
    expect(screen.getByText('Last changed by Dana Holt on Nov 13, 2026')).toBeInTheDocument()
  })

  test('someone else changing it at the same moment still counts, as when the clock is fixed', () => {
    render(<AddedBy record={{ ...ADDED, updated_at: ADDED.created_at, updated_by: JOEL }} />)
    expect(screen.getByText('Last changed by Joel Abara on Nov 12, 2026')).toBeInTheDocument()
  })

  test('shows nothing for a record from before sign-in', () => {
    const { container } = render(
      <AddedBy
        record={{ created_at: ADDED.created_at, created_by: null, updated_at: ADDED.created_at, updated_by: null }}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  test('a record from before sign-in changed since shows only who changed it', () => {
    render(
      <AddedBy
        record={{ created_at: ADDED.created_at, created_by: null, updated_at: '2026-11-20T16:05:00', updated_by: JOEL }}
      />,
    )
    expect(screen.queryByText(/Added by/)).not.toBeInTheDocument()
    expect(screen.getByText('Last changed by Joel Abara on Nov 20, 2026')).toBeInTheDocument()
  })
})
