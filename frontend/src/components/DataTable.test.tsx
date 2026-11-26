import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { STAGES, bodyRows, renderWithApp } from '../test-utils'
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
  {
    id: 'value',
    header: 'Value (USD)',
    value: (r) => r.value,
    text: (r) => `$${r.value.toLocaleString('en-US')}`,
    numeric: true,
  },
]

function renderTable(rows = ROWS, props: Partial<Parameters<typeof DataTable<Row>>[0]> = {}) {
  const onEdit = vi.fn()
  const onDelete = vi.fn()
  renderWithApp(
    <DataTable
      label="Deals"
      rows={rows}
      columns={COLUMNS}
      noun={['deal', 'deals']}
      initialSort={{ id: 'name' }}
      rowId={(r) => r.id}
      rowName={(r) => r.name}
      onEdit={onEdit}
      onDelete={onDelete}
      {...props}
    />,
  )
  return { onEdit, onDelete }
}

const names = () => bodyRows('Deals').map(([name]) => name)

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

  test('empty values sort last, ascending and descending', async () => {
    renderTable([...ROWS, { id: 5, name: 'Nowhere deal', city: '', stage: 'new', value: 1000 }])
    const city = screen.getByRole('button', { name: 'City' })
    await userEvent.click(city)
    expect(names()).toEqual([
      'acme renewal',
      'Harbor Logistics fleet',
      'Brightline POS',
      'Cobalt Bank pilot',
      'Nowhere deal',
    ])
    await userEvent.click(city)
    expect(names()).toEqual([
      'Cobalt Bank pilot',
      'Brightline POS',
      'Harbor Logistics fleet',
      'acme renewal',
      'Nowhere deal',
    ])
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

  test('a single row is counted in the singular', async () => {
    renderTable(ROWS.slice(0, 1))
    expect(screen.getByText('1 deal')).toBeInTheDocument()
    await userEvent.type(screen.getByRole('searchbox'), 'harbor')
    expect(await screen.findByText('1 of 1 deal')).toBeInTheDocument()
  })

  test('the message when there are no rows at all', () => {
    renderTable([])
    expect(screen.getByText('No deals yet.')).toBeInTheDocument()
  })

  test('with no rows at all, it offers its Add button instead of a table', () => {
    renderTable([], { emptyAction: <button type="button">Add deal</button> })
    expect(screen.getByRole('button', { name: 'Add deal' })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  test('every row has Edit and Delete buttons', () => {
    renderTable()
    expect(screen.getByRole('button', { name: 'Edit Cobalt Bank pilot' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete Cobalt Bank pilot' })).toBeInTheDocument()
  })

  test('Edit and Delete act on their own row', async () => {
    const { onEdit, onDelete } = renderTable()
    await userEvent.click(screen.getByRole('button', { name: 'Edit Cobalt Bank pilot' }))
    expect(onEdit).toHaveBeenCalledExactlyOnceWith(ROWS[1])
    await userEvent.click(screen.getByRole('button', { name: 'Delete Brightline POS' }))
    expect(onDelete).toHaveBeenCalledExactlyOnceWith(ROWS[3])
  })
})
