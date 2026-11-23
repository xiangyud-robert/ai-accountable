import { useMutation } from '@tanstack/react-query'
import { notify } from '../../components/Toaster'
import { api } from '../../lib/api'
import type { Activity, ActivityType } from '../../lib/types'

export type ActivityValues = {
  type: ActivityType
  contact_id: number | null
  deal_id: number | null
  description: string
  occurred_at: string
  follow_up_date: string | null
  follow_up_done: boolean
}

export function useLogActivity() {
  return useMutation({
    mutationFn: (values: Partial<ActivityValues>) => api<Activity>('/activities', { method: 'POST', body: values }),
  })
}

export function useChangeActivity() {
  return useMutation({
    mutationFn: ({ id, values }: { id: number; values: Partial<ActivityValues>; message?: string }) =>
      api<Activity>(`/activities/${id}`, { method: 'PATCH', body: values }),
    // Here rather than in mutate(): a follow-up marked done leaves the dashboard's list, and
    // callbacks passed to mutate() don't run once their component has unmounted.
    onSuccess: (_activity, { message }) => message && notify.done(message),
  })
}

export function useDeleteActivity() {
  return useMutation({
    mutationFn: (id: number) => api<void>(`/activities/${id}`, { method: 'DELETE' }),
    // Here rather than in mutate(): the entry it came from is gone by the time this runs,
    // and callbacks passed to mutate() don't run once their component has unmounted.
    onSuccess: () => notify.done('Activity deleted'),
  })
}
