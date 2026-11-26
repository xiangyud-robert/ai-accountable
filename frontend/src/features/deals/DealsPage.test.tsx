import type { QueryKey } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import { Toaster } from '../../components/Toaster'
import { UNREACHABLE_MESSAGE } from '../../lib/api'
import type { DealRow } from '../../lib/types'
import { bodyRows, dealRow, mockFetch, renderWithApp } from '../../test-utils'
import { DealsPage } from './DealsPage'

const NO_ORGANIZATION = { organization_id: null, organization_name: null }
const NO_CONTACT = { contact_id: null, contact_name: null }

const HARBOR = dealRow()
const DEALS = [
  HARBOR,
  dealRow({
    id: 2,
    name: 'Cobalt Bank pilot',
    organization_id: 2,
    organization_name: 'Cobalt Bank',
    contact_id: 11,
    contact_name: 'Daniel Okafor',
    stage: 'new',
    value: 12_500,
    close_date: '2026-12-20',
    activity_count: 0,
  }),
  dealRow({
    ...NO_CONTACT,
    id: 3,
    name: 'Meridian Health portal',
    organization_id: 3,
    organization_name: 'Meridian Health',
    stage: 'won',
    value: 150_000,
    close_date: '2026-10-02',
  }),
  dealRow({
    ...NO_ORGANIZATION,
    ...NO_CONTACT,
    id: 4,
    name: 'Atlas Robotics training',
    stage: 'new',
    value: 5_000,
    close_date: '2026-11-01',
    late: true,
  }),
  dealRow({
    ...NO_ORGANIZATION,
    ...NO_CONTACT,
    id: 5,
    name: 'Brightline Retail POS integration',
    stage: 'lost',
    value: 40_000,
    close_date: '2026-09-15',
  }),
  dealRow({
    ...NO_ORGANIZATION,
    ...NO_CONTACT,
    id: 6,
    name: 'Northwind analytics rollout',
    stage: 'negotiation',
    value: 98_000,
    close_date: '2027-01-15',
  }),
]

function renderPage(deals: DealRow[] | null = DEALS) {
  // Outside the router, as in the app.
  render(<Toaster />)
  const data: [QueryKey, unknown][] = [
    // What the deal form chooses from.
    [['organizations'], []],
    [['contacts'], []],
  ]
  if (deals) data.push([['deals'], deals])
  return renderWithApp(<DealsPage />, { data })
}

const table = () => screen.getByRole('table', { name: 'Deals' })
const names = () => bodyRows('Deals').map(([name]) => name)

