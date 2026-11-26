# Spec: Accountable

This file describes Accountable as it stands today: what it's for, how it behaves and how it looks. It covers the whole product, and every change updates it, so it always describes the product as it is. The look follows the brand skill (`.claude/skills/brand/SKILL.md`), and the stack follows `docs/TECH_STACK.md`.

## The problem

A small business keeps track of its customers and sales in spreadsheets, inboxes and people's heads. Nobody can see at a glance which companies we deal with, who our contacts are, what's in the sales pipeline, what happened last with a customer or what needs doing next.

## The product

Accountable is a business management system: a sales CRM that will grow into a full Business OS, including ERP. Today it's a complete sales CRM for one person, running on their own computer. Think of it as a private Salesforce that does the everyday CRM essentials really well. It should feel sharp, modern and professional, and be a pleasure to use.

- **Who uses it:** one salesperson, on their own computer, every day. They sell software and services to small and mid-sized companies, with deals from about $5,000 to $150,000 that take weeks to months to close. No other systems are involved.
- **Five sections:** the Dashboard, Organizations, Contacts, Deals and the Pipeline (see Screens).
- **Four kinds of record:** organizations, contacts, deals and activities (see Data model). Activities can have follow-ups, and each deal's stages and each contact's statuses keep a history.
- **Sample data** fills every screen the first time it starts, and one command resets to it.
- **Every change is kept,** through a refresh and a restart.
- **Light and dark mode,** with a switch at the bottom of the sidebar. Light is the default, and the choice is remembered.

**Not in Accountable yet:**

- sign-in, user accounts, several people sharing the same data, and a record of who did what
- use from anywhere but the computer it runs on
- a layout for phones
- following the computer's own light or dark setting
- AI features
- email, calendar or phone integrations
- currencies other than US dollars
- reports beyond the dashboard
- tags or custom fields
- changing the pipeline stages
- importing or exporting data
- staying quick with thousands of records, and browsers other than Chrome

## Concerns

Choices about behavior that the rules below don't make obvious, each with its reason. The code and tests refer to them by number, such as "concern 7".

1. **Fonts that work offline.** The brand's fonts come from Google Fonts, but Accountable has to work with no internet connection. The same three fonts are bundled into the app with the `@fontsource` npm packages, so nothing is loaded from Google.
2. **The first run needs the internet once.** Setting everything up on the first run means downloading the npm packages, the Python packages and, if it's missing, Python 3.12 itself (uv does this). After that, no connection is needed.
3. **One command before anything is installed.** `npm run dev` normally needs `npm install` first. Here `npm run dev` runs a small Node script with no dependencies of its own. It checks the Node.js version and that uv is installed, and says what to do if either is missing. Then it installs what's missing, creates the database with sample data if there isn't one, starts both servers and prints the address to open in Chrome.
4. **The brand's colors and WCAG AA.** Small text needs a contrast of 4.5:1. Measured against white:
   - White text on Cerulean is 3.96:1 and on Raspberry 3.62:1, though the brand pairs them.
   - Sea Green, Marigold and Coral as text are 1.62 to 2.35:1, as the brand itself warns.
   - Midnight text on Sea Green, Marigold and Coral passes, at 5.1 to 7.5:1.

   Full-strength brand colors are kept for fills, dots, chart marks, and Sea Green buttons with Midnight text. Text and any fill behind white text use the darker shades listed under Colors. Badges use a pale tint of the color with Midnight text. Concern 13 covers dark mode.
5. **Six stages, five colors.** The brand gives five colors for things side by side, in order. In that order Won would be Raspberry, the alert color, so the stages are colored by meaning instead:
   - New: Cerulean
   - Qualified: Marigold
   - Proposal: Coral
   - Negotiation: Midnight, or Sea Mist in dark mode (concern 13)
   - Won: Sea Green
   - Lost: grey

   Raspberry stays free for late deals and overdue follow-ups.
