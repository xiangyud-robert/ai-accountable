# Spec: the Accountable MVP

This spec turns `docs/intent.md` into requirements and a design that can be built and tested. The intent says what we're building and why. This file says how it behaves and how it looks. The look follows the brand skill (`.claude/skills/brand/SKILL.md`), and the stack follows `docs/TECH_STACK.md`.

## Concerns

These are the gaps and conflicts found while writing the spec, each with the choice made. All 12 choices were agreed as written on Nov 22, 2026.

1. **Google Fonts and working offline.** The brand's fonts come from Google Fonts, but the app has to work with no internet connection. The spec bundles the same three fonts into the app with the `@fontsource` npm packages, so nothing is loaded from Google.
2. **The first run needs the internet once.** Setting everything up on the first run means downloading the npm packages, the Python packages and, if it's missing, Python 3.12 itself (uv does this). After that, no connection is needed. The spec reads "needs no internet connection to use" as "after the first run".
3. **One command before anything is installed.** `npm run dev` normally needs `npm install` first. Here `npm run dev` runs a small Node script with no dependencies of its own. It checks the Node.js version and that uv is installed, and says what to do if either is missing. Then it installs what's missing, creates the database with sample data if there isn't one, starts both servers and prints the address to open in Chrome.
4. **The brand's colors and WCAG AA.** Small text needs a contrast of 4.5:1. Measured against white:
   - White text on Cerulean is 3.96:1 and on Raspberry 3.62:1, though the brand pairs them.
   - Sea Green, Marigold and Coral as text are 1.62 to 2.35:1, as the brand itself warns.
   - Midnight text on Sea Green, Marigold and Coral passes, at 5.1 to 7.5:1.

   Full-strength brand colors are kept for fills, dots, chart marks, and Sea Green buttons with Midnight text. Text and any fill behind white text use the darker shades listed under Colors. Badges use a pale tint of the color with Midnight text.
5. **Six stages, five colors.** The brand gives five colors for things side by side, in order. In that order Won would be Raspberry, the alert color. The spec colors the stages by meaning instead:
   - New: Cerulean
   - Qualified: Marigold
   - Proposal: Coral
   - Negotiation: Midnight
   - Won: Sea Green
   - Lost: grey

   Raspberry stays free for late deals and overdue follow-ups. The option not chosen was the brand's order for the four open stages (Sea Green, Marigold, Coral, Cerulean), with Won in Midnight and Lost in grey.
6. **Each stage's usual probability** isn't in the intent. The spec uses New 10%, Qualified 25%, Proposal 50%, Negotiation 75%, Won 100% and Lost 0%. Won and Lost are fixed at 100% and 0%, because expected revenue only counts open deals; the probability can only be set by hand on an open deal.
7. **What "how much value reaches each stage" means.** The funnel counts each deal in every stage up to the furthest one it has reached, using its stage history, so it narrows from New to Won. A deal dragged straight from New to Proposal counts in Qualified too. A lost deal counts up to the stage it was lost from, and a line under the funnel gives the total lost. The funnel covers every deal, with no date range, the same as the pipeline board.
8. **Moving a deal back out of Won or Lost.** The intent doesn't say what happens. The spec keeps the close date as it is, so the deal shows as late if that date has passed, which prompts a new expected date. It takes its new stage's usual probability, and its main contact stays a customer, as the intent says.
9. **Won and Lost column figures.** The intent says each column shows its own total value and expected revenue. For Won the expected revenue would equal the total, and for Lost it would always be $0, so those two columns show only their total value. The board's figures cover open deals only, as the intent says.
10. **Timelines follow a deal's current main contact.** A contact's timeline is worked out from the deals where they're the main contact now. If a deal's main contact changes, its activities and stage changes move to the new person's timeline. A deal with no main contact appears on nobody's.
11. **Money "always shown with its currency".** Everything is in US dollars, so amounts read `$12,500`, and table headings, chart axes and form fields that hold money say USD, such as "Value (USD)". In tight spaces, such as chart axes and dashboard tiles, amounts may be shortened to `$1.2M`, with the full amount shown on hover.
12. **Smaller choices:**
    - Every change of a contact's status appears in their timeline, whether made by hand or by a won deal. The intent only asks for the automatic one.
    - Adding a deal straight to Won or Lost counts as moving it there. Its close date defaults to today and, for Won, its main contact becomes a customer.
    - An activity's "when it happened" can't be later than now. Things still to do go in its follow-up date.
    - "Today" is the date on the computer running Accountable. "Due in the next 7 days" means today or any of the 7 days after it.
    - Organizations don't have a timeline, because activities belong to a contact or a deal. An organization's page shows its contacts and deals.

