# Working with records

Part of the spec. `docs/spec.md` has the summary of the whole product and the index of every area file, concern and rule.

What every kind of record shares. Each record's own screen, form, data and API are in its area file.

## Concerns

11. **Money is always shown with its currency.** Everything is in US dollars, so amounts read `$12,500`, and table headings, chart axes and form fields that hold money say USD, such as "Value (USD)". In tight spaces, such as chart axes and dashboard tiles, amounts may be shortened to `$1.2M`, with the full amount shown on hover.
12. **Smaller choices:**
    - Every change of a contact's status appears in their timeline, whether made by hand or by a won deal.
    - Adding a deal straight to Won or Lost counts as moving it there. Its close date defaults to today and, for Won, its main contact becomes a customer.
    - An activity's "when it happened" can't be later than now. Things still to do go in its follow-up date.
    - "Today" is the date in the team's time zone (concern 16), in the backend and the browser alike, whatever either computer's clock is set to. "Due in the next 7 days" means today or any of the 7 days after it.
    - Organizations don't have a timeline, because activities belong to a contact or a deal. An organization's page shows its contacts and deals.

## Rules

**Deleting**

- **R11.** Every delete asks first, and the question says what will happen to the linked records, with counts. Cancel is the default button.
  - Deleting an organization keeps its contacts and deals, now with no organization.
  - Deleting a contact keeps their deals, now with no main contact. The activities logged on the contact and their status changes are deleted. Activities logged on their deals stay with the deals.
  - Deleting a deal deletes the activities logged on it and its stage changes. A status change it caused stays on the contact's timeline, without the deal's name.
  - Deleting an activity deletes only that activity.
- **R12.** Deleting a record from its own page goes back to its list.

**Tables**

- **R13.** Every table has:
  - a search box that filters the rows as you type, matching any part of the text in any column, ignoring case
  - sorting by clicking a column's heading, once for ascending and again for descending, one column at a time, with an arrow showing the direction, and empty values last both ways
  - an Add button that opens the form for a new record
  - Edit and Delete buttons on each row
  - the record's name as a link to its page
  - a count of the rows shown, such as "12 of 36 deals"

**Keeping changes**

- **R14.** Every change to a record is saved to the database as soon as it's made, so it's still there after a refresh and every time the app starts, and everyone on the team sees it on their next load. No record or change to one is kept only in the browser. The browser keeps only two things: the theme choice (concern 14) and the sign-in session (`docs/specs/sign-in.md`).

**Who added and changed it**

- **R17.** Every organization, contact, deal and activity records who added it and who last changed it, with when. The backend sets both from the signed-in person's token (R15), never from the request.
  - Adding a record sets both to the person adding it.
  - A change sets who last changed it to the person making it. A change is any save of the record's own fields, a change of a deal's stage however it's made, marking a follow-up done or not done, and a won deal making its main contact a customer, which counts as a change to the contact by whoever moved the deal.
  - Moving a card within its own column, other cards' places shifting, and links emptied by a delete (R11) don't count as changes.
  - Records from before sign-in, in a local database made by an earlier version, have no one recorded, and show no "Added by" line. One changed since shows only "Last changed by".

## Forms

**Forms** open in a dialog. Every field has a visible label, and optional fields say "Optional".

## Delete questions

The delete questions read, for example:

- "Delete Harbor Logistics? Its 3 contacts and 2 deals will be kept, with no organization."
- "Delete Priya Raman? Their 2 deals will be kept, with no main contact. The 5 activities logged on this contact will be deleted."
- "Delete Northwind analytics rollout? The 4 activities logged on this deal and its stage history will be deleted."
- "Delete this call?"

A sentence about linked records is left out when its count is zero.

## Messages

A short message confirms each save, delete and pipeline move, such as "Deal saved" or "Deal moved". The sign-in screen's own messages are in `docs/specs/sign-in.md`. If the server can't be reached, the page says "Can't reach Accountable's server. Check that it's running, then refresh." A record that no longer exists shows "This deal no longer exists", with a link back to the list. An unknown address shows "Page not found", with a link to the dashboard.

## Layout

- **Record pages:**
  - The details are on the left (4 columns), with the linked contacts and deals beneath them.
  - The details end with who added the record and when, and who last changed it and when (R17), in small print in Slate: "Added by Dana Holt on Nov 12, 2026" and "Last changed by Joel Abara on Nov 20, 2026". The second line is left out until the record has been changed, which shows as a change time or a person different from when it was added.
  - The timeline is on the right (8 columns).
  - An organization's page puts the contacts and deals side by side, since it has no timeline.
