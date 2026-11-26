import { render, screen, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { panel } from '../test-utils'
import { Panel } from './Panel'

describe('Panel', () => {
  test('with a title, it’s a region named by its heading, with the subtitle and action', () => {
    render(
      <Panel title="Follow-ups" subtitle="Overdue first" action={<button type="button">Add deal</button>}>
        <p>Call Priya about the renewal</p>
      </Panel>,
    )
    const followUps = within(panel('Follow-ups'))
    expect(followUps.getByRole('heading', { level: 2, name: 'Follow-ups' })).toBeInTheDocument()
    expect(followUps.getByText('Overdue first')).toBeInTheDocument()
    expect(followUps.getByRole('button', { name: 'Add deal' })).toBeInTheDocument()
    expect(followUps.getByText('Call Priya about the renewal')).toBeInTheDocument()
  })

  test('an action shows without a title, and the panel isn’t a named region', () => {
    render(
      <Panel action={<button type="button">Add contact</button>}>
        <p>No contacts yet.</p>
      </Panel>,
    )
    expect(screen.getByRole('button', { name: 'Add contact' })).toBeInTheDocument()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })

  test('with neither, it holds only its content', () => {
    const { container } = render(
      <Panel>
        <p>Page not found</p>
      </Panel>,
    )
    expect(container).toHaveTextContent(/^Page not found$/)
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })
})
