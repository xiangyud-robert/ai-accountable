import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import type { Stage, StageKey, Status } from './types'

/** The six stages, from the server. Names, order and probabilities live only there. */
export function useStages() {
  return useQuery({
    queryKey: ['stages'],
    queryFn: () => api<Stage[]>('/stages'),
    staleTime: Infinity,
  })
}

// Each stage and status has a color role and a tint in theme.css.
export const stageColor = (key: StageKey) => `var(--color-stage-${key})`
export const stageTint = (key: StageKey) => `var(--color-stage-${key}-tint)`
export const statusColor = (status: Status) => `var(--color-status-${status})`
export const statusTint = (status: Status) => `var(--color-status-${status}-tint)`

export const STATUSES: { key: Status; name: string; plural: string }[] = [
  { key: 'lead', name: 'Lead', plural: 'Leads' },
  { key: 'qualified', name: 'Qualified', plural: 'Qualified' },
  { key: 'customer', name: 'Customer', plural: 'Customers' },
]

export const statusName = (status: Status) => STATUSES.find((s) => s.key === status)?.name ?? status
