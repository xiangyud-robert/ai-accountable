# Activities and timelines

Part of the spec. `docs/spec.md` has the summary of the whole product and the index of every area file, concern and rule.

## Concerns

10. **Timelines follow a deal's current main contact.** A contact's timeline is worked out from the deals where they're the main contact now. If a deal's main contact changes, its activities and stage changes move to the new person's timeline. A deal with no main contact appears on nobody's.

## Rules

- **R8.** An activity belongs to exactly one contact or one deal: the one it was logged on. It has a type (note, call or email), a description, the date and time it happened (now by default, and never later than now), and optionally a follow-up date and whether that follow-up is done.
- **R9.** A follow-up shows on the dashboard while it's not done and its date is no later than 7 days from today. It's overdue when its date is before today. Marking it done, on the dashboard or in a timeline, takes it off the dashboard. It can be marked not done again from the timeline.
- **R10.** A deal's timeline shows its activities and its stage changes. A contact's timeline shows:
  - their own activities
  - the activities and stage changes of every deal where they're the main contact, each labelled with the deal's name
  - their status changes

  Timelines are newest first, by when each thing happened. At the same moment, a status change comes above the stage change that caused it, and a stage change above an activity. Stage and status entries can't be edited or deleted.

## Form

- **Activity:**
  - Logged from the form at the top of a contact's or deal's timeline: Type (Note, Call or Email), Description, When (date and time, now by default; left as it is, it's the time the activity is saved) and Follow-up date (optional).
  - After saving, the new entry appears at the top of the timeline and the form clears.
  - Editing an activity uses the same fields, plus Done when it has a follow-up.

## Timelines

Each **timeline** entry shows an icon for its kind, its text and when it happened.

- Activities also show their follow-up, such as "Follow up Nov 25", "Overdue since Nov 18" or "Done", with a Done checkbox. A menu on each activity has Edit and Delete.
- On a contact's timeline, entries from a deal say "On Northwind analytics rollout", with a link to the deal.

## Data model

**activities**

| Column | Type | Rules |
|---|---|---|
| type | text | `note`, `call` or `email` |
| contact_id | integer, nullable | deleted with the contact |
| deal_id | integer, nullable | deleted with the deal; exactly one of `contact_id` and `deal_id` is set |
| description | text | required, up to 5,000 characters |
| occurred_at | datetime | required, not later than now |
| follow_up_date | date, nullable | optional |
| follow_up_done | boolean | false by default |

## API

| Method and path | What it does |
|---|---|
| `POST /api/activities` | Logs one on a contact or a deal |
| `PATCH /api/activities/{id}` | Changes one, including marking its follow-up done |
| `DELETE /api/activities/{id}` | Deletes one |
