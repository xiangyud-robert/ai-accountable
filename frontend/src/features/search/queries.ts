import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { Found, SearchReply, SearchResults } from './types'

/** How long typing pauses before the search is sent, so a word sends one request rather than
 *  one for each letter. */
export const SETTLE_MS = 150

const NONE: Found<never> = { total: 0, results: [] }

/** What an empty search finds, without asking the server. */
const NO_SEARCH: SearchResults = { query: '', organizations: NONE, contacts: NONE, deals: NONE }

/** The top bar's search for what's typed, ignoring spaces before and after it (R18). */
export function useSearch(text: string) {
  const query = useSettled(text.trim())
  return useQuery({
    queryKey: ['search', query],
    queryFn: async (): Promise<SearchResults> => ({
      query,
      ...(await api<SearchReply>(`/search?q=${encodeURIComponent(query)}`)),
    }),
    enabled: query !== '',
    // The empty search has results of its own, so once the box is emptied, the next search
    // doesn't show the one before it while it loads.
    initialData: query === '' ? NO_SEARCH : undefined,
    // Each search has its own key, so a late reply to an older search can't replace a newer
    // one, and the last results stay showing while the next ones load.
    placeholderData: keepPreviousData,
  })
}

/** The search once typing has paused for SETTLE_MS, or at once when the box is emptied. */
function useSettled(query: string) {
  const [settled, setSettled] = useState(query)
  if (query === '' && settled !== '') setSettled('')
  useEffect(() => {
    if (query === '') return
    const timer = setTimeout(() => setSettled(query), SETTLE_MS)
    return () => clearTimeout(timer)
  }, [query])
  return settled
}