## Requirements

### Scope

Everything in `docs/intent.md` is in scope: five sections, four kinds of record, activities with follow-ups, stage-change entries, sample data, the reset command and keeping every change. The intent's "Not in the MVP" list stands as written.

### Stages

The six stages are fixed.

| Stage | Order | Open or closed | Usual probability | Color |
|---|---|---|---|---|
| New | 1 | Open | 10% | Cerulean |
| Qualified | 2 | Open | 25% | Marigold |
| Proposal | 3 | Open | 50% | Coral |
| Negotiation | 4 | Open | 75% | Midnight |
| Won | 5 | Closed | 100% | Sea Green |
| Lost | 6 | Closed | 0% | Grey |

### Rules

Each rule has a number so the tests can refer to it.

**Deals**

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

**Contacts**

- **R7.** A contact's status is lead, qualified or customer, and starts as lead. It can be changed by hand in any direction, and never goes back by itself. Every change records an entry such as "Status changed from Lead to Qualified".

**Activities**

- **R8.** An activity belongs to exactly one contact or one deal: the one it was logged on. It has a type (note, call or email), a description, the date and time it happened (now by default, and never later than now), and optionally a follow-up date and whether that follow-up is done.
- **R9.** A follow-up shows on the dashboard while it's not done and its date is no later than 7 days from today. It's overdue when its date is before today. Marking it done, on the dashboard or in a timeline, takes it off the dashboard. It can be marked not done again from the timeline.
- **R10.** A deal's timeline shows its activities and its stage changes. A contact's timeline shows:
  - their own activities
  - the activities and stage changes of every deal where they're the main contact, each labelled with the deal's name
  - their status changes

  Timelines are newest first, by when each thing happened. Stage and status entries can't be edited or deleted.

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
  - sorting by clicking a column's heading, once for ascending and again for descending, one column at a time, with an arrow showing the direction
  - an Add button that opens the form for a new record
  - Edit and Delete buttons on each row
  - the record's name as a link to its page
  - a count of the rows shown, such as "12 of 36 deals"

**Keeping changes**

- **R14.** Every change is saved to the database as soon as it's made. Nothing is kept only in the browser.

### Screens

**Dashboard** (`/`), the landing page. The figures are defined in the next section.

- Four tiles: revenue won this month, deals won this month, open pipeline, and expected revenue. The first two also give last month's figure.
- **Open pipeline by stage**: the visual of the pipeline. Each open stage shows its count, value and expected revenue.
- **Revenue won by month**: a line chart of the last 12 months.
- **Deals won by month**: a bar chart of the same months.
- **Sales funnel**: value and count reaching each stage from New to Won, with the share of New's value that reaches each stage, and the total lost underneath.
- **Follow-ups**: overdue first, then due in the next 7 days. Each shows its type, its description, the contact or deal it's on (as a link), its due date as "3 days overdue", "Due today", "Due tomorrow" or "Due in 4 days", and a Done checkbox. The heading gives the count. The list scrolls inside its panel when it's long.
- **Recent activity**: the 10 newest timeline entries of any kind, from anywhere in the app, each linking to its record.
- The tiles and the pipeline visual link to the Pipeline.

**Organizations** (`/organizations`)

