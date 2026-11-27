# Deals

Part of the spec. `docs/spec.md` has the summary of the whole product and the index of every area file, concern and rule.

## Concerns

5. **Six stages, five colors.** The brand gives five colors for things side by side, in order. In that order Won would be Raspberry, the alert color, so the stages are colored by meaning instead:
   - New: Cerulean
   - Qualified: Marigold
   - Proposal: Coral
   - Negotiation: Midnight, or Sea Mist in dark mode (concern 13)
   - Won: Sea Green
   - Lost: grey

   Raspberry stays free for late deals and overdue follow-ups.
6. **Each stage's usual probability:** New 10%, Qualified 25%, Proposal 50%, Negotiation 75%, Won 100% and Lost 0%. Won and Lost are fixed at 100% and 0%, because expected revenue only counts open deals; the probability can only be set by hand on an open deal.

## Stages

The six stages are fixed.

| Stage | Order | Open or closed | Usual probability | Color |
|---|---|---|---|---|
| New | 1 | Open | 10% | Cerulean |
| Qualified | 2 | Open | 25% | Marigold |
| Proposal | 3 | Open | 50% | Coral |
| Negotiation | 4 | Open | 75% | Midnight, or Sea Mist in dark mode |
| Won | 5 | Closed | 100% | Sea Green |
| Lost | 6 | Closed | 0% | Grey |

## Rules

- **R1.** A deal is open while it's in New, Qualified, Proposal or Negotiation. An open deal is late when its close date is before today.
- **R2.** A deal's expected revenue is its value times its probability. Every expected revenue total counts open deals only.
- **R3.** Every change of stage follows the same rules, whether it comes from dragging a card, the keyboard or the deal form:
  - It records a stage change, shown as "Moved from Proposal to Negotiation" in the deal's timeline, its main contact's timeline and the dashboard's recent activity.
  - The probability becomes the new stage's usual one, unless the same save sets it by hand.
  - Moving to Won or Lost sets the close date to today, unless the same save sets it by hand.
  - Moving to Won makes the main contact a customer if they aren't one already. That records a status change, shown as "Became a customer when Northwind analytics rollout was won".
- **R4.** A probability set by hand is kept until the stage changes. Won is always 100% and Lost always 0%.
- **R5.** Each deal has a place in its stage's column. A card dropped in a column stays exactly where it was dropped. Moving a card within its own column changes only its place, with no timeline entry. A new deal, or one whose stage is changed in the form, goes to the top of its column.
- **R6.** Adding a deal records its first stage, shown as "Added at Proposal". A deal added at Won or Lost follows R3's rules for that stage.

## Screen

**Deals** (`/deals`)

- Table columns: Name, Organization, Main contact, Stage, Value (USD), Probability, Expected (USD), Close date.
- Sorted by stage to begin with, in pipeline order, then by close date. Sorting by stage always uses pipeline order, never alphabetical order.
- A late deal shows a "Late" badge beside its close date.
- A deal's page (`/deals/:id`) shows its name, stage, the Late badge if it's late, its value, probability, expected revenue and close date, and its organization and main contact as links, with Edit and Delete, and who added it and last changed it (R17).
- The close date is labelled "Expected close" while the deal is open and "Closed" once it's won or lost.
- Its **timeline** (R10) has the Log activity form at the top.

## Form

- **Deal:** Name, Organization, Main contact (both pickers you can search), Stage, Value (USD), Probability (%) and Close date.
  - Choosing a main contact fills in the organization if it's empty.
  - Changing the stage fills in its usual probability. Choosing Won or Lost also fills in today as the close date. Either can be changed before saving.
  - Probability can't be edited for Won and Lost.
  - A new deal starts at New, or at its column's stage, with the stage's usual probability and a close date 30 days from today (today for Won and Lost).

## Data model

**deals**

| Column | Type | Rules |
|---|---|---|
| name | text | required, up to 160 characters |
| organization_id | integer, nullable | links to organizations; set to empty when the organization is deleted |
| contact_id | integer, nullable | the main contact; set to empty when the contact is deleted |
| stage | text | `new`, `qualified`, `proposal`, `negotiation`, `won` or `lost` |
| value | integer | required, $0 to $100,000,000 |
| probability | integer | 0 to 100; 100 for Won and 0 for Lost |
| close_date | date | required |
| position | integer | its place in its stage's column, 0 at the top |

**stage_changes**: one row each time a deal is added or changes stage. These feed the timelines, recent activity and the funnel.

| Column | Type | Rules |
|---|---|---|
| deal_id | integer | deleted with the deal |
| from_stage | text, nullable | empty when the deal was added |
| to_stage | text | |
| changed_at | datetime | |

## API

| Method and path | What it does |
|---|---|
| `GET /api/stages` | The six stages in order, with their usual probabilities |
| `GET /api/deals` | All deals in stage and position order, with organization and contact names, expected revenue, whether it's late, and activity count |
| `POST /api/deals` | Adds one at the top of its column (R5, R6) |
| `GET /api/deals/{id}` | One deal, with its timeline |
| `PATCH /api/deals/{id}` | Changes one (R3, R4) |
| `POST /api/deals/{id}/move` | Moves a card: `{ "stage": "proposal", "index": 2 }` puts it third in Proposal (R3, R5) |
| `DELETE /api/deals/{id}` | Deletes one (R11) |

If a deal's stage changes and the probability or close date isn't sent, R3 fills them in. If they are sent, they're used as given. The form sends them when they were edited or filled in on screen, so the result matches what the user saw before saving.
