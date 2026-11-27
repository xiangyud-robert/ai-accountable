import type { StageKey } from '../../lib/types'

/** One kind of record in a search's reply: up to 5 results, and how many matched in all. */
export type Found<T> = { total: number; results: T[] }

// Each result has what its second line shows, any of which a record may not have.
export type OrganizationFound = { id: number; name: string; industry: string | null }
export type ContactFound = { id: number; name: string; job_title: string | null; organization_name: string | null }
export type DealFound = { id: number; name: string; organization_name: string | null; stage: StageKey; value: number }

/** GET /api/search's reply (R18). */
export type SearchReply = {
  organizations: Found<OrganizationFound>
  contacts: Found<ContactFound>
  deals: Found<DealFound>
}

/** A reply with the search it answers, which the semibold and the no-results message use. */
export type SearchResults = SearchReply & { query: string }