- Table columns: Name, Industry, Website, Contacts, Open deals, Open value (USD). Sorted by name to begin with.
- An organization's page (`/organizations/:id`) shows its name, industry, website (opening in a new tab) and notes, with Edit and Delete.
- A **Contacts** panel lists its contacts, with an Add contact button that fills in the organization.
- A **Deals** panel lists its deals, with their total open value and total won value, and an Add deal button that fills in the organization.

**Contacts** (`/contacts`)

- Table columns: Name, Organization, Job title, Email, Phone, Status. Sorted by name to begin with.
- A status filter shows All, Leads, Qualified and Customers, each with its count. It works together with the search, and is kept in the address (`/contacts?status=lead`) so it survives a refresh.
- A contact's page (`/contacts/:id`) shows their name, status, job title, organization (as a link), email (as a mail link) and phone, with Edit and Delete.
- A **Deals** panel lists the deals where they're the main contact, with an Add deal button that fills in the contact and organization.
- Their **timeline** (R10) has the Log activity form at the top.

**Deals** (`/deals`)

- Table columns: Name, Organization, Main contact, Stage, Value (USD), Probability, Expected (USD), Close date.
- Sorted by stage to begin with, in pipeline order, then by close date. Sorting by stage always uses pipeline order, never alphabetical order.
- A late deal shows a "Late" badge beside its close date.
- A deal's page (`/deals/:id`) shows its name, stage, the Late badge if it's late, its value, probability, expected revenue and close date, and its organization and main contact as links, with Edit and Delete.
- The close date is labelled "Expected close" while the deal is open and "Closed" once it's won or lost.
- Its **timeline** (R10) has the Log activity form at the top.

**Pipeline** (`/pipeline`)

- The header shows the board's figures for open deals: count, total value and expected revenue, such as "19 open deals · $1,215,000 · $498,000 expected". It also has an Add deal button, for a new deal in New.
- There's one column for each of the six stages, in order. Each column heading shows:
  - the stage's name and color dot
  - its count and total value
  - its expected revenue, in open columns only
  - an Add deal button that starts the new deal at that stage
- A card shows the deal's name, organization, main contact, value, probability and close date, and a Late badge if it's late.
- Clicking a card, or pressing Enter on it, opens the deal's page.
- Dragging a card to another column or to another place follows R3 and R5. Every figure on the board changes as soon as the card is dropped, before the server replies. If the save fails, the card goes back to where it was and a message says so.

**Forms** open in a dialog. Every field has a visible label, and optional fields say "Optional".

- **Organization:** Name, Website, Industry (suggesting industries already used), Notes.
- **Contact:** Name, Email, Phone, Job title, Organization (a picker you can search), Status.
- **Deal:** Name, Organization, Main contact (both pickers you can search), Stage, Value (USD), Probability (%) and Close date.
  - Choosing a main contact fills in the organization if it's empty.
  - Changing the stage fills in its usual probability. Choosing Won or Lost also fills in today as the close date. Either can be changed before saving.
  - Probability can't be edited for Won and Lost.
  - A new deal starts at New, or at its column's stage, with the stage's usual probability and a close date 30 days from today (today for Won and Lost).
- **Activity:**
  - Logged from the form at the top of a contact's or deal's timeline: Type (Note, Call or Email), Description, When (date and time, now by default) and Follow-up date (optional).
  - After saving, the new entry appears at the top of the timeline and the form clears.
  - Editing an activity uses the same fields, plus Done when it has a follow-up.

Each **timeline** entry shows an icon for its kind, its text and when it happened.

- Activities also show their follow-up, such as "Follow up Nov 25", "Overdue since Nov 18" or "Done", with a Done checkbox. A menu on each activity has Edit and Delete.
- On a contact's timeline, entries from a deal say "On Northwind analytics rollout", with a link to the deal.

The delete questions read, for example:

