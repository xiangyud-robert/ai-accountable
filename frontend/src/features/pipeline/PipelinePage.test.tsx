import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import { UNREACHABLE_MESSAGE } from '../../lib/api'
import type { StageKey } from '../../lib/types'
import { STAGES, dealRow, mockFetch, renderWithApp } from '../../test-utils'
import { PipelinePage } from './PipelinePage'

const deal = (id: number, stage: StageKey, value: number) => dealRow({ id, name: `Deal ${id}`, stage, value })

// At each stage's usual probability: 10%, 50%, 100% and 0%.
const DEALS = [deal(1, 'new', 10_000), deal(2, 'proposal', 20_000), deal(3, 'won', 50_000), deal(4, 'lost', 30_000)]

describe('PipelinePage', () => {
  test('the header counts, adds up and expects the open deals only', () => {
    mockFetch(() => ({ body: [] }))
    renderWithApp(<PipelinePage />, { data: [[['deals'], DEALS]] })
    const header = within(screen.getByLabelText('Open deals'))
    expect(header.getAllByRole('term').map((term) => term.textContent)).toEqual([
      'Open deals',
      'Open value',
      'Expected revenue',
    ])
    expect(header.getAllByRole('definition').map((figure) => figure.textContent)).toEqual(['2', '$30,000', '$11,000'])
  })

  test('shows a column for every stage, in order, with its deals and figures', () => {
    mockFetch(() => ({ body: [] }))
    renderWithApp(<PipelinePage />, { data: [[['deals'], DEALS]] })
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(
      STAGES.map((stage) => stage.name),
    )
    const proposal = within(screen.getByRole('region', { name: 'Proposal' }))
    expect(proposal.getByText('Deal 2')).toBeInTheDocument()
    expect(proposal.getByText(/expected/)).toHaveTextContent('$10,000 expected')
    expect(within(screen.getByRole('region', { name: 'Won' })).getByText('Won, all time')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Lost' })).getByText('Lost, all time')).toBeInTheDocument()
  })

  test("when the deals can't load, it says so in place of the board and its figures", async () => {
    mockFetch(() => ({ status: 500 }))
    renderWithApp(<PipelinePage />)
    expect(await screen.findByRole('alert')).toHaveTextContent(UNREACHABLE_MESSAGE)
    expect(screen.queryAllByRole('region')).toEqual([])
    expect(screen.queryByText('Open value')).not.toBeInTheDocument()
  })

  test("Add deal opens the form at New, and a column's add button at that column's stage", async () => {
    mockFetch(() => ({ body: [] }))
    renderWithApp(<PipelinePage />, { data: [[['deals'], DEALS]] })

    await userEvent.click(screen.getByRole('button', { name: 'Add deal' }))
    const first = screen.getByRole('dialog', { name: 'Add deal' })
    expect(within(first).getByLabelText('Stage')).toHaveTextContent('New')
    await userEvent.click(within(first).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Add deal in Negotiation' }))
    const second = screen.getByRole('dialog', { name: 'Add deal' })
    expect(within(second).getByLabelText('Stage')).toHaveTextContent('Negotiation')
    expect(within(second).getByLabelText('Probability (%)')).toHaveValue('75')
  })
})
