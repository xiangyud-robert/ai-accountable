import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { STAGES, renderWithApp } from '../test-utils'
import type { StageKey } from '../lib/types'
import { DataTable, type Column } from './DataTable'

type Row = { id: number; name: string; city: string; stage: StageKey; value: number }

const ROWS: Row[] = [
  { id: 1, name: 'Harbor Logistics fleet', city: 'Boston', stage: 'won', value: 72000 },
  { id: 2, name: 'Cobalt Bank pilot', city: 'Denver', stage: 'new', value: 48000 },
  { id: 3, name: 'acme renewal', city: 'Austin', stage: 'proposal', value: 9500 },
  { id: 4, name: 'Brightline POS', city: 'Chicago', stage: 'lost', value: 120000 },
]

const order = (stage: StageKey) => STAGES.find((s) => s.key === stage)!.order

const COLUMNS: Column<Row>[] = [
  { id: 'name', header: 'Name', value: (r) => r.name },
  { id: 'city', header: 'City', value: (r) => r.city },
  {
    id: 'stage',
    header: 'Stage',
    value: (r) => r.stage,
    text: (r) => STAGES.find((s) => s.key === r.stage)!.name,
    compare: (a, b) => order(a.stage) - order(b.stage),
  },
  { id: 'value', header: 'Value (USD)', value: (r) => r.value, text: (r) => `$${r.value.toLocaleString('en-US')}`, numeric: true },
]

function renderTable(rows = ROWS) {
  renderWithApp(
    <DataTable
      label="Deals"
      rows={rows}
      columns={COLUMNS}
      noun={['deal', 'deals']}
      initialSort={{ id: 'name' }}
      rowId={(r) => r.id}
      rowName={(r) => r.name}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
}

const names = () =>
  within(screen.getByRole('table', { name: 'Deals' }))
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0].textContent)

describe('DataTable', () => {
  test('starts sorted by its first sort, ignoring case', () => {
    renderTable()
    expect(names()).toEqual(['acme renewal', 'Brightline POS', 'Cobalt Bank pilot', 'Harbor Logistics fleet'])
  })

  test('the search matches any column, ignoring case', async () => {
    renderTable()
    const search = screen.getByRole('searchbox', { name: 'Search deals' })
    await userEvent.type(search, 'DENV')
    expect(names()).toEqual(['Cobalt Bank pilot'])
    await userEvent.clear(search)
    await userEvent.type(search, 'propos')
    expect(names()).toEqual(['acme renewal'])
    await userEvent.clear(search)
    await userEvent.type(search, '$120,0')
    expect(names()).toEqual(['Brightline POS'])
  })

  test('a heading toggles the sort between ascending and descending, with aria-sort', async () => {
    renderTable()
    const heading = screen.getByRole('columnheader', { name: /Value \(USD\)/ })
    expect(heading).toHaveAttribute('aria-sort', 'none')
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'ascending')

    await userEvent.click(within(heading).getByRole('button'))
    expect(heading).toHaveAttribute('aria-sort', 'ascending')
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'none')
    expect(names()).toEqual(['acme renewal', 'Cobalt Bank pilot', 'Harbor Logistics fleet', 'Brightline POS'])

    await userEvent.click(within(heading).getByRole('button'))
    expect(heading).toHaveAttribute('aria-sort', 'descending')
    expect(names()).toEqual(['Brightline POS', 'Harbor Logistics fleet', 'Cobalt Bank pilot', 'acme renewal'])

    await userEvent.click(within(heading).getByRole('button'))
    expect(heading).toHaveAttribute('aria-sort', 'ascending')
  })

  test('the stage column sorts in pipeline order, not alphabetically', async () => {
    renderTable()
    await userEvent.click(screen.getByRole('button', { name: 'Stage' }))
    expect(names()).toEqual(['Cobalt Bank pilot', 'acme renewal', 'Harbor Logistics fleet', 'Brightline POS'])
  })

  test('the row count text', async () => {
    renderTable()
    expect(screen.getByText('4 deals')).toBeInTheDocument()
    await userEvent.type(screen.getByRole('searchbox'), 'in')
    expect(await screen.findByText('2 of 4 deals')).toBeInTheDocument()
  })

  test('the message when nothing matches', async () => {
    renderTable()
    await userEvent.type(screen.getByRole('searchbox'), 'acme corp')
    expect(await screen.findByText('No deals match "acme corp".')).toBeInTheDocument()
  })

  test('the message when there are no rows at all', () => {
    renderTable([])
    expect(screen.getByText('No deals yet.')).toBeInTheDocument()
  })

  test('every row has Edit and Delete buttons', () => {
    renderTable()
    expect(screen.getByRole('button', { name: 'Edit Cobalt Bank pilot' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete Cobalt Bank pilot' })).toBeInTheDocument()
  })
})