- "Delete Harbor Logistics? Its 3 contacts and 2 deals will be kept, with no organization."
- "Delete Priya Raman? Their 2 deals will be kept, with no main contact. The 5 activities logged on this contact will be deleted."
- "Delete Northwind analytics rollout? The 4 activities logged on this deal and its stage history will be deleted."
- "Delete this call?"

A sentence about linked records is left out when its count is zero.

**Messages.** A short message confirms each save and delete, such as "Deal saved". If the server can't be reached, the page says "Can't reach Accountable's server. Check that it's running, then refresh." A record that no longer exists shows "This deal no longer exists", with a link back to the list. An unknown address shows "Page not found", with a link to the dashboard.

### Dashboard figures

Months are calendar months on the computer's own clock. "Won in a month" means a Won deal whose close date falls in that month.

| Figure | How it's worked out |
|---|---|
| Revenue won this month | Total value of the deals won this month. Last month's total is shown beneath. |
| Deals won this month | Count of the deals won this month. Last month's count is shown beneath. |
| Open pipeline | Count and total value of open deals. |
| Expected revenue | Total of value times probability over open deals (R2). |
| Open pipeline by stage | For each open stage: count, total value and expected revenue. |
| Revenue won by month | Total value won in each of the last 12 months, this one included. Months with nothing won show $0. |
| Deals won by month | Count of deals won in each of the same 12 months. |
| Sales funnel | For each stage from New to Won: the count and total value of deals that have reached it (concern 7). Underneath: the count and total value of lost deals. |
| Follow-ups | R9, overdue first, oldest first, then the rest, soonest first. |
| Recent activity | The 10 newest activities, stage changes and status changes, by when they happened. |

### Sample data

The sample data is for a business that sells software and services to other businesses: licenses, implementation projects, integrations, training and support renewals. Deal names pair the customer with the work, such as "Harbor Logistics fleet analytics" or "Brightline Retail POS integration".

- **Organizations:** about 15, across industries such as software, healthcare, manufacturing, retail, logistics, financial services, education and professional services. One or two have no deals yet.
- **Contacts:** about 40, at every status: about 16 leads, 10 qualified and 14 customers. Every main contact of a won deal is a customer. Two contacts have no organization.
- **Deals:** about 35, worth $5,000 to $150,000 in steps of $500:
  - about 5 each in New, Qualified and Proposal, and 4 in Negotiation, with 3 of the open deals late
  - about 10 won, spread over the past 12 months, so the monthly charts have shape
  - about 6 lost, lost from different stages
- **Stage history:** each deal has a history that fits its stage, spread over the weeks before its close date.
- **Status history:** each contact who became a customer has a status change on the date of their first won deal.
- **Activities:** about 100 over the past 12 months, more of them recent, mixing notes, calls and emails, logged on both contacts and deals. About 20 have follow-ups: about 5 overdue, 6 due in the next 7 days, 3 later, and 6 done.
- **Same every time:** the records and their order are the same every time the sample data is loaded. Only the dates move, because they're counted back and forward from the day it's loaded.

### Running it

- **Before you start:** Node.js 24 or later (26 recommended), uv and Google Chrome. `docs/STATUS.md` says how to install them on Mac, Linux and Windows.
- **`npm run dev`** starts Accountable. On the first run it checks Node.js and uv, installs the npm and Python packages, and creates the database with the sample data. Then it starts the backend and frontend and prints "Accountable is running at http://localhost:5173. Open it in Google Chrome." Ctrl+C stops both.
- **`npm run seed`** replaces all the data with fresh sample data, dated from today, and prints what it created. If the app is running, refresh the browser to see the new data.
- **`npm test`** runs every test against a database of its own.
- **The data** lives in `data/accountable.db`, which git ignores. Deleting that file also resets to the sample data on the next start.

### Quality

- **Browser:** the current Google Chrome on Mac, Linux and Windows. Other browsers aren't checked.
- **Screen:** designed for 1440 by 900, and works from 1280 by 720 upwards.
- **Speed:** with 500 of each kind of record, every screen shows its data within a second on a typical laptop, the search keeps up with typing, and a dragged card follows the pointer smoothly.
- **Console:** no errors or warnings in Chrome's console during normal use.
- **Local only:** the servers listen on this computer (127.0.0.1) only, not on the network.
- **Keyboard and contrast:** as described under Keyboard and accessibility.

