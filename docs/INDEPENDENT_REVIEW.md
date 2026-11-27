# Independent review: multi-user against main

Reviewed `main...HEAD`, from `a28ccdc2d4c64a4c35143290ee688fc969f04ca5` to `cfc904684303735523926eba869f1098788668d9`, against `docs/REVIEW.md`, the affected specs, `docs/changes/multi-user/plan.md`, and the substantive requirements in `docs/STANDARDS.md`. Style and naming are excluded.

**Four Important findings. These should be fixed before merging.**

## Important findings

### 1. Pending pipeline mutations restore record data after sign-out

**Locations:** `frontend/src/auth/session.ts:51–55`; `frontend/src/features/deals/queries.ts:60–65`.

`leave()` clears the query client, but an outstanding mutation continues and still runs its callbacks after the pipeline unmounts. If a move fails after sign-out, its `onError` writes `before`, the previous session's entire deals array, back into the shared query cache. That restores record data while signed out and makes it available to the next session before a fresh server response.

**Reproduced:** started a move with its response held, signed out, unmounted the move hook, and returned 401. The cache was empty immediately after sign-out; after the rejection, `getQueryData(['deals'])` contained the old deal again. This used the actual session, API, move hook, and installed query library.

This breaks the explicit sign-out requirement in `docs/specs/sign-in.md`: nothing from the session remains in memory, and the next person sees only newly fetched data. Guard mutation callbacks against an ended session, or isolate each session's query client so old callbacks cannot populate the active cache.

### 2. A delayed 401 from an old session signs out the new session

**Locations:** `frontend/src/lib/api.ts:62–66`; `frontend/src/auth/session.ts:24`.

Every 401 invokes the current session's refusal handler without checking which session sent the request. Clearing queries does not abort the underlying `fetch`, and the API's refusal side effect still runs when that request finishes. If several requests use an expired token, a slower refusal can arrive after the person has successfully signed in again and immediately discard the new session.

**Reproduced:** held Dana's request, signed out, signed in as Joel, then released the old request with 401. Joel's state changed from `signed-in` to `signed-out` with `ended: true`, and his newly saved token was removed.

This breaks the documented recovery after a session ends. Associate requests and refusals with a session generation, and ignore responses from superseded sessions.

### 3. Deleting a search match concurrently causes an unhandled 500

**Location:** `backend/services/search.py:35–39`.

Search reads names and ranks their IDs, then separately fetches the selected records' details. `_in_order()` assumes every ranked ID still exists and indexes `rows[row_id]` unconditionally. A teammate deleting a selected record between those reads leaves the ID absent and raises `KeyError`, failing the entire search.

**Reproduced:** used a temporary SQLite database and a second connection to delete Harbor Logistics immediately before the details query. The actual authenticated `GET /api/search?q=harbor` returned `500 Internal Server Error`. No application code was changed.

The new shared-team workflow permits these overlapping requests. Make the reads consistent, or tolerate records disappearing between them while keeping the returned results and totals coherent.

### 4. Search failures provide no error or recovery feedback

**Location:** `frontend/src/features/search/SearchBox.tsx:58–62`.

The component reads only `data` from `useSearch()` and ignores its error state. If the server becomes unavailable after the page loads, typing a search eventually leaves no results panel and no explanation. The API's documented 503 when Supabase's keys cannot be fetched follows the same path. A query over the API's 200-character limit also fails silently because the input has no corresponding limit or validation feedback.

**Reproduced:** rendered the actual search component, entered `har`, and returned 503. The query reached `error`, the combobox remained collapsed, and no error text appeared.

This contradicts the server-failure message required by `docs/specs/records.md` and `docs/specs/sign-in.md`. Render an accessible failure state and handle the search length limit explicitly.

## Validation and scope

- Separate passes covered bugs, security, agreement with the spec and plan, specification coverage, and substantive coding standards. No style nits are included.
- `npm run check` **passed every step**: 536 frontend unit tests, 409 backend tests, and 135 browser tests. Frontend statement coverage was 99.61%; backend coverage was 96.88%.
- The focused reproductions ran against repository code using temporary data and mocked response timing. They did not contact Supabase or change application source or tests.
- Real Supabase/Postgres and Render behavior was not exercised. The manual deployment checks remain listed as outstanding in `docs/STATUS.md`.
- Only this review document was edited.
