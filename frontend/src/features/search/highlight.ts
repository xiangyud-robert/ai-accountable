/** A name split around the part that matches the search, which shows in semibold. */
export type Highlighted = { before: string; match: string; after: string }

/**
 * Splits a name around the first place the search is found in it, ignoring case, or gives null.
 *
 * The backend found the name with Python's lower(), and this folds the case with the browser's
 * toLowerCase(). The two agree for nearly every letter. Where they don't, the search may not be
 * found here, and where folding changes the name's length, as "İ" does, the places in the
 * folded name no longer line up with the name. Either way the name shows without the semibold,
 * though the result was still found (risk 12).
 */
export function highlight(name: string, search: string): Highlighted | null {
  const query = search.trim().toLowerCase()
  const folded = name.toLowerCase()
  const at = query === '' ? -1 : folded.indexOf(query)
  if (at < 0 || folded.length !== name.length) return null
  const end = at + query.length
  return { before: name.slice(0, at), match: name.slice(at, end), after: name.slice(end) }
}