## Design

### How it fits together

- **`frontend/`:** a React, Vite and TypeScript app. Its dev server forwards `/api` to the backend, so the browser talks to one address.
- **`backend/`:** a FastAPI app, organized by kind of record, with the business rules (R1 to R11) in one service layer. Dragging a card, saving the form and adding a deal all go through the same code. Each user action runs in a single database transaction, so a move to Won changes the deal, its stage history, its main contact and their status history together or not at all.
- **The database:** one SQLite file, defined with SQLAlchemy Core tables. The tables are created when the app starts if they don't exist yet, and the sample data is loaded if the database is new. Migrations can wait for the move to Supabase.
- **SQLite details:** every connection turns on foreign keys (`PRAGMA foreign_keys = ON`), or SQLite silently ignores the delete rules. The database uses WAL mode, so the seed command can run while the app is open.
- **Who decides:** the backend decides what's late, overdue and due soon, and works out every dashboard figure. The pipeline recalculates its own totals as soon as a card moves, using R1 and R2, and then refreshes from the server.

### Libraries

Popular, well-supported libraries, as `docs/TECH_STACK.md` asks:

| Need | Library |
|---|---|
| Pages and addresses | React Router |
| Loading and caching data, instant card moves | TanStack Query |
| Sorting and searching tables | TanStack Table |
| Pipeline drag and drop, with keyboard support | dnd-kit (`@dnd-kit/core`, `@dnd-kit/sortable`) |
| Charts | Recharts |
| Dialogs, menus, selects, checkboxes, tooltips | Radix UI primitives |
| Pickers you can search | cmdk |
| Forms and field checks | React Hook Form with Zod |
| Styling, with the brand as theme tokens | Tailwind CSS |
| Icons | lucide-react |
| Messages | sonner |
| Dates | date-fns |
| Fonts, served from the app | `@fontsource/instrument-sans`, `@fontsource/instrument-serif`, `@fontsource/jetbrains-mono` |
| API | FastAPI, Pydantic, Uvicorn |
| Database | SQLAlchemy Core |
| Tests | Vitest with React Testing Library, pytest with FastAPI's test client, Playwright Test using Chrome |

### Data model

Dates are stored as `YYYY-MM-DD`, and times as ISO 8601 in local time. Money is stored in whole US dollars. Every table has `id` (an integer primary key), and the four kinds of record also have `created_at` and `updated_at`, set by the server.

**organizations**

| Column | Type | Rules |
|---|---|---|
| name | text | required, up to 120 characters |
| website | text | optional; `https://` is added if no scheme is given |
| industry | text | optional |
| notes | text | optional, up to 5,000 characters |

**contacts**

| Column | Type | Rules |
|---|---|---|
| name | text | required, up to 120 characters |
| email | text | optional, must look like an email address |
| phone | text | optional |
| job_title | text | optional |
| organization_id | integer, nullable | links to organizations; set to empty when the organization is deleted |
| status | text | `lead`, `qualified` or `customer`; `lead` by default |

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

**stage_changes**: one row each time a deal is added or changes stage. These feed the timelines, recent activity and the funnel.

| Column | Type | Rules |
|---|---|---|
| deal_id | integer | deleted with the deal |
| from_stage | text, nullable | empty when the deal was added |
| to_stage | text | |
| changed_at | datetime | |

**status_changes**: one row each time a contact's status changes.

| Column | Type | Rules |
|---|---|---|
| contact_id | integer | deleted with the contact |
| from_status, to_status | text | |
| won_deal_id | integer, nullable | the deal whose win caused it; set to empty when that deal is deleted |
| changed_at | datetime | |

Indexes cover every link column, `deals (stage, position)` and `activities (follow_up_date)`.

### API

