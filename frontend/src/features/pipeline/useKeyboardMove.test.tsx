import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { DealRow, StageKey } from '../../lib/types'
import { STAGES, mockFetch, renderWithApp } from '../../test-utils'
import { PipelinePage } from './PipelinePage'

function deal(id: number, name: string, stage: StageKey, position: number): DealRow {
  return {
    id, name, stage, position,
    organization_id: null, organization_name: null, contact_id: null, contact_name: null,
    value: 10_000, probability: stage === 'new' ? 10 : 25, expected: 1_000,
    close_date: '2026-12-01', late: false, activity_count: 0, created_at: '', updated_at: '',
  }
}

const DEALS = [
  deal(1, 'Alpha pilot', 'new', 0),
  deal(2, 'Bravo rollout', 'new', 1),
  deal(3, 'Charlie renewal', 'new', 2),
  deal(4, 'Xray licenses', 'qualified', 0),
  deal(5, 'Yankee training', 'qualified', 1),
]

function renderBoard() {
  const calls = mockFetch((method, path) => {
    if (method === 'GET') return { body: path === '/stages' ? STAGES : DEALS }
    return { body: DEALS[1] }
  })
  const result = renderWithApp(<PipelinePage />, { data: [[['deals'], DEALS]] })
  return { calls, ...result }
}

const card = (id: number) => document.querySelector<HTMLElement>(`[data-deal-id="${id}"]`)!
const press = (key: string) => fireEvent.keyDown(document.activeElement!, { key })
const announced = () => screen.getByTestId('pipeline-announcements').textContent
const column = (stage: string) =>
  [...screen.getByRole('region', { name: stage }).querySelectorAll<HTMLElement>('[data-deal-id]')].map((el) => Number(el.dataset.dealId))

afterEach(() => vi.unstubAllGlobals())

describe('useKeyboardMove', () => {
  test('Space, the four arrows and Space again give the right moves, each one announced', async () => {
    const { calls } = renderBoard()
    card(2).focus()

    press(' ')
    await waitFor(() => expect(announced()).toBe('Picked up Bravo rollout, in New, position 2 of 3'))

    press('ArrowDown')
    await waitFor(() => expect(announced()).toBe('Moved to New, position 3 of 3'))
    expect(column('New')).toEqual([1, 3, 2])

    press('ArrowRight')
    await waitFor(() => expect(announced()).toBe('Moved to Qualified, position 3 of 3'))
    expect(column('Qualified')).toEqual([4, 5, 2])
    expect(column('New')).toEqual([1, 3])

    press('ArrowUp')
    await waitFor(() => expect(announced()).toBe('Moved to Qualified, position 2 of 3'))
    expect(column('Qualified')).toEqual([4, 2, 5])

    press('ArrowLeft')
    await waitFor(() => expect(announced()).toBe('Moved to New, position 2 of 3'))
    expect(column('New')).toEqual([1, 2, 3])

    press('ArrowRight')
    await waitFor(() => expect(announced()).toBe('Moved to Qualified, position 2 of 3'))
    expect(calls).toEqual([])

    press(' ')
    await waitFor(() => expect(announced()).toBe('Dropped in Qualified, position 2 of 3'))
    await waitFor(() => expect(calls[0]).toEqual({ method: 'POST', path: '/deals/2/move', body: { stage: 'qualified', index: 1 } }))
    await waitFor(() => expect(calls.filter((c) => c.method === 'GET').length).toBeGreaterThan(0))
  })

  test('the figures change when the card drops, not while it is moving', async () => {
    renderBoard()
    const heading = () => screen.getByRole('region', { name: 'Qualified' }).querySelector('p')!.textContent
    expect(heading()).toBe('$20,000')
    card(1).focus()
    press(' ')
    press('ArrowRight')
    await waitFor(() => expect(column('Qualified')).toContain(1))
    expect(heading()).toBe('$20,000')
    press(' ')
    await waitFor(() => expect(heading()).toBe('$30,000'))
  })

  test('Escape puts the card back', async () => {
    const { calls } = renderBoard()
    card(2).focus()
    press(' ')
    press('ArrowRight')
    await waitFor(() => expect(column('Qualified')).toContain(2))
    press('Escape')
    await waitFor(() => expect(announced()).toBe('Move cancelled. Bravo rollout is back in New, position 2 of 3'))
    expect(column('New')).toEqual([1, 2, 3])
    expect(column('Qualified')).toEqual([4, 5])
    expect(calls).toEqual([])
  })

  test('the card keeps focus after moving to another column', async () => {
    renderBoard()
    card(3).focus()
    press(' ')
    press('ArrowRight')
    await waitFor(() => expect(column('Qualified')).toContain(3))
    await waitFor(() => expect(document.activeElement).toBe(card(3)))
    press('ArrowLeft')
    await waitFor(() => expect(column('New')).toContain(3))
    await waitFor(() => expect(document.activeElement).toBe(card(3)))
  })

  test('once the mouse is used, focus is no longer pulled back to the card moved by keyboard', async () => {
    const { calls, client } = renderBoard()
    card(3).focus()
    press(' ')
    press('ArrowRight')
    press(' ')
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true))
    await waitFor(() => expect(calls.filter((c) => c.method === 'GET').length).toBeGreaterThan(0))
    // A mouse drag that remounts the card it moves (Yankee, to Proposal) leaves focus on the page.
    fireEvent.pointerDown(document.body)
    card(3).blur()
    act(() => client.setQueryData(['deals'], DEALS.map((d) => (d.id === 5 ? { ...d, stage: 'proposal' as const, position: 0 } : d))))
    await waitFor(() => expect(column('Proposal')).toEqual([5]))
    expect(document.activeElement).toBe(document.body)
  })

  test('the arrows do nothing until a card is picked up, and stop at the edges', async () => {
    renderBoard()
    card(1).focus()
    press('ArrowRight')
    expect(column('New')).toEqual([1, 2, 3])
    press(' ')
    press('ArrowUp')
    press('ArrowLeft')
    await waitFor(() => expect(announced()).toBe('Picked up Alpha pilot, in New, position 1 of 3'))
    expect(column('New')).toEqual([1, 2, 3])
  })
})