describe('DealsPage', () => {
  test('lists the deals in pipeline order, then by close date, with their figures', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'Deals' })).toBeInTheDocument()
    expect(screen.getByText('6 deals')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Stage' })).toHaveAttribute('aria-sort', 'ascending')
    expect(bodyRows('Deals')).toEqual([
      ['Atlas Robotics training', '', '', 'New', '$5,000', '10%', '$500', 'Nov 1, 2026Late', ''],
      ['Cobalt Bank pilot', 'Cobalt Bank', 'Daniel Okafor', 'New', '$12,500', '10%', '$1,250', 'Dec 20, 2026', ''],
      [
        'Harbor Logistics fleet analytics',
        'Harbor Logistics',
        'Priya Raman',
        'Proposal',
        '$72,000',
        '50%',
        '$36,000',
        'Dec 11, 2026',
        '',
      ],
      ['Northwind analytics rollout', '', '', 'Negotiation', '$98,000', '75%', '$73,500', 'Jan 15, 2027', ''],
      ['Meridian Health portal', 'Meridian Health', '', 'Won', '$150,000', '100%', '$150,000', 'Oct 2, 2026', ''],
      ['Brightline Retail POS integration', '', '', 'Lost', '$40,000', '0%', '$0', 'Sep 15, 2026', ''],
    ])
  })

  test('each name links to its deal’s page', () => {
    renderPage()
    expect(within(table()).getByRole('link', { name: 'Harbor Logistics fleet analytics' })).toHaveAttribute(
      'href',
      '/deals/7',
    )
  })

  test('sorting by stage the other way still goes by the pipeline, never the alphabet', async () => {
    renderPage()
    await userEvent.click(within(table()).getByRole('button', { name: 'Stage' }))
    expect(screen.getByRole('columnheader', { name: 'Stage' })).toHaveAttribute('aria-sort', 'descending')
    expect(names()).toEqual([
      'Brightline Retail POS integration',
      'Meridian Health portal',
      'Northwind analytics rollout',
      'Harbor Logistics fleet analytics',
      'Cobalt Bank pilot',
      'Atlas Robotics training',
    ])
  })

  test.each([
    ['Value (USD)', 4, ['$5,000', '$12,500', '$40,000', '$72,000', '$98,000', '$150,000']],
    ['Probability', 5, ['0%', '10%', '10%', '50%', '75%', '100%']],
    ['Expected (USD)', 6, ['$0', '$500', '$1,250', '$36,000', '$73,500', '$150,000']],
  ])('sorting by %s goes by the amount, not the text shown', async (header, column, shown) => {
    renderPage()
    await userEvent.click(within(table()).getByRole('button', { name: header }))
    expect(screen.getByRole('columnheader', { name: header })).toHaveAttribute('aria-sort', 'ascending')
    expect(bodyRows('Deals').map((cells) => cells[column])).toEqual(shown)
  })

  test('sorting by close date goes by the date, not the text shown', async () => {
    renderPage()
    await userEvent.click(within(table()).getByRole('button', { name: 'Close date' }))
    expect(names()).toEqual([
      'Brightline Retail POS integration',
      'Meridian Health portal',
      'Atlas Robotics training',
      'Harbor Logistics fleet analytics',
      'Cobalt Bank pilot',
      'Northwind analytics rollout',
    ])
  })

  test('the search matches figures and dates as they’re shown', async () => {
    renderPage()
    const search = screen.getByRole('searchbox', { name: 'Search deals' })
    await userEvent.type(search, '$72,000')
    expect(await screen.findByText('1 of 6 deals')).toBeInTheDocument()
    expect(names()).toEqual(['Harbor Logistics fleet analytics'])
    await userEvent.clear(search)
    await userEvent.type(search, 'Jan 15')
    await waitFor(() => expect(names()).toEqual(['Northwind analytics rollout']))
    await userEvent.clear(search)
    await userEvent.type(search, '75%')
    await waitFor(() => expect(names()).toEqual(['Northwind analytics rollout']))
  })

  test('the search matches the main contact and the stage’s name', async () => {
    renderPage()
    const search = screen.getByRole('searchbox', { name: 'Search deals' })
    await userEvent.type(search, 'Priya')
    await waitFor(() => expect(names()).toEqual(['Harbor Logistics fleet analytics']))
    await userEvent.clear(search)
    await userEvent.type(search, 'Won')
    await waitFor(() => expect(names()).toEqual(['Meridian Health portal']))
  })

  test('with no deals yet, it offers to add one', async () => {
    renderPage([])
    expect(screen.getByText('No deals yet.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    const [, emptyAdd] = screen.getAllByRole('button', { name: 'Add deal' })
    await userEvent.click(emptyAdd)
    expect(screen.getByRole('dialog', { name: 'Add deal' })).toBeInTheDocument()
  })

  test('Add deal opens an empty form, which saves a new deal', async () => {
    const calls = mockFetch(() => ({
      status: 201,
      body: dealRow({ id: 8, name: 'Atlas Robotics support', stage: 'new', value: 8_000 }),
    }))
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Add deal' }))
    const dialog = screen.getByRole('dialog', { name: 'Add deal' })
    expect(within(dialog).getByLabelText('Name')).toHaveValue('')
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Atlas Robotics support')
    await userEvent.type(within(dialog).getByLabelText('Value (USD)'), '8000')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      method: 'POST',
      path: '/deals',
      body: { name: 'Atlas Robotics support', stage: 'new', value: 8000 },
    })
    expect(await screen.findByText('Deal saved')).toBeInTheDocument()
  })

  test('Edit opens the form with that deal, and Cancel closes it', async () => {
    const calls = mockFetch()
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Edit Harbor Logistics fleet analytics' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit deal' })
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Harbor Logistics fleet analytics')
    expect(within(dialog).getByLabelText('Stage')).toHaveTextContent('Proposal')
    expect(within(dialog).getByLabelText('Value (USD)')).toHaveValue('72000')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(calls).toEqual([])
  })

  test('Delete asks first, saying what goes with it, and Cancel keeps it', async () => {
    const calls = mockFetch()
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Delete Harbor Logistics fleet analytics' }))
    const question = screen.getByRole('alertdialog', { name: 'Delete Harbor Logistics fleet analytics?' })
    expect(question).toHaveAccessibleDescription(
      'The 4 activities logged on this deal and its stage history will be deleted.',
    )
    await userEvent.click(within(question).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(calls).toEqual([])
  })

  test('confirming deletes the deal and closes the question', async () => {
    const calls = mockFetch(() => ({ status: 204 }))
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Delete Cobalt Bank pilot' }))
    expect(screen.getByRole('alertdialog', { name: 'Delete Cobalt Bank pilot?' })).toHaveAccessibleDescription(
      'Its stage history will be deleted.',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Delete deal' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(calls).toEqual([{ method: 'DELETE', path: '/deals/2', body: undefined }])
    expect(await screen.findByText('Deal deleted')).toBeInTheDocument()
  })

  test('when the delete can’t reach the server, the question stays open and says so', async () => {
    mockFetch(() => ({ status: 500 }))
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Delete Harbor Logistics fleet analytics' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete deal' }))
    expect(await screen.findByText(UNREACHABLE_MESSAGE)).toBeInTheDocument()
    expect(screen.getByRole('alertdialog', { name: 'Delete Harbor Logistics fleet analytics?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete deal' })).toBeEnabled()
  })

  test('loads the deals from the server', async () => {
    const calls = mockFetch(() => ({ body: [HARBOR] }))
    renderPage(null)
    expect(await screen.findByRole('link', { name: 'Harbor Logistics fleet analytics' })).toBeInTheDocument()
    expect(calls).toEqual([{ method: 'GET', path: '/deals', body: undefined }])
  })

  test('when the list can’t load, it says so and Add deal still works', async () => {
    mockFetch(() => ({ status: 500 }))
    renderPage(null)
    expect(await screen.findByRole('alert')).toHaveTextContent(UNREACHABLE_MESSAGE)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add deal' }))
    expect(screen.getByRole('dialog', { name: 'Add deal' })).toBeInTheDocument()
  })
})