JSON under `/api`, with snake_case names. A failed field check returns 422 with a message for each field, which the form shows under that field. A missing record returns 404.

| Method and path | What it does |
|---|---|
| `GET /api/stages` | The six stages in order, with their usual probabilities |
| `GET /api/organizations` | All organizations, with contact count, open deal count, open value and deal count |
| `POST /api/organizations` | Adds one |
| `GET /api/organizations/{id}` | One organization, with its contacts and deals |
| `PATCH /api/organizations/{id}` | Changes one |
| `DELETE /api/organizations/{id}` | Deletes one (R11) |
| `GET /api/contacts` | All contacts, with organization name, deal count and activity count |
| `POST /api/contacts` | Adds one |
| `GET /api/contacts/{id}` | One contact, with their organization, their deals and their timeline |
| `PATCH /api/contacts/{id}` | Changes one, recording a status change if the status changed |
| `DELETE /api/contacts/{id}` | Deletes one (R11) |
| `GET /api/deals` | All deals in stage and position order, with organization and contact names, expected revenue, whether it's late, and activity count |
| `POST /api/deals` | Adds one at the top of its column (R5, R6) |
| `GET /api/deals/{id}` | One deal, with its timeline |
| `PATCH /api/deals/{id}` | Changes one (R3, R4) |
| `POST /api/deals/{id}/move` | Moves a card: `{ "stage": "proposal", "index": 2 }` puts it third in Proposal (R3, R5) |
| `DELETE /api/deals/{id}` | Deletes one (R11) |
| `POST /api/activities` | Logs one on a contact or a deal |
| `PATCH /api/activities/{id}` | Changes one, including marking its follow-up done |
| `DELETE /api/activities/{id}` | Deletes one |
| `GET /api/dashboard` | Every dashboard figure, the follow-ups and recent activity |

`PATCH` sends only the fields that changed. If the stage changes and the probability or close date isn't sent, R3 fills them in. If they are sent, they're used as given. The form sends them when they were edited or filled in on screen, so the result matches what the user saw before saving.

### Look and feel

**Fonts.** Instrument Sans for headings and body. JetBrains Mono, with tabular figures, for money, counts, percentages and dates in tables, cards, tiles and charts. Instrument Serif appears at most once per screen, as an accent: the tagline under the logo ("Every deal, accounted for") and the date at the top of the dashboard.

| Use | Font | Size and weight |
|---|---|---|
| Page title | Instrument Sans | 28px, 600 |
| Panel title | Instrument Sans | 16px, 600 |
| Body and table cells | Instrument Sans | 14px, 400 |
| Labels and table headings | Instrument Sans | 13px, 500 |
| Small print | Instrument Sans | 12px, 400 |
| Tile figures | JetBrains Mono | 30px, 500 |
| Figures in tables and cards | JetBrains Mono | 13px, 400 |
| Accent | Instrument Serif | 20px, 400 |

**Colors.** Each contrast ratio is measured against white, and against the page background where text sits on it.

| Name | Value | Use |
|---|---|---|
| Sea Green | `#06D6A0` | Primary buttons (Midnight text, 6.4:1), Won, won charts, the active page in the sidebar |
| Sea Green text | `#037558` | Sea Green as text (5.7:1 on white, 5.1:1 on the page) |
| Marigold | `#FFC145` | Qualified |
| Marigold text | `#8C5E00` | Marigold as text (5.7:1, 5.1:1) |
| Coral | `#F78C6B` | Proposal |
| Coral text | `#C1350A` | Coral as text (5.6:1, 5.0:1) |
| Cerulean | `#118AB2` | New, the focus ring (4.0:1 against white, above the 3:1 needed) |
| Cerulean text | `#0E7191` | Links (5.5:1, 5.0:1) |
| Cerulean fill | `#0F789B` | Fills behind white text (5.0:1) |
| Raspberry | `#EF476F` | Dots and marks for late deals, overdue follow-ups and errors |
| Raspberry text | `#CD123F` | Late dates, overdue labels and error messages (5.6:1, 5.1:1) |
| Raspberry fill | `#D91342` | Delete buttons, with white text (5.1:1) |
| Midnight | `#073B4C` | Main text (12.1:1, 10.9:1), Negotiation |
| Slate | `#4F6873` | Secondary text, from Midnight (5.9:1, 5.3:1) |
| Grey | `#8FA3A9` | Lost; never for text |
| Field outline | `#7A9097` | The outline of inputs and selects (3.4:1) |
| Sea Mist | `#CDD8DB` | Text on Midnight, if the sidebar is Midnight (8.3:1) |
| Divider | `#E3EAEC` | Lines between table rows, chart gridlines |
| Page | `#F0F4F5` | Page background |
| Panel | `#FFFFFF` | Panels, cards and dialogs |

