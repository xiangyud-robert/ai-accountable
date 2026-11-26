import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm } from 'react-hook-form'
import { describe, expect, test } from 'vitest'
import { Toaster } from '../components/Toaster'
import { Field, TextInput, described } from '../components/fields'
import { FieldErrors, UNREACHABLE_MESSAGE, Unreachable } from './api'
import { changedOnly, orNull, showSaveError } from './forms'

describe('orNull', () => {
  test('an empty or blank field is sent as null, and anything else trimmed', () => {
    expect(orNull('')).toBeNull()
    expect(orNull('   ')).toBeNull()
    expect(orNull('  Logistics ')).toBe('Logistics')
  })
})

describe('changedOnly', () => {
  test('keeps only the fields that differ from where the form started', () => {
    const initial: Record<string, string | null> = { name: 'Harbor Logistics', industry: 'Logistics', website: null }
    expect(changedOnly({ ...initial, industry: 'Shipping' }, initial)).toEqual({ industry: 'Shipping' })
    expect(changedOnly({ ...initial, website: 'https://harbor.com' }, initial)).toEqual({
      website: 'https://harbor.com',
    })
    expect(changedOnly(initial, initial)).toEqual({})
  })
})

type Values = { name: string; email: string }

/** A two-field form whose save fails with `error`, as a real form would show it. */
function ContactFields({ error }: { error: unknown }) {
  const {
    register,
    setError,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ defaultValues: { name: 'Priya Raman', email: '' } })
  return (
    <form noValidate onSubmit={handleSubmit(() => showSaveError(error, setError, ['name', 'email']))}>
      <Field id="name" label="Name" error={errors.name?.message}>
        <TextInput {...described('name', errors.name?.message)} {...register('name')} />
      </Field>
      <Field id="email" label="Email" error={errors.email?.message}>
        <TextInput {...described('email', errors.email?.message)} {...register('email')} />
      </Field>
      <button type="submit">Save</button>
    </form>
  )
}

/** What the messages at the bottom right say. */
const messages = () =>
  within(screen.getByRole('region', { name: /^Notifications/ }))
    .queryAllByRole('listitem')
    .map((item) => item.textContent)

function renderForm(error: unknown) {
  render(<Toaster />)
  render(<ContactFields error={error} />)
  return userEvent.click(screen.getByRole('button', { name: 'Save' }))
}

describe('showSaveError', () => {
  test('shows the server’s messages under their fields, and focuses the first in the form’s order', async () => {
    // The server lists email first, but name comes first in the form.
    await renderForm(new FieldErrors({ email: 'Enter a valid email', name: 'Enter a name' }))
    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription('Enter a name')
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter a valid email')
    expect(screen.getByLabelText('Name')).toHaveFocus()
    expect(messages()).toEqual([])
  })

  test('a message for a field the form doesn’t have shows at the bottom right', async () => {
    await renderForm(
      new FieldErrors({ email: 'Enter a valid email', organization_id: 'That organization no longer exists' }),
    )
    await waitFor(() => expect(messages()).toEqual(['That organization no longer exists']))
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter a valid email')
    expect(screen.getByLabelText('Email')).toHaveFocus()
    expect(screen.getByLabelText('Name')).not.toHaveAccessibleDescription()
  })

  test('any other failure says the server can’t be reached', async () => {
    await renderForm(new Unreachable(UNREACHABLE_MESSAGE))
    await waitFor(() => expect(messages()).toEqual([UNREACHABLE_MESSAGE]))
    expect(screen.getByLabelText('Name')).not.toHaveAttribute('aria-invalid')
    expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid')
  })
})
