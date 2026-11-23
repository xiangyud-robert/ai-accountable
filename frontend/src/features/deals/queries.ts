import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notify } from '../../components/Toaster'
import { api } from '../../lib/api'
import { todayISO } from '../../lib/format'
import type { DealDetail, DealRow, Stage, StageKey } from '../../lib/types'
import { moveDeal } from '../pipeline/board'

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
 * the cards go back and a message says so. Either way, everything is refetched after.
 */
export function useMoveDeal() {
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: ({ id, stage, index }: Move & { before: DealRow[] }) =>
      api<DealRow>(`/deals/${id}/move`, { method: 'POST', body: { stage, index } }),
    onError: (_error, { before }) => {
      client.setQueryData(DEALS_KEY, before)
      notify.failed("Couldn't save the move, so the card is back where it was.")
    },
    onSettled: () => client.invalidateQueries(),
  })

  return (move: Move) => {
    const before = client.getQueryData<DealRow[]>(DEALS_KEY)
    const stages = client.getQueryData<Stage[]>(['stages'])
    if (!before || !stages) return
    // A refetch still on its way would bring back the old places, so it's dropped.
    void client.cancelQueries({ queryKey: DEALS_KEY, exact: true }, { revert: false })
    client.setQueryData(DEALS_KEY, moveDeal(before, stages, move.id, move.stage, move.index, todayISO()))
    mutation.mutate({ ...move, before })
  }
}