6. **Each stage's usual probability:** New 10%, Qualified 25%, Proposal 50%, Negotiation 75%, Won 100% and Lost 0%. Won and Lost are fixed at 100% and 0%, because expected revenue only counts open deals; the probability can only be set by hand on an open deal.
7. **What the funnel counts.** The funnel shows how much value reaches each stage. It counts each deal in every stage up to the furthest one it has reached, using its stage history, so it narrows from New to Won. A deal dragged straight from New to Proposal counts in Qualified too. A lost deal counts up to the furthest open stage it reached before it was lost, and a line under the funnel gives the total lost. A won deal counts in every stage, and a deal moved back out of Won counts as open again, up to the furthest open stage it has reached. The funnel covers every deal, with no date range, the same as the pipeline board.
8. **Moving a deal back out of Won or Lost** keeps its close date as it is, so the deal shows as late if that date has passed, which prompts a new expected date. It takes its new stage's usual probability, and its main contact stays a customer, since a contact's status never goes back by itself (R7).
9. **Won and Lost column figures.** Each open column on the pipeline shows its total value and expected revenue. For Won the expected revenue would equal the total, and for Lost it would always be $0, so those two columns show only their total value. The board's figures cover open deals only.
10. **Timelines follow a deal's current main contact.** A contact's timeline is worked out from the deals where they're the main contact now. If a deal's main contact changes, its activities and stage changes move to the new person's timeline. A deal with no main contact appears on nobody's.
11. **Money is always shown with its currency.** Everything is in US dollars, so amounts read `$12,500`, and table headings, chart axes and form fields that hold money say USD, such as "Value (USD)". In tight spaces, such as chart axes and dashboard tiles, amounts may be shortened to `$1.2M`, with the full amount shown on hover.
12. **Smaller choices:**
    - Every change of a contact's status appears in their timeline, whether made by hand or by a won deal.
    - Adding a deal straight to Won or Lost counts as moving it there. Its close date defaults to today and, for Won, its main contact becomes a customer.
    - An activity's "when it happened" can't be later than now. Things still to do go in its follow-up date.
    - "Today" is the date on the computer running Accountable. "Due in the next 7 days" means today or any of the 7 days after it.
    - Organizations don't have a timeline, because activities belong to a contact or a deal. An organization's page shows its contacts and deals.
13. **Dark mode colors.** The brand gives dark mode a `#04232E` page with black panels and cards, Sea Mist as ink, and Sea Green and Marigold lightened for text. Against black, every full-strength brand color passes 3:1 except Midnight, at 1.7:1. So in dark mode:
    - Negotiation is Sea Mist, the brand's ink on dark, just as Midnight is its ink on light. Its tint is Midnight.
    - Menus, lists, tooltips and messages, which open on top of black panels, are Midnight. Black on black would show no edge, and shadows barely show on a dark page. Panels, cards, the sidebar and dialogs stay black.
    - Dialogs sit over Midnight at 70%, which dims what's behind them toward Midnight, so the black dialog stands out from the black panels under it.
    - Primary buttons and ticked checkboxes keep Midnight text on Sea Green, since Sea Mist on Sea Green would be about 1.3:1.
    - The logo mark keeps its Midnight circle and Sea Green dot, matching the favicon, which can't change with the mode.
14. **The light or dark choice is kept in the browser.** It's a setting for this screen, not a record, so it's saved in the browser's local storage, the one exception to R14. That way the page is in the right mode before anything draws, and a dark page never flashes light while the app loads.
    - If nothing is saved, or the saved value isn't light or dark, the app is in light mode.
    - If the browser won't save it, the switch still works until the page is reloaded.
    - Another open tab changes when it's next loaded.
    - Switching is instant, with no fade and no message.

## Requirements

### Stages

The six stages are fixed.

| Stage | Order | Open or closed | Usual probability | Color |
|---|---|---|---|---|
| New | 1 | Open | 10% | Cerulean |
| Qualified | 2 | Open | 25% | Marigold |
| Proposal | 3 | Open | 50% | Coral |
| Negotiation | 4 | Open | 75% | Midnight, or Sea Mist in dark mode |
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

  Timelines are newest first, by when each thing happened. At the same moment, a status change comes above the stage change that caused it, and a stage change above an activity. Stage and status entries can't be edited or deleted.

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

- **R14.** Every change to a record is saved to the database as soon as it's made, so it's still there after a refresh and every time the app starts. No record or change to one is kept only in the browser. The one thing the browser keeps is the light or dark choice (concern 14).

### Screens

**Dashboard** (`/`), the landing page: how sales are going at a glance. It should be visually stunning, with a line chart, a bar chart and a visual of the pipeline. The figures are defined in the next section.

