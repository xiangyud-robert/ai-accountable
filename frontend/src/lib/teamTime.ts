// The team's clock (concern 16). The whole team shares one time zone, which /api/me gives, so
// today and now come from it rather than from whatever zone this browser is set to.
//
// teamNow() is a Date whose local fields (getHours(), getDate() and so on) read the team's
// clock, so date-fns works with it unchanged. The API's times are already on the team's clock
// with no zone, and parseISO reads them into the same local fields, so they need no change.
// In the one hour a year that this browser's own zone skips, teamNow() can be an hour out.

let teamClock: Intl.DateTimeFormat | null = null

/** Sets the team's zone, such as "Europe/London", or null for this browser's own. */
export function setTeamZone(zone: string | null): void {
  teamClock = zone
    ? new Intl.DateTimeFormat('en-US', {
        timeZone: zone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hourCycle: 'h23',
      })
    : null
}

/** Now, with its local fields on the team's clock. */
export function teamNow(): Date {
  // The only place that reads the date and time from this browser's clock.
  const now = new Date()
  if (!teamClock) return now
  const field = Object.fromEntries(
    teamClock
      .formatToParts(now)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  )
  // Every zone's offset is a whole number of seconds, so the milliseconds are the same.
  return new Date(field.year, field.month - 1, field.day, field.hour, field.minute, field.second, now.getMilliseconds())
}

/** Today's date for the team, as YYYY-MM-DD. */
export function teamTodayISO(): string {
  const now = teamNow()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
