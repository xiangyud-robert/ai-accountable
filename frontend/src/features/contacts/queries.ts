import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { ContactDetail, ContactRow, Status } from '../../lib/types'

export type ContactValues = {
  name: string
  email: string | null
  phone: string | null
  job_title: string | null
  organization_id: number | null
  status: Status
}

export function useContacts() {
  return useQuery({ queryKey: ['contacts'], queryFn: () => api<ContactRow[]>('/contacts') })
}

export function useContact(id: number, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['contacts', id],
    queryFn: () => api<ContactDetail>(`/contacts/${id}`),
    enabled,
  })
}

export function useSaveContact() {
  return useMutation({
    mutationFn: ({ id, values }: { id?: number; values: Partial<ContactValues> }) =>
      id
        ? api<ContactRow>(`/contacts/${id}`, { method: 'PATCH', body: values })
        : api<ContactRow>('/contacts', { method: 'POST', body: values }),
  })
}

export function useDeleteContact() {
  return useMutation({
    mutationFn: (id: number) => api<void>(`/contacts/${id}`, { method: 'DELETE' }),
  })
}
