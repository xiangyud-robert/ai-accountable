import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { FieldErrors, UNREACHABLE_MESSAGE } from './api'
import { notify } from '../components/Toaster'

/** '' becomes null, for optional fields the server keeps empty. */
export const orNull = (value: string) => (value.trim() === '' ? null : value.trim())

/** The fields whose values differ from what the form started with. */
export function changedOnly<T extends Record<string, unknown>>(values: T, initial: T): Partial<T> {
  return Object.fromEntries(Object.entries(values).filter(([key, value]) => value !== initial[key])) as Partial<T>
}

/** Shows the server's 422 messages under their fields, and moves focus to the first one in
 *  the form's order. Anything else becomes a message at the bottom right. */
export function showSaveError<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, order: Path<T>[]) {
  if (error instanceof FieldErrors) {
    const fields = order.filter((field) => error.errors[field])
    fields.forEach((field, i) => setError(field, { message: error.errors[field] }, { shouldFocus: i === 0 }))
    const others = Object.keys(error.errors).filter((field) => !order.includes(field as Path<T>))
    if (others.length) notify.failed(others.map((field) => error.errors[field]).join(' '))
    return
  }
  notify.failed(UNREACHABLE_MESSAGE)
}
