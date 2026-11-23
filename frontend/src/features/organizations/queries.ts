import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { OrganizationDetail, OrganizationRow } from '../../lib/types'

export type OrganizationValues = {
  name: string
  website: string | null
  industry: string | null
  notes: string | null
}

export function useOrganizations() {
  return useQuery({ queryKey: ['organizations'], queryFn: () => api<OrganizationRow[]>('/organizations') })
}

export function useOrganization(id: number, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['organizations', id],
    queryFn: () => api<OrganizationDetail>(`/organizations/${id}`),
    enabled,
  })
}

export function useSaveOrganization() {
  return useMutation({
    mutationFn: ({ id, values }: { id?: number; values: Partial<OrganizationValues> }) =>
      id
        ? api<OrganizationRow>(`/organizations/${id}`, { method: 'PATCH', body: values })
        : api<OrganizationRow>('/organizations', { method: 'POST', body: values }),
  })
}

export function useDeleteOrganization() {
  return useMutation({
    mutationFn: (id: number) => api<void>(`/organizations/${id}`, { method: 'DELETE' }),
  })
}
