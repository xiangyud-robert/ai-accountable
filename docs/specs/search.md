# Search

Part of the spec. `docs/spec.md` has the summary of the whole product and the index of every area file, concern and rule.

The search box in the top bar finds any organization, contact or deal from any page. Each table also has its own search box, which filters its rows (R13 in `docs/specs/records.md`).

## Concerns

21. **Ignoring case the same way on SQLite and Postgres.** SQLite's own case folding covers only A to Z, so on SQLite "émile" wouldn't find "Émile", though on Postgres it would. The backend folds the case of the names and of the search itself, the same way for both databases, rather than leaving it to the database. Accents still count: "Emile" doesn't find "Émile". A `%` or `_` in the search matches only itself.

## Rules

- **R18.** The search finds the organizations, contacts and deals whose name contains what was typed, anywhere in the name, ignoring case (concern 21) and any spaces before or after it. It gives up to 5 of each kind: names that start with the search first, then the rest, each in alphabetical order, ignoring case. Names that sort the same are in the order they were added.

## The search box

- It's at the left of the top bar on every page, with a search icon and the placeholder "Search organizations, contacts and deals".
- Results show as you type, from the first character, in a list that opens below the box. Only spaces shows no list. The search is sent once typing pauses for 150ms, so a word sends one request, and the last results stay showing while the next ones load.
- The list has up to three groups, Organizations, Contacts and Deals, in that order, leaving out a kind with no results. A group with more than 5 results says so in its heading, such as "Deals, 5 of 12".
- Each result shows its kind's icon, the same as in the sidebar, its name with the matching part in semibold, and a second line in small print, which leaves out anything the record doesn't have, such as a contact with no job title:
  - an organization: its industry
  - a contact: their job title and organization, such as "Finance Director, Harbor Logistics"
  - a deal: its organization, stage and value, such as "Harbor Logistics, Proposal, $48,000"
- With no results, the list holds only "No organizations, contacts or deals match "acme"."
- Choosing a result opens its page, then clears the box and closes the list. Focus stays in the box.
- Clicking anywhere else closes the list and keeps what was typed. Coming back to the box opens it again.

## Components

- **Search box:** an input 400px wide and 36px high, with the search icon inside on the left in Slate, and a small "/" key on the right in Slate, as a hint, while the box is empty.
- **Results list:** 480px wide, 4px below the box and lined up with its left edge, on the raised surface with the deeper shadow, rounded like a card. It's at most the window's height less 88px, and scrolls inside. Group headings are labels in Slate. Each result is 48px high. The highlighted one has the same light tint as a table row on hover, and the 2px Cerulean focus ring, as a picker's options do, since focus stays in the box.

## Keyboard and accessibility

- **/** puts focus in the search box from anywhere, without typing itself there, unless focus is already in a field: a text box, a text area, a select or a picker. With Ctrl, Cmd or Alt held, it's left to the browser.
- The search area is a search landmark labelled "Search". The box is labelled "Search" for screen readers, and the list "Search results". The number of results shown is announced, such as "8 results", or "No results". With no results there's no list, only the message.
- Up and Down move the highlight through the results, across the groups. The first result is highlighted as the list opens, and again when new results come in.
- Enter opens the highlighted result.
- Home and End move the cursor in the box, not the highlight.
- Escape closes the list and clears the box. Pressing it again in the empty box leaves focus where it is.
- Tab leaves the box for the initials button and closes the list.

## API

| Method and path | What it does |
|---|---|
| `GET /api/search?q=har` | Up to 5 organizations, contacts and deals whose names contain `q` (R18), each with what its second line shows, and the total for each kind. `q` is up to 200 characters, counted before the spaces around it are taken off, and more is a 422 with "Keep this to 200 characters or fewer." No `q`, or an empty one or only spaces, gives every total 0 and no results. Every kind is always in the reply, and a second line's field the record doesn't have is empty. |

## Speed

With 500 of each kind of record, the results show within half a second of the last key pressed.
