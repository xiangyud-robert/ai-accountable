import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notify } from '../../components/Toaster'
import { api } from '../../lib/api'
import { teamTodayISO } from '../../lib/teamTime'
import type { DealDetail, DealRow, Stage, StageKey } from '../../lib/types'
import { moveDeal, putBack } from '../pipeline/board'

export type DealValues = {
  name: string
  organization_id: number | null
  contact_id: number | null
  stage: StageKey
  value: number
  probability: number
  close_date: string
}

export const DEALS_KEY = ['deals']

export function useDeals() {
  return useQuery({ queryKey: DEALS_KEY, queryFn: () => api<DealRow[]>('/deals') })
}

export function useDeal(id: number, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['deals', id],
    queryFn: () => api<DealDetail>(`/deals/${id}`),
    enabled,
  })
}

export function useSaveDeal() {
  return useMutation({
    mutationFn: ({ id, values }: { id?: number; values: Partial<DealValues> }) =>
      id
        ? api<DealRow>(`/deals/${id}`, { method: 'PATCH', body: values })
        : api<DealRow>('/deals', { method: 'POST', body: values }),
  })
}

export function useDeleteDeal() {
  return useMutation({
    mutationFn: (id: number) => api<void>(`/deals/${id}`, { method: 'DELETE' }),
  })
}

type Move = { id: number; stage: StageKey; index: number }

/**
 * Moves a card at once, then saves it (R5). The cached deals change before the request is
 * sent, so every figure on the board changes as soon as the card drops. If the save fails,
 * the card goes back and a message says so. Either way, everything is refetched after.
 */
export function useMoveDeal() {
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: ({ id, stage, index }: Move & { before: DealRow[]; stages: Stage[] }) =>
      api<DealRow>(`/deals/${id}/move`, { method: 'POST', body: { stage, index } }),
    onSuccess: () => notify.done('Deal moved'),
    onError: (_error, { id, before, stages }) => {
      // Only this card goes back, so a card moved since stays where it was dropped.
      client.setQueryData<DealRow[]>(DEALS_KEY, (now) => putBack(now ?? before, before, stages, id, teamTodayISO()))
      notify.failed("Couldn't save the move, so the card is back where it was.")
    },
    onSettled: () => client.invalidateQueries(),
  })

  return (move: Move) => {
    const before = client.getQueryData<DealRow[]>(DEALS_KEY)
    const stages = client.getQueryData<Stage[]>(['stages'])
    if (!before || !stages) return
    // A refetch still on its way would bring back the old places, so it's cancelled. That
    // puts back the data it started from (the default, revert), which the move then changes.
    // Without revert, the cancelled refetch would count as a failed one, and the board would
    // be replaced by the "Can't reach" message.
    void client.cancelQueries({ queryKey: DEALS_KEY, exact: true })
    client.setQueryData(DEALS_KEY, moveDeal(before, stages, move.id, move.stage, move.index, teamTodayISO()))
    mutation.mutate({ ...move, before, stages })
  }
}
