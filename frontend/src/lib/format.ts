// Money, dates and labels, in the spec's formats. Dates are only ever parsed with
// parseISO, which reads a plain YYYY-MM-DD as the start of a local day, never as UTC.

import { addDays, differenceInCalendarDays, format, isSameYear, parseISO } from 'date-fns'

const dollars = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
})

/** $12,500 */
export function money(amount: number): string {
  return dollars.format(Math.round(amount))
}

const trim = (text: string) => text.replace(/\.0$/, '')

/** $1.2M, $48K, $47.5K, $0: for tight spaces, with the full amount shown on hover. */
export function shortMoney(amount: number): string {
  const n = Math.round(amount)
  const thousands = n / 1_000
  const roundedThousands = Number(thousands.toFixed(n >= 100_000 ? 0 : 1))
  if (n >= 1_000_000 || roundedThousands >= 1_000) {
    const millions = n / 1_000_000
    return `$${trim(millions.toFixed(millions >= 10 ? 0 : 1))}M`
  }
  if (n >= 1_000) return `$${trim(roundedThousands.toFixed(n >= 100_000 ? 0 : 1))}K`
  return `$${n}`
}

export function percent(n: number): string {
  return `${Math.round(n)}%`
}

/** Today's date on this computer, as YYYY-MM-DD. */
export function todayISO(now: Date = new Date()): string {
  return format(now, 'yyyy-MM-dd')
}

export function addDaysISO(iso: string, days: number): string {
  return format(addDays(parseISO(iso), days), 'yyyy-MM-dd')
}

/** Nov 22, 2026 */
export function longDate(iso: string): string {
  return format(parseISO(iso), 'MMM d, yyyy')
}

/** Nov 22 this year, and Feb 12, 2027 otherwise. */
export function shortDate(iso: string, now: Date = new Date()): string {
  const date = parseISO(iso)
  return format(date, isSameYear(date, now) ? 'MMM d' : 'MMM d, yyyy')
}

/** "Today, 2:30 PM", "Yesterday, 9:05 AM", "Nov 12, 2:30 PM", or "Nov 12, 2025, 2:30 PM". */
export function timelineTime(iso: string, now: Date = new Date()): string {
  const at = parseISO(iso)
  const time = format(at, 'h:mm a')
  const days = differenceInCalendarDays(now, at)
  if (days === 0) return `Today, ${time}`
  if (days === 1) return `Yesterday, ${time}`
  return `${shortDate(iso, now)}, ${time}`
}

/** Just the time, for entries already grouped under Today or Yesterday. */
export function clockTime(iso: string): string {
  return format(parseISO(iso), 'h:mm a')
}

/** "3 days overdue", "Due today", "Due tomorrow", "Due in 4 days", from days until it's due. */
export function dueLabel(days: number): string {
  if (days < 0) return `${-days} ${days === -1 ? 'day' : 'days'} overdue`
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  return `Due in ${days} days`
}

/** "Follow up Nov 25", "Overdue since Nov 18" or "Done", for an activity in a timeline.
 *  Whether it's overdue is the backend's call, as the server sends it. */
export function followUpLabel(iso: string, done: boolean, overdue: boolean, now: Date = new Date()): string {
  if (done) return 'Done'
  if (overdue) return `Overdue since ${shortDate(iso, now)}`
  return `Follow up ${shortDate(iso, now)}`
}

/** Days from today until a date, so negative when it's past. */
export function daysFromToday(iso: string, now: Date = new Date()): number {
  return differenceInCalendarDays(parseISO(iso), now)
}

/** "Jun" for 2026-06. */
export function monthShort(month: string): string {
  return format(parseISO(`${month}-01`), 'MMM')
}

/** "June 2026" for 2026-06. */
export function monthLong(month: string): string {
  return format(parseISO(`${month}-01`), 'MMMM yyyy')
}

/** "Sunday, November 22", for the dashboard's dateline. */
export function dateline(iso: string): string {
  return format(parseISO(iso), 'EEEE, MMMM d')
}

/** The month's name, for "Revenue won in November". */
export function monthName(iso: string): string {
  return format(parseISO(iso), 'MMMM')
}

/** Up to two initials: "Priya Raman" is PR. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

/** "1 deal", "3 deals" */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}