- **Revenue won this month**, the main figure. It gives last month's figure, and the total and number of deals won in the last 12 months.
- **Revenue won by month**: a line chart of the last 12 months, beneath the main figure.
- Three tiles: deals won this month (with last month's count), open pipeline (with its number of deals) and expected revenue (with its share of the open pipeline).
- **Deals won by month**: a bar chart of the same 12 months.
- **Open pipeline by stage**: the visual of the pipeline. Each open stage shows its value and expected revenue, with its count on hover and in the table for screen readers (see Charts).
- **Sales funnel**: value and count reaching each stage from New to Won, with the share of New's value that reaches each stage, and the total lost underneath.
- **Follow-ups**: overdue first, then due in the next 7 days. Each shows its type, its description, the contact or deal it's on (as a link), its due date as "3 days overdue", "Due today", "Due tomorrow" or "Due in 4 days", and a Done checkbox. The heading gives the count. The list scrolls inside its panel when it's long.
- **Recent activity**: the 10 newest timeline entries of any kind, from anywhere in the app, grouped under Today, Yesterday and Earlier, each linking to its record.
- The tiles and the pipeline visual link to the Pipeline.

**Organizations** (`/organizations`)

- Table columns: Name, Industry, Website, Contacts, Open deals, Open value (USD). Sorted by name to begin with.
- An organization's page (`/organizations/:id`) shows its name, industry, website (opening in a new tab) and notes, with Edit and Delete.
- A **Contacts** panel lists its contacts, with an Add contact button that fills in the organization.
- A **Deals** panel lists its deals, with their total open value and total won value, and an Add deal button that fills in the organization.

**Contacts** (`/contacts`)

- Table columns: Name, Organization, Job title, Email, Phone, Status. Sorted by name to begin with.
- A lead is a contact with the lead status, so there's no separate list of leads.
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

- The header shows the board's figures for open deals, side by side: the number of open deals, their total value and their expected revenue. It also has an Add deal button, for a new deal in New.
- There's one column for each of the six stages, in order, and every deal is on the board. Each column heading shows:
  - the stage's name and color dot
  - its count and total value
  - in open columns, its expected revenue and a thin bar showing the expected share of the value
  - in Won and Lost, "Won, all time" or "Lost, all time"
  - an Add deal button that starts the new deal at that stage
- A card in an open column shows the main contact's initials and name, the deal's name, value, probability and close date, and a Late badge if it's late.
- Cards in Won and Lost are compact: the deal's name, value and close date.
- Cards leave out the organization to save space. It's on the deal's page and in the Deals table, and the sample data's deal names start with it.
- Clicking a card, or pressing Enter on it, opens the deal's page.
- Dragging a card to another column or to another place follows R3 and R5. A card can be dropped anywhere in a column. Every figure on the board changes as soon as the card is dropped, before the server replies. If the save fails, the card goes back to where it was and a message says so. Any other card moved since stays where it was dropped.

**Forms** open in a dialog. Every field has a visible label, and optional fields say "Optional".

- **Organization:** Name, Website, Industry (suggesting industries already used), Notes.
- **Contact:** Name, Email, Phone, Job title, Organization (a picker you can search), Status.
- **Deal:** Name, Organization, Main contact (both pickers you can search), Stage, Value (USD), Probability (%) and Close date.
  - Choosing a main contact fills in the organization if it's empty.
  - Changing the stage fills in its usual probability. Choosing Won or Lost also fills in today as the close date. Either can be changed before saving.
  - Probability can't be edited for Won and Lost.
  - A new deal starts at New, or at its column's stage, with the stage's usual probability and a close date 30 days from today (today for Won and Lost).
- **Activity:**
  - Logged from the form at the top of a contact's or deal's timeline: Type (Note, Call or Email), Description, When (date and time, now by default; left as it is, it's the time the activity is saved) and Follow-up date (optional).
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

**Messages.** A short message confirms each save, delete and pipeline move, such as "Deal saved" or "Deal moved". If the server can't be reached, the page says "Can't reach Accountable's server. Check that it's running, then refresh." A record that no longer exists shows "This deal no longer exists", with a link back to the list. An unknown address shows "Page not found", with a link to the dashboard.

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
- **Deals:** about 45, worth $5,000 to $150,000 in steps of $500:
  - about 5 each in New, Qualified and Proposal, and 4 in Negotiation, with 3 of the open deals late
  - about 20 won, spread over the past 12 months with at least one in most months, so the monthly charts are full
  - about 6 lost, lost from different stages
- **Stage history:** each deal has a history that fits its stage, spread over the weeks before its close date.
- **Status history:** each contact who became a customer has a status change on the date of their first won deal.
- **Activities:** about 100 over the past 12 months, more of them recent, mixing notes, calls and emails, logged on both contacts and deals. About 20 have follow-ups: about 5 overdue, 6 due in the next 7 days, 3 later, and 6 done.
- **Same every time:** the records and their order are the same every time the sample data is loaded. Only the dates move, because they're counted back and forward from the day it's loaded.

### Running it

Accountable runs locally, with commands that work the same on Mac, Linux and Windows. After the first run it needs no internet connection.

- **Before you start:** Node.js 24 or later (26 recommended), uv and Google Chrome. Nothing else needs installing beforehand. `docs/STATUS.md` says how to install them on Mac, Linux and Windows.
- **`npm run dev`** starts Accountable. On the first run it checks Node.js and uv, installs the npm and Python packages, and creates the database with the sample data. Then it starts the backend and frontend and prints "Accountable is running at http://localhost:5173. Open it in Google Chrome." Ctrl+C, or closing the terminal, stops both.
- **`npm run seed`** replaces all the data with fresh sample data, dated from today, and prints what it created. If the app is running, refresh the browser to see the new data. `npm run seed -- --large` adds 500 of each kind of record, for checking speed.
- **`npm test`** runs every test against a database and ports of its own (8100 and 5273), so it works while the app is open. A test left with `.only` fails the run.
- **The data** lives in `data/accountable.db`, which git ignores, unless `DATABASE_URL` names another database. Deleting that file also resets to the sample data on the next start.

### Quality

- **Browser:** the current Google Chrome on Mac, Linux and Windows. Other browsers aren't checked.
- **Screen:** designed for 1440 by 900, and works from 1280 by 720 upwards.
- **Speed:** with 500 of each kind of record, every screen shows its data within a second on a typical laptop, the search keeps up with typing, and a dragged card follows the pointer smoothly.
- **Console:** no errors or warnings in Chrome's console during normal use.
- **Local only:** the servers listen on this computer (127.0.0.1) only, not on the network. The backend answers only requests addressed to `localhost` or `127.0.0.1`, so a web page can't reach it by pointing its own name at this computer, and the frontend's dev server allows no other origin and doesn't serve the database files.
- **Keyboard and contrast:** as described under Keyboard and accessibility.

## Design

### The look

The look is mockup C, Focus, in `docs/mockups/c-focus.html`, with its screenshot in `c-focus.png`. The other two mockups in that folder, A and B, aren't used. What marks mockup C out:

- **The funnel and stage charts:** the funnel is drawn as a real funnel shape, and open value by stage as columns with the expected part solid.
- **The pipeline layout:** wider open columns, each under its own white heading panel, contact initials on the cards, and compact Won and Lost columns.

Look and feel and Layout below follow it. The mockup shows the look, not the sample data: it has about 11 won deals, where the app has about 20. It's in light mode only. Dark mode keeps the same layout and uses the dark colors under Look and feel.

### How it fits together

- **`frontend/`:** a React, Vite and TypeScript app. Its dev server forwards `/api` to the backend, so the browser talks to one address.
- **`backend/`:** a FastAPI app, organized by kind of record, with the business rules (R1 to R11) in one service layer. Dragging a card, saving the form and adding a deal all go through the same code. Each request runs in a single database transaction, so a move to Won changes the deal, its stage history, its main contact and their status history together or not at all.
- **The database:** named by `DATABASE_URL`, which defaults to a SQLite file on this computer. The tables are defined with SQLAlchemy Core and created and changed by Alembic migrations, which are in git and run when the app starts. The sample data is loaded if the database was new. Moving to Postgres on Supabase later means changing `DATABASE_URL`.
- **SQLite details:** when the database is SQLite, every connection turns on foreign keys (`PRAGMA foreign_keys = ON`), or SQLite silently ignores the delete rules. It also uses WAL mode, so the seed command can run while the app is open.
- **Who decides:** the backend decides what's late, overdue and due soon, and works out every dashboard figure. The pipeline recalculates its own totals as soon as a card moves, using R1 and R2, and then refreshes from the server.
- **Light or dark:** the theme file holds a light and a dark value for each color role. A few lines at the top of `index.html` read the saved choice and mark the page as dark before anything draws (concern 14). The page also tells Chrome which mode it's in, so Chrome's own parts, such as scrollbars and the date and time pickers, follow it.

### Libraries

Popular, well-supported libraries, as `docs/TECH_STACK.md` asks:

| Need | Library |
|---|---|
| Pages and addresses | React Router |
| Loading and caching data, instant card moves | TanStack Query |
| Sorting and searching tables | TanStack Table |
| Pipeline drag and drop with the mouse | dnd-kit (`@dnd-kit/core`, `@dnd-kit/sortable`) |
| Charts | Recharts |
| Dialogs, menus, selects, checkboxes, tooltips, the Dark mode switch | Radix UI primitives |
| Pickers you can search | cmdk |
| Forms and field checks | React Hook Form with Zod |
| Styling, with the brand as theme tokens | Tailwind CSS |
| Icons | lucide-react |
| Messages | sonner |
| Dates | date-fns |
| Fonts, served from the app | `@fontsource/instrument-sans`, `@fontsource/instrument-serif`, `@fontsource/jetbrains-mono` |
| API | FastAPI, Pydantic, Uvicorn |
| Database | SQLAlchemy Core |
| Database changes | Alembic |
| Tests | Vitest with React Testing Library, pytest with FastAPI's test client, Playwright Test using Chrome |

### Data model

Columns use SQLAlchemy's own types (`Date`, `DateTime`, `Boolean`, `Integer`, `String`, `Text`), so the same tables work on Postgres later. The API sends dates as `YYYY-MM-DD` and times as ISO 8601, in local time. Money is stored in whole US dollars. Every table has `id` (an integer primary key), and the four kinds of record also have `created_at` and `updated_at`, set by the server.

**organizations**

| Column | Type | Rules |
|---|---|---|
| name | text | required, up to 120 characters |
| website | text | optional, up to 300 characters, counting any `https://` added; `https://` is added if no scheme is given, and only `http` and `https` addresses are kept, since it becomes a link |
| industry | text | optional, up to 80 characters |
| notes | text | optional, up to 5,000 characters |

**contacts**

| Column | Type | Rules |
|---|---|---|
| name | text | required, up to 120 characters |
| email | text | optional, up to 254 characters, must look like an email address |
| phone | text | optional, up to 40 characters |
| job_title | text | optional, up to 120 characters |
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

JSON under `/api`, with snake_case names. A failed field check returns 422 with a message for each field, which the form shows under that field. A missing record returns 404, and so does an id in the address that can't be a record's, such as `abc`. A link in the body to an id that can't be a record's returns 422. The API is only what's in this table, with no `/docs`, `/redoc` or `/openapi.json`.

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

The look follows Accountable's brand guidelines, which take priority over any general design guidance. It has a light mode, the default, and a dark mode, both designed for a laptop or desktop screen. Colors below are named by their light-mode value, and dark mode uses the dark value of the same role: "white" means the panel color, which is black in dark mode, "Midnight text" means ink, which is Sea Mist, and "Slate" means ink muted. Where a color stays the same in both modes, it says so.

**Fonts.** Instrument Sans for headings and body. JetBrains Mono, with tabular figures, for money, counts, percentages and dates in tables, cards, tiles and charts. Instrument Serif is used only as an accent: for the tagline under the logo ("Every deal, accounted for") and the date above the dashboard's title.

| Use | Font | Size and weight |
|---|---|---|
| Page title | Instrument Sans | 28px, 600 |
| Panel title | Instrument Sans | 16px, 600 |
| Body and table cells | Instrument Sans | 14px, 400 |
| Labels and table headings | Instrument Sans | 13px, 500 |
| Small print | Instrument Sans | 12px, 400 |
| The dashboard's main figure | JetBrains Mono | 46px, 500 |
| Tile figures | JetBrains Mono | 26px, 500 |
| Pipeline column totals | JetBrains Mono | 17px, 500 |
| Card values | JetBrains Mono | 15px, 500 |
| Figures in tables and other places on cards | JetBrains Mono | 12 to 13px, 400 |
| Accent | Instrument Serif | 17px for the tagline, 22px for the date |

**Colors in light mode.** Each contrast ratio is measured against white, and against the page background where text sits on it.

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
| Sea Mist | `#CDD8DB` | Not used in light mode. Main text and Negotiation in dark mode |
| Divider | `#E3EAEC` | Lines between table rows, chart gridlines |
| Page | `#F0F4F5` | Page background |
| Panel | `#FFFFFF` | Panels, cards and dialogs, and the raised surface for menus, lists, tooltips and messages |

Badge backgrounds are a 16% tint of each color on white, with Midnight text (9 to 11:1): Sea Green `#D7F8F0`, Marigold `#FFF5E1`, Coral `#FEEDE7`, Cerulean `#D9ECF3`, Raspberry `#FCE2E8`, Midnight `#D7E0E2` and grey `#EDF0F1`.

Statuses use colors too: lead Cerulean, qualified Marigold and customer Sea Green.

**Colors in dark mode,** from the brand's dark surfaces (concern 13). Each contrast ratio is measured against the black panels, the page and the raised Midnight surface, in that order.

| Role | Value | Use |
|---|---|---|
| Page | `#04232E` | Page background (1.3:1 against the panels) |
| Panel | `#000000` | Panels, cards, the sidebar, dialogs and inputs |
| Raised | `#073B4C`, Midnight | Menus, select lists, pickers, tooltips, messages and the skip link (1.7:1 against the panels, 1.35:1 against the page) |
| Ink | `#CDD8DB`, Sea Mist | Main text (14.4:1, 11.2:1, 8.3:1) |
| Ink muted | `#9DB1B8` | Secondary text (9.4:1, 7.3:1, 5.4:1) |
| Link | `#4FB6D9` | Cerulean lightened, for links (9.0:1, 7.0:1, 5.2:1) |
| Primary text | `#51E2BC` | Sea Green lightened, as text (13.0:1, 10.1:1, 7.5:1) |
| Alert text | `#F47E9A` | Raspberry lightened, for late dates, overdue labels and error messages (8.3:1, 6.5:1, 4.8:1) |
| Secondary | `#073B4C`, Midnight | Secondary buttons, with Sea Mist text (8.3:1) |
| Divider | `#1A3540` | Lines between table rows, chart gridlines |
| Overlay | Midnight at 70% | Behind dialogs |
| Chart wash | Sea Green at 18% | The line chart's area |

These keep their light-mode values, and pass on the dark surfaces:

- Sea Green, Marigold, Coral, Cerulean, Raspberry and Grey as fills, dots and chart marks. Cerulean is the lowest, at 5.3:1 against the panels and 4.1:1 against the page.
- Cerulean as the focus ring (5.3:1, 4.1:1, 3.0:1).
- The field outline (6.3:1, 4.9:1, 3.6:1).
- Primary buttons, Sea Green with Midnight text (6.4:1), and the Raspberry fill with white text (5.1:1).

Badge backgrounds in dark mode are a 30% shade of each color over black, with Sea Mist text (7.5 to 9.1:1): Sea Green `#024030`, Marigold `#4C3A15`, Coral `#4A2A20` and grey `#2B3133`. Cerulean `#073747` and Raspberry `#601C2C` are a 40% shade, since at 30% they'd match the page. Negotiation's tint is Midnight `#073B4C`.

Components use colors by role, never by the brand's names or by value. The roles are:

- page, panel, raised, ink, ink muted, divider, field outline, focus and link
- primary, the text on primary, alert and their tints
- each stage and status, with its tint

Only the theme file maps each role to a color in the tables above, with one value for light mode and one for dark, and the charts use the same roles. The favicon can't read the theme, so its two colors are light mode's ink and primary values, which a test checks. It's the same in both modes.

**Surfaces and shape.**

- **Panels:** white, rounded (16px), with no outline and a soft shadow: `0 1px 2px rgba(7, 59, 76, 0.06), 0 8px 24px rgba(7, 59, 76, 0.06)`. In dark mode they're black on the dark teal page, and the shadows are black: `0 1px 2px rgba(0, 0, 0, 0.4), 0 8px 24px rgba(0, 0, 0, 0.4)`.
- **Cards** are rounded 12px, and **buttons and inputs** 10px.
- **Edges:** no border on one edge of anything, and no line across the top of the page or under the page header. A stage or status shows as a dot or a badge, never as a colored stripe down the side of a card.
- **Fills** are flat. There are no gradients. The line chart's area uses a flat tint.
- **Spacing** is on a 4px grid. Panels have 20 to 24px of padding, and the gap between panels is 20px.

**Components.**

- **Buttons** are 36px high, in 14px semibold:
  - Primary: Sea Green with Midnight text, in both modes.
  - Secondary: a Midnight tint with Midnight text, or Midnight with Sea Mist text in dark mode.
  - Delete: Raspberry fill with white text.
  - Icon buttons are 32px square, with a label for screen readers and a tooltip.
- **Inputs:** white, with a full 1px outline in the field outline color. They're 36px high, with the label above and any error message below in Raspberry text. A ticked checkbox is Sea Green with a Midnight tick, in both modes.
- **Badges:** pill-shaped and 22px high, with a tint background, Midnight 12px medium text and an 8px dot in the full color.
- **Tables** sit inside a panel.
  - The headings are Slate text with no fill, and rows are 44px high with a divider between them.
  - A row is lightly tinted on hover.
  - Figures are right-aligned in JetBrains Mono.
  - Edit and Delete are always visible, not only on hover.
- **Due badges** on follow-ups: a Raspberry tint when overdue, a Marigold tint when due today, and grey otherwise.
- **Pipeline column headings:** white panels, rounded 14px, holding:
  - the stage's dot, name and count, and the Add deal button
  - the total value
  - in open columns, the expected revenue, and a 4px bar in the stage's tint whose filled part, in the stage's color, is the expected share of the value
- **Pipeline cards:** white with the panel shadow and 12px padding.
  - The top line has the main contact's initials in a 24px circle in the stage's tint, their name in Slate, and the Late badge on the right if needed.
  - Then come the deal name in 13.5px semibold, the value with the probability beside it, and the close date with a calendar icon, in Raspberry text when the deal is late.
  - Won and Lost cards are compact, with 10px padding: the deal name, then the value and close date.
  - A card being dragged gets a deeper shadow, and the place it will land shows as a tinted space.
- **Dialogs:** white and 520px wide, over Midnight at 40%, or Midnight at 70% in dark mode (concern 13).
- **Menus, select lists, pickers and tooltips** open on the raised surface, with the deeper shadow: white in light mode and Midnight in dark mode.
- **Messages:** on the raised surface at the bottom right. Errors have a Raspberry dot.
- **The Dark mode switch:** a 36 by 20px pill with a 16px round knob. Off, in light mode, it's the field outline color with a white knob on the left. On, in dark mode, it's Sea Green with a black knob on the right.

**Charts**, with Recharts:

- **Colors by meaning:** "won" figures are Sea Green, and anything by stage uses the stage colors. In dark mode the charts use the dark values of the same roles, so the axis labels, gridlines, funnel gaps and the tinted part of each stage column follow the mode.
- **Revenue won by month:** a 2.5px Sea Green line over a flat 12% Sea Green area, with points shown on hover. Month labels run along the bottom and short USD amounts up the side, with horizontal gridlines only.
- **Deals won by month:** Sea Green bars with rounded tops and the count above each bar.
- **Sales funnel:** a funnel of joined trapezoids, one per stage from New to Won, each in its stage's color. Each one narrows from its own stage's value to the next stage's, with a 2px gap between them, and Won is a plain rectangle.
  - Labels to the right give each stage's name, count, short value and share of New's value.
  - A line underneath gives the total lost.
- **Open pipeline by stage:** one column per open stage, its height set by total value, with rounded tops.
  - The expected part is solid in the stage's color, from the baseline up, and the rest is in its tint.
  - The short value sits on top, with the stage's name and its expected revenue underneath.
- **Tooltips:** on the raised surface, with full USD amounts in JetBrains Mono.
- **Text and alternatives:** every chart has a title and a one-line summary in words, such as "$612,000 won in the last 12 months", plus a table of its figures for screen readers. Several brand colors are below 3:1 against white, so every figure is also given in text, never by color alone.

**Words and formats.** Plain business English, short labels, no jargon and no exclamation marks.

- **Buttons** say what they do: "Add deal", "Log activity", "Save", "Delete organization", "Cancel".
- **Money:** `$12,500`, with USD in headings (concern 11). `$1.2M` and `$48K` only in tight spaces, with the full amount on hover.
- **Dates:** `Nov 22, 2026`. In timelines, "Today, 2:30 PM", "Yesterday, 9:05 AM" or "Nov 12, 2:30 PM", with the year added when it isn't this year.
- **Percentages:** `50%`.
- **Empty states:** one plain line and an Add button, such as "No organizations yet." Searches with no results say "No deals match "acme"."

### Layout

- **Sidebar:** a floating white panel, 224px wide, 16px in from the top, bottom and left of the window, and rounded with the panel shadow.
  - It holds the wordmark "Accountable" with its tagline, then the five sections, each with an icon. The logo mark beside the wordmark is a Sea Green dot in a Midnight circle, in both modes.
  - Organizations, Contacts and Deals show how many records they have, on the right in JetBrains Mono.
  - The current section is a Sea Green tint pill with Midnight text.
  - The **Dark mode** switch sits at the bottom of the sidebar, below the five sections, with a moon icon and the label "Dark mode". The sidebar is on every page, including Page not found, so the switch is too.
- **Main area:** on the page background, with 24 to 28px of padding and content up to 1440px wide.
- **Page header:** the title on the left, with the main action on the right, such as "Add deal".
- **Dashboard,** on a 12-column grid:
  1. Today's date as the accent, above the title "Dashboard".
  2. A large panel (8 columns) with revenue won this month and, beneath it, revenue won by month, beside the three other tiles stacked (4 columns).
  3. Deals won by month, Sales funnel and Open pipeline by stage, 4 columns each.
  4. Follow-ups and Recent activity, 6 columns each.
- **Pipeline:**
  - The open columns take 1.2 shares of the width and Won and Lost 0.8 each. At 1440px that makes the open columns about 200px wide and Won and Lost about 135px. If the open columns would be narrower than 170px, the board scrolls sideways.
  - Each column fills the height of the window and scrolls on its own, with its heading panel staying in place.
  - The cards sit below their heading on the page background.
- **Record pages:**
  - The details are on the left (4 columns), with the linked contacts and deals beneath them.
  - The timeline is on the right (8 columns).
  - An organization's page puts the contacts and deals side by side, since it has no timeline.

### Keyboard and accessibility

Everything can be done with the keyboard as well as the mouse, including moving a card on the pipeline. Text meets WCAG AA contrast in both modes, and every form field has a label.

- **Tab order:** everything can be reached with Tab, in reading order. Everything that can be focused shows a 2px Cerulean focus ring, 2px outside its edge.
- **Structure:** a "Skip to content" link comes first. Each page has one main heading, which is the message when the page can't load, and labelled navigation and main areas.
- **Tables:** these are real HTML tables. Each sortable heading is a button and announces its sort order. On each row, the name link and the Edit and Delete buttons can be reached with Tab.
- **Forms:** every field has a visible label. Errors are linked to their field, and saving with errors moves focus to the first one.
- **Dialogs** keep focus inside them, close with Escape, and return focus to the button that opened them, or to the menu's button for an item in a menu.
- **Pipeline,** with keyboard moves of our own rather than the drag library's, which moves by screen position. They use the same move function as dragging, so both follow the same rules:
  - Tab reaches each card.
  - Space picks a card up, Up and Down move it within the column, and Left and Right move it to the next column, keeping its position where possible.
  - Space drops it, and Escape puts it back where it was.
  - Enter opens the deal when no card is being moved.
  - A screen reader announces each step, such as "Picked up Harbor Logistics fleet analytics, in Proposal, position 2 of 5", and "Dropped in Negotiation, position 1 of 4".
- **Dark mode switch:** a real switch, reached with Tab after the five sections. Space or Enter flips it, and a screen reader announces it as the "Dark mode" switch, on or off.
- **Not by color alone:** stage, status, late and overdue are always written in words as well as shown in color.
- **Motion:** animations are turned off for anyone whose system asks for reduced motion.

### Testing hooks

- `DATABASE_URL` sets the database, so the tests use their own.
- `ACCOUNTABLE_TODAY` fixes the date the backend treats as today, with noon as the time now, so the tests for late deals, follow-ups and months always give the same results. The end-to-end tests set Chrome's clock to 11:00 on the same date, since the pipeline works out late cards in the browser too, and a time Chrome fills in as now is then never later than the backend's now.
- The sample data generator takes today's date as an input, for the same reason.
- `ACCOUNTABLE_API_PORT` and `ACCOUNTABLE_WEB_PORT` set the ports the frontend's dev server uses, so the tests can run their own copy of the app while it's open.
- The browser saves the light or dark choice for each address separately, so the tests' copy of the app on port 5273 keeps its own choice and never changes the app on 5173. Each end-to-end test starts with nothing saved, so in light mode.