Badge backgrounds are a 16% tint of each color on white, with Midnight text (9 to 11:1): Sea Green `#D7F8F0`, Marigold `#FFF5E1`, Coral `#FEEDE7`, Cerulean `#D9ECF3`, Raspberry `#FCE2E8`, Midnight `#D7E0E2` and grey `#EDF0F1`.

Statuses use colors too: lead Cerulean, qualified Marigold and customer Sea Green.

**Surfaces and shape.**

- **Panels:** white, rounded (16px), with no outline and a soft shadow: `0 1px 2px rgba(7, 59, 76, 0.06), 0 8px 24px rgba(7, 59, 76, 0.06)`.
- **Cards** are rounded 12px, and **buttons and inputs** 10px.
- **Edges:** no border on one edge of anything, and no line across the top of the page or under the page header. A stage or status shows as a dot or a badge, never as a colored stripe down the side of a card.
- **Fills** are flat. There are no gradients. The line chart's area uses a flat tint.
- **Spacing** is on a 4px grid. Panels have 20 to 24px of padding, and the gap between panels is 20px.

**Components.**

- **Buttons** are 36px high, in 14px semibold:
  - Primary: Sea Green with Midnight text.
  - Secondary: a Midnight tint with Midnight text.
  - Delete: Raspberry fill with white text.
  - Icon buttons are 32px square, with a label for screen readers and a tooltip.
- **Inputs:** white, with a full 1px outline in the field outline color. They're 36px high, with the label above and any error message below in Raspberry text.
- **Badges:** pill-shaped and 22px high, with a tint background, Midnight 12px medium text and an 8px dot in the full color.
- **Tables** sit inside a panel.
  - The headings are Slate text with no fill, and rows are 44px high with a divider between them.
  - A row is lightly tinted on hover.
  - Figures are right-aligned in JetBrains Mono.
  - Edit and Delete are always visible, not only on hover.
- **Pipeline cards:** white with the panel shadow and 12px padding. The deal name is 14px semibold, and the organization and contact are in Slate.
  - Value, probability and close date are in JetBrains Mono, with a Late badge if needed.
  - A card being dragged gets a deeper shadow, and the place it will land shows as a tinted space.
- **Dialogs:** white and 520px wide, over Midnight at 40%.
- **Messages:** white panels at the bottom right. Errors have a Raspberry dot.

**Charts**, with Recharts:

- **Colors by meaning:** "won" figures are Sea Green, and anything by stage uses the stage colors.
- **Revenue won by month:** a 2.5px Sea Green line over a flat 12% Sea Green area, with points shown on hover. Month labels run along the bottom and short USD amounts up the side, with horizontal gridlines only.
- **Deals won by month:** Sea Green bars with rounded tops and the count above each bar.
- **Sales funnel:** one horizontal bar per stage from New to Won, each in its stage's color, its length set by value. Each bar is labelled with its stage, count, value and share of New's value, and a line underneath gives the total lost.
- **Open pipeline by stage:** one bar per open stage, its length set by total value. The expected part is filled in the stage's full color and the rest in its tint, labelled with value and expected revenue.
- **Tooltips:** white panels with full USD amounts in JetBrains Mono.
- **Text and alternatives:** every chart has a title and a one-line summary in words, such as "$612,000 won in the last 12 months", plus a table of its figures for screen readers. Several brand colors are below 3:1 against white, so every figure is also given in text, never by color alone.

