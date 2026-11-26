import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, test, vi } from 'vitest'
import { Field, Picker, SelectField, TextArea, TextInput, described } from './fields'

describe('Field', () => {
  test('labels its control, and can say the field is optional', () => {
    render(
      <>
        <Field id="name" label="Name">
          <TextInput {...described('name')} />
        </Field>
        <Field id="notes" label="Notes" optional>
          <TextArea {...described('notes')} />
        </Field>
      </>,
    )
    const name = screen.getByLabelText('Name')
    expect(name).not.toHaveAttribute('aria-invalid')
    expect(name).not.toHaveAccessibleDescription()
    expect(screen.getByLabelText('Notes Optional')).toBeInstanceOf(HTMLTextAreaElement)
  })

  test('an error shows under the field, and is read out with it', () => {
    render(
      <Field id="email" label="Email" error="Enter a valid email">
        <TextInput {...described('email', 'Enter a valid email')} defaultValue="priya@" />
      </Field>,
    )
    const email = screen.getByRole('textbox', { name: 'Email' })
    expect(email).toHaveAttribute('aria-invalid', 'true')
    expect(email).toHaveAccessibleDescription('Enter a valid email')
  })
})

const STAGE_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'won', label: 'Won' },
]

/** A stage select inside its field, keeping its own value as a form would. */
function StageSelect(props: { onChange?: (value: string) => void; disabled?: boolean; error?: string }) {
  const [stage, setStage] = useState('new')
  return (
    <Field id="stage" label="Stage" error={props.error}>
      <SelectField
        id="stage"
        value={stage}
        onChange={(value) => {
          setStage(value)
          props.onChange?.(value)
        }}
        options={STAGE_OPTIONS}
        disabled={props.disabled}
        invalid={!!props.error}
        describedBy={props.error ? 'stage-error' : undefined}
      />
    </Field>
  )
}

describe('SelectField', () => {
  test('shows its value, and choosing an option changes it', async () => {
    const onChange = vi.fn()
    render(<StageSelect onChange={onChange} />)
    const select = screen.getByRole('combobox', { name: 'Stage' })
    expect(select).toHaveTextContent('New')
    await userEvent.click(select)
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['New', 'Proposal', 'Won'])
    await userEvent.click(screen.getByRole('option', { name: 'Proposal' }))
    expect(onChange).toHaveBeenCalledExactlyOnceWith('proposal')
    expect(select).toHaveTextContent('Proposal')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  test('a disabled select can’t be opened', async () => {
    render(<StageSelect disabled />)
    const select = screen.getByRole('combobox', { name: 'Stage' })
    expect(select).toBeDisabled()
    await userEvent.click(select)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  test('an error is linked to it', () => {
    render(<StageSelect error="Choose a stage" />)
    const select = screen.getByRole('combobox', { name: 'Stage' })
    expect(select).toHaveAttribute('aria-invalid', 'true')
    expect(select).toHaveAccessibleDescription('Choose a stage')
  })
})

const ORGANIZATIONS = [
  { value: 1, label: 'Harbor Logistics', hint: 'Boston' },
  { value: 2, label: 'Cobalt Bank', hint: 'Denver' },
  { value: 3, label: 'Meridian Health' },
]

/** An organization picker inside its field, keeping its own value as a form would. */
function OrganizationPicker(props: {
  start?: number | null
  onChange?: (value: number | null) => void
  error?: string
}) {
  const [organization, setOrganization] = useState(props.start ?? null)
  return (
    <Field id="organization" label="Organization" error={props.error}>
      <Picker
        id="organization"
        value={organization}
        onChange={(value) => {
          setOrganization(value)
          props.onChange?.(value)
        }}
        options={ORGANIZATIONS}
        placeholder="Choose an organization"
        noneLabel="No organization"
        invalid={!!props.error}
        describedBy={props.error ? 'organization-error' : undefined}
      />
    </Field>
  )
}

const picker = () => screen.getByRole('combobox', { name: 'Organization' })
const choices = () => screen.queryAllByRole('option').map((option) => option.textContent)

async function openPicker() {
  await userEvent.click(picker())
  return screen.getByRole('dialog', { name: 'Choose an organization' })
}

describe('Picker', () => {
  test('shows the placeholder until something is chosen, and the choice after', async () => {
    const onChange = vi.fn()
    render(<OrganizationPicker onChange={onChange} />)
    expect(picker()).toHaveTextContent('Choose an organization')
    expect(picker()).toHaveAttribute('aria-expanded', 'false')

    const popup = await openPicker()
    expect(picker()).toHaveAttribute('aria-expanded', 'true')
    expect(picker()).toHaveAttribute('aria-controls', popup.id)
    expect(choices()).toEqual(['No organization', 'Harbor LogisticsBoston', 'Cobalt BankDenver', 'Meridian Health'])
    await userEvent.click(screen.getByRole('option', { name: /^Cobalt Bank/ }))

    expect(onChange).toHaveBeenCalledExactlyOnceWith(2)
    expect(picker()).toHaveTextContent('Cobalt Bank')
    expect(picker()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('the search matches names and hints, ignoring case', async () => {
    render(<OrganizationPicker />)
    const popup = await openPicker()
    const search = within(popup).getByRole('combobox', { name: 'Choose an organization' })
    expect(search).toHaveFocus()
    await userEvent.type(search, 'HEALTH')
    expect(choices()).toEqual(['Meridian Health'])
    await userEvent.clear(search)
    await userEvent.type(search, 'denv')
    expect(choices()).toEqual(['Cobalt BankDenver'])
    await userEvent.clear(search)
    await userEvent.type(search, 'no org')
    expect(choices()).toEqual(['No organization'])
  })

  test('says when nothing matches', async () => {
    render(<OrganizationPicker />)
    const popup = await openPicker()
    await userEvent.type(within(popup).getByRole('combobox'), 'Atlas')
    expect(choices()).toEqual([])
    expect(within(popup).getByText('No matches.')).toBeInTheDocument()
  })

  test('Enter chooses the first match', async () => {
    const onChange = vi.fn()
    render(<OrganizationPicker onChange={onChange} />)
    const popup = await openPicker()
    await userEvent.type(within(popup).getByRole('combobox'), 'harbor{Enter}')
    expect(onChange).toHaveBeenCalledExactlyOnceWith(1)
    expect(picker()).toHaveTextContent('Harbor Logistics')
  })

  test('choosing none clears it', async () => {
    const onChange = vi.fn()
    render(<OrganizationPicker start={1} onChange={onChange} />)
    expect(picker()).toHaveTextContent('Harbor Logistics')
    await openPicker()
    await userEvent.click(screen.getByRole('option', { name: 'No organization' }))
    expect(onChange).toHaveBeenCalledExactlyOnceWith(null)
    expect(picker()).toHaveTextContent('Choose an organization')
  })

  test('Escape closes it without changing anything', async () => {
    const onChange = vi.fn()
    render(<OrganizationPicker start={3} onChange={onChange} />)
    await openPicker()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(picker()).toHaveTextContent('Meridian Health')
    expect(onChange).not.toHaveBeenCalled()
  })

  test('an error is linked to it', () => {
    render(<OrganizationPicker error="That organization no longer exists" />)
    expect(picker()).toHaveAttribute('aria-invalid', 'true')
    expect(picker()).toHaveAccessibleDescription('That organization no longer exists')
  })
})
