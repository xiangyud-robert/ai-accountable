import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { addDaysISO, todayISO } from '../../lib/format'
import { contactRow, dealRow, mockFetch, organizationRow, renderWithApp } from '../../test-utils'
import { DealForm } from './DealForm'

const ORGANIZATIONS = [organizationRow(), organizationRow({ id: 2, name: 'Cobalt Bank' })]
const CONTACTS = [
  contactRow(),
  contactRow({ id: 11, name: 'Daniel Okafor', organization_id: 2, organization_name: 'Cobalt Bank' }),
  contactRow({ id: 12, name: 'Mei Chen', organization_id: null, organization_name: null }),
]

// At a probability of its own, not its stage's usual one.
const DEAL = dealRow({ probability: 65 })

function renderForm(props: Partial<Parameters<typeof DealForm>[0]> = {}) {
  const onOpenChange = vi.fn()
  renderWithApp(<DealForm open onOpenChange={onOpenChange} {...props} />, {
    data: [
      [['organizations'], ORGANIZATIONS],
      [['contacts'], CONTACTS],
    ],
  })
  return { onOpenChange }
}

async function chooseStage(name: string) {
  await userEvent.click(screen.getByLabelText('Stage'))
  await userEvent.click(await screen.findByRole('option', { name }))
}

async function pick(label: string, option: string) {
  await userEvent.click(screen.getByLabelText(new RegExp(`^${label}`)))
  await userEvent.click(await screen.findByRole('option', { name: new RegExp(`^${option}`) }))
}