**Words and formats.** Plain business English, short labels, no jargon and no exclamation marks.

- **Buttons** say what they do: "Add deal", "Log activity", "Save", "Delete organization", "Cancel".
- **Money:** `$12,500`, with USD in headings (concern 11). `$1.2M` and `$48K` only in tight spaces, with the full amount on hover.
- **Dates:** `Nov 22, 2026`. In timelines, "Today, 2:30 PM", "Yesterday, 9:05 AM" or "Nov 12, 2:30 PM", with the year added when it isn't this year.
- **Percentages:** `50%`.
- **Empty states:** one plain line and an Add button, such as "No organizations yet." Searches with no results say "No deals match "acme"."

### Layout

- **Sidebar:** 232px wide on the left. It holds the wordmark "Accountable" with its tagline, then the five sections, each with an icon. The current section is a Sea Green tint pill with Midnight text. The sidebar is either white or Midnight with Sea Mist text, and the mockups try both.
- **Main area:** on the page background, with 32px of padding and content up to 1440px wide.
- **Page header:** the title on the left, with the main action on the right, such as "Add deal".
- **Dashboard,** to start with, on a 12-column grid (the three mockups try other arrangements):
  1. The title "Dashboard", with today's date as the accent.
  2. Four tiles, three columns each.
  3. Open pipeline by stage, full width, as one bar split into the four open stages by value, with each stage's count, value and expected revenue underneath.
  4. Revenue won by month (8 columns) beside Follow-ups (4 columns).
  5. Deals won by month, Sales funnel and Recent activity, 4 columns each.
- **Pipeline:**
  - The six columns share the width equally, each at least 200px wide. Below that, the board scrolls sideways.
  - Each column fills the height of the window and scrolls on its own, with its heading staying in place.
  - Columns sit on the page background with no panel, so the white cards stand out.
- **Record pages:**
  - The details are on the left (4 columns), with the linked contacts and deals beneath them.
  - The timeline is on the right (8 columns).
  - An organization's page puts the contacts and deals side by side, since it has no timeline.

### Keyboard and accessibility

- **Tab order:** everything can be reached with Tab, in reading order. Everything that can be focused shows a 2px Cerulean focus ring, 2px outside its edge.
- **Structure:** a "Skip to content" link comes first. Each page has one main heading and labelled navigation and main areas.
- **Tables:** these are real HTML tables. Each sortable heading is a button and announces its sort order. On each row, the name link and the Edit and Delete buttons can be reached with Tab.
- **Forms:** every field has a visible label. Errors are linked to their field, and saving with errors moves focus to the first one.
- **Dialogs** keep focus inside them, close with Escape, and return focus to the button that opened them.
- **Pipeline,** with dnd-kit's keyboard support:
  - Tab reaches each card.
  - Space picks a card up, Up and Down move it within the column, and Left and Right move it to the next column, keeping its position where possible.
  - Space drops it, and Escape puts it back where it was.
  - Enter opens the deal when no card is being moved.
  - A screen reader announces each step, such as "Picked up Harbor Logistics fleet analytics, in Proposal, position 2 of 5", and "Dropped in Negotiation, position 1 of 4".
- **Not by color alone:** stage, status, late and overdue are always written in words as well as shown in color.
- **Motion:** animations are turned off for anyone whose system asks for reduced motion.

### Testing hooks

- `ACCOUNTABLE_DB` sets the database file, so the tests use their own.
- `ACCOUNTABLE_TODAY` fixes the date the backend treats as today, so the tests for late deals, follow-ups and months always give the same results. The end-to-end tests set Chrome's clock to the same date, since the pipeline works out late cards in the browser too.
- The sample data generator takes today's date as an input, for the same reason.
