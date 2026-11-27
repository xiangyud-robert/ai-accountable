import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { setTeamZone } from '../lib/teamTime'

/** The signed-in person (R16), and the team's time zone, or null for this browser's own. */
export type Me = { id: string; name: string; email: string; initials: string; timezone: string | null }

async function fetchMe() {
  const me = await api<Me>('/me')
  // Before anything draws with it, so every date the app works out is the team's (concern 16).
  setTeamZone(me.timezone)
  return me
}

export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: fetchMe, staleTime: Infinity })
}