describe('DealForm', () => {
  test('a new deal starts at New, with its usual probability, closing in 30 days', () => {
    renderForm()
    expect(screen.getByLabelText('Stage')).toHaveTextContent('New')
    expect(screen.getByLabelText('Probability (%)')).toHaveValue('10')
    expect(screen.getByLabelText('Close date')).toHaveValue(addDaysISO(todayISO(), 30))
  })

  test('a new deal from a column starts at its stage', () => {
    renderForm({ defaults: { stage: 'negotiation' } })
    expect(screen.getByLabelText('Stage')).toHaveTextContent('Negotiation')
    expect(screen.getByLabelText('Probability (%)')).toHaveValue('75')
  })

  test('a new deal from the Won column closes today, at a probability that can’t be edited', () => {
    renderForm({ defaults: { stage: 'won' } })
    expect(screen.getByLabelText('Stage')).toHaveTextContent('Won')
    expect(screen.getByLabelText('Probability (%)')).toHaveValue('100')
    expect(screen.getByLabelText('Probability (%)')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('Close date')).toHaveValue(todayISO())
  })

  test('a new deal from a record page starts with its organization and main contact', () => {
    renderForm({ defaults: { organization_id: 2, contact_id: 11 } })
    expect(screen.getByLabelText(/^Organization/)).toHaveTextContent('Cobalt Bank')
    expect(screen.getByLabelText(/^Main contact/)).toHaveTextContent('Daniel Okafor')
  })

  test('a closed form shows nothing', () => {
    renderForm({ open: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('changing the stage fills in its usual probability', async () => {
    renderForm()
    await chooseStage('Proposal')
    expect(screen.getByLabelText('Probability (%)')).toHaveValue('50')
    expect(screen.getByLabelText('Probability (%)')).not.toHaveAttribute('readonly')
  })

  test('Won or Lost fills in today and locks the probability', async () => {
    renderForm({ deal: DEAL })
    await chooseStage('Won')
    expect(screen.getByLabelText('Probability (%)')).toHaveValue('100')
    expect(screen.getByLabelText('Probability (%)')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('Close date')).toHaveValue(todayISO())
    await chooseStage('Lost')
    expect(screen.getByLabelText('Probability (%)')).toHaveValue('0')
  })

  test('choosing a main contact fills in an empty organization', async () => {
    renderForm()
    await pick('Main contact', 'Daniel Okafor')
    expect(screen.getByLabelText(/^Organization/)).toHaveTextContent('Cobalt Bank')
  })

  test('choosing a main contact leaves a chosen organization alone', async () => {
    renderForm()
    await pick('Organization', 'Harbor Logistics')
    await pick('Main contact', 'Daniel Okafor')
    expect(screen.getByLabelText(/^Organization/)).toHaveTextContent('Harbor Logistics')
  })

  test('choosing a main contact with no organization leaves the organization empty', async () => {
    renderForm()
    await pick('Main contact', 'Mei Chen')
    expect(screen.getByLabelText(/^Main contact/)).toHaveTextContent('Mei Chen')
    expect(screen.getByLabelText(/^Organization/)).toHaveTextContent('Choose an organization')
  })

  test('only changed fields are sent', async () => {
    const calls = mockFetch(() => ({ body: DEAL }))
    const { onOpenChange } = renderForm({ deal: DEAL })
    const name = screen.getByLabelText('Name')
    await userEvent.clear(name)
    await userEvent.type(name, 'Harbor Logistics fleet analytics phase 2')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(calls).toEqual([
      { method: 'PATCH', path: '/deals/7', body: { name: 'Harbor Logistics fleet analytics phase 2' } },
    ])
  })

  test('a new stage sends what the form filled in with it', async () => {
    const calls = mockFetch(() => ({ body: DEAL }))
    renderForm({ deal: DEAL })
    await chooseStage('Won')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].body).toEqual({ stage: 'won', probability: 100, close_date: todayISO() })
  })

  test('a new stage sends the probability and close date shown, even when they match the deal’s own', async () => {
    const calls = mockFetch(() => ({ body: DEAL }))
    renderForm({ deal: DEAL })
    await chooseStage('Negotiation')
    const probability = screen.getByLabelText('Probability (%)')
    expect(probability).toHaveValue('75')
    await userEvent.clear(probability)
    await userEvent.type(probability, '65')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].body).toEqual({ stage: 'negotiation', probability: 65, close_date: '2026-12-11' })
  })

  test('a new deal sends every field', async () => {
    const calls = mockFetch(() => ({ status: 201, body: DEAL }))
    renderForm()
    await userEvent.type(screen.getByLabelText('Name'), 'Cobalt Bank pilot')
    await userEvent.type(screen.getByLabelText('Value (USD)'), '$12,500')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0]).toEqual({
      method: 'POST',
      path: '/deals',
      body: {
        name: 'Cobalt Bank pilot',
        organization_id: null,
        contact_id: null,
        stage: 'new',
        value: 12500,
        probability: 10,
        close_date: addDaysISO(todayISO(), 30),
      },
    })
  })

  test('empty required fields are caught before sending, and focus moves to the first', async () => {
    const calls = mockFetch()
    renderForm()
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Enter a name.')).toBeInTheDocument()
    expect(screen.getByText('Enter a value from $0 to $100,000,000.')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveFocus()
    expect(calls).toEqual([])
  })

  test('the server’s 422 messages appear under their fields', async () => {
    mockFetch(() => ({ status: 422, body: { errors: { value: 'Enter a value from $0 to $100,000,000.' } } }))
    renderForm({ deal: DEAL })
    const value = screen.getByLabelText('Value (USD)')
    await userEvent.clear(value)
    await userEvent.type(value, '999999999')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Enter a value from $0 to $100,000,000.')).toBeInTheDocument()
    expect(value).toHaveAttribute('aria-invalid', 'true')
    expect(value).toHaveAccessibleDescription('Enter a value from $0 to $100,000,000.')
    expect(value).toHaveFocus()
  })

  test.each([
    ['Organization', 'organization_id', 'Cobalt Bank', 'That organization no longer exists.'],
    ['Main contact', 'contact_id', 'Daniel Okafor', 'That contact no longer exists.'],
  ])('the server’s message about the %s appears under its picker', async (label, field, option, message) => {
    const calls = mockFetch(() => ({ status: 422, body: { errors: { [field]: message } } }))
    const { onOpenChange } = renderForm({ deal: DEAL })
    await pick(label, option)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    const picker = screen.getByLabelText(new RegExp(`^${label}`))
    await waitFor(() => expect(picker).toHaveAttribute('aria-invalid', 'true'))
    expect(screen.getByText(message)).toBeInTheDocument()
    expect(picker).toHaveAccessibleDescription(message)
    expect(picker).toHaveFocus()
    expect(calls).toHaveLength(1)
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})
