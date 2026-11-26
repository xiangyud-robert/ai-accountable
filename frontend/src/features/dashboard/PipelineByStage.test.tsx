import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test } from 'vitest'
import type { Dashboard } from '../../lib/types'
import { chart, renderWithApp, STAGES, stubChartSize, tableRows, tooltipLine } from '../../test-utils'
import { PipelineByStage } from './PipelineByStage'

const DASHBOARD: Dashboard = {
  today: '2026-06-15',
  this_month: { month: '2026-06', revenue: 0, count: 0 },
  last_month: { month: '2026-05', revenue: 0, count: 0 },
  months: [],
  last_12_months: { count: 0, value: 0 },
  open: { count: 19, value: 804_500, expected: 384_775 },
  by_stage: [
    { stage: 'new', count: 5, value: 131_000, expected: 13_100 },
    { stage: 'qualified', count: 5, value: 169_000, expected: 42_250 },
    { stage: 'proposal', count: 5, value: 245_500, expected: 132_250 },
    { stage: 'negotiation', count: 4, value: 259_000, expected: 197_175 },
  ],
  funnel: [],
  lost: { count: 0, value: 0 },
  follow_ups: [],
  recent: [],
}

const renderPanel = () => renderWithApp(<PipelineByStage dashboard={DASHBOARD} stages={STAGES} />)

beforeEach(() => stubChartSize())

/** A stage's column: the solid expected part, then the tinted rest above it. */
const column = (stage: string) => Array.from(chart().querySelectorAll(`path[name="${stage}"]`))

const attribute = (element: Element, name: string) => Number(element.getAttribute(name))

/** Moves the pointer over the middle of a stage's column. */
async function pointAt(stage: string) {
  const [solid] = column(stage)
  const x = attribute(solid, 'x') + attribute(solid, 'width') / 2
  await userEvent.pointer({ target: chart(), coords: { clientX: x, clientY: 120 } })
}

const texts = (elements: HTMLElement[]) => elements.map((element) => element.textContent)

describe('PipelineByStage', () => {
  test('each open stage is labelled with its expected revenue beneath and its value on top', () => {
    renderPanel()
    expect(texts(within(chart()).getAllByText(/^(New|Qualified|Proposal|Negotiation)$/))).toEqual([
      'New',
      'Qualified',
      'Proposal',
      'Negotiation',
    ])
    expect(texts(within(chart()).getAllByText(/ exp\.$/))).toEqual([
      '$13.1K exp.',
      '$42.3K exp.',
      '$132K exp.',
      '$197K exp.',
    ])
    expect(texts(within(chart()).getAllByText(/^\$[\d.]+K$/))).toEqual(['$131K', '$169K', '$246K', '$259K'])
  })

  test('each column is solid in its stage’s color up to the expected revenue, and tinted above it', () => {
    renderPanel()
    const [solid, rest] = column('Proposal')
    expect(solid).toHaveAttribute('fill', 'var(--color-stage-proposal)')
    expect(rest).toHaveAttribute('fill', 'var(--color-stage-proposal-tint)')
    expect(attribute(rest, 'y') + attribute(rest, 'height')).toBeCloseTo(attribute(solid, 'y'))
    const solidShare = attribute(solid, 'height') / (attribute(solid, 'height') + attribute(rest, 'height'))
    expect(solidShare).toBeCloseTo(132_250 / 245_500)
  })

  test('pointing at a stage shows its full value, its expected revenue and its number of deals', async () => {
    renderPanel()
    await pointAt('Proposal')
    // The tooltip's title, as well as the stage's name under its column.
    await waitFor(() => expect(within(chart()).getAllByText('Proposal')).toHaveLength(2))
    expect(tooltipLine('Value')).toHaveTextContent('Value $245,500')
    expect(tooltipLine('Expected')).toHaveTextContent('Expected $132,250')
    expect(tooltipLine('Deals')).toHaveTextContent('Deals 5')
  })

  test('the panel links to the pipeline, and so does the chart', async () => {
    const { router } = renderPanel()
    expect(screen.getByRole('link', { name: 'Pipeline' })).toHaveAttribute('href', '/pipeline')
    await userEvent.click(chart())
    expect(router.state.location.pathname).toBe('/pipeline')
  })

  test('screen readers get the totals in words and each stage’s figures in a table', () => {
    renderPanel()
    expect(screen.getByText('$804,500 open, $384,775 expected')).toBeInTheDocument()
    expect(tableRows('Open pipeline by stage')).toEqual([
      ['Stage', 'Open deals', 'Value (USD)', 'Expected revenue (USD)'],
      ['New', '5', '$131,000', '$13,100'],
      ['Qualified', '5', '$169,000', '$42,250'],
      ['Proposal', '5', '$245,500', '$132,250'],
      ['Negotiation', '4', '$259,000', '$197,175'],
    ])
  })
})
