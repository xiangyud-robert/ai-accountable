import { render, screen, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { PageHeader } from './PageHeader'

describe('PageHeader', () => {
  test('the title is the page’s main heading and names the browser tab', () => {
    render(<PageHeader title="Deals" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Deals' })).toBeInTheDocument()
    expect(document.title).toBe('Deals - Accountable')
  })

  test('shows the line above the title, anything under it, and the page’s actions', () => {
    render(
      <PageHeader title="Dashboard" eyebrow="Sunday, November 22" actions={<button type="button">Add deal</button>}>
        <p>3 follow-ups due</p>
      </PageHeader>,
    )
    const header = screen.getByRole('banner')
    expect(header).toHaveTextContent(/^Sunday, November 22Dashboard3 follow-ups dueAdd deal$/)
    expect(within(header).getByRole('button', { name: 'Add deal' })).toBeInTheDocument()
  })
})
