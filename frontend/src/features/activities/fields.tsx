import type { ActivityType } from '../../lib/types'

export const ACTIVITY_TYPES: { value: ActivityType; label: string }[] = [
  { value: 'note', label: 'Note' },
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
]

/** The value for a datetime-local field: now, or a stored time, to the minute. */
export function localMinute(iso?: string): string {
  if (iso) return iso.slice(0, 16)
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}

/** A datetime-local value as the API's local ISO time. */
export const toApiTime = (value: string) => (value.length === 16 ? `${value}:00` : value)
