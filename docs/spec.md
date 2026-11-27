# Spec: Accountable

This file is a short summary of Accountable as it stands today: what it's for and what it does, with an index of the files that hold the detail. The detail is in one file per area in `docs/specs/`, listed under Areas, and together they describe how it behaves and how it looks. They cover the whole product, and every change updates the files it affects, so they always describe the product as it is. The look follows the brand skill (`.claude/skills/brand/SKILL.md`), and the stack follows `docs/TECH_STACK.md`.

## The problem

A small business keeps track of its customers and sales in spreadsheets, inboxes and people's heads. Nobody can see at a glance which companies we deal with, who our contacts are, what's in the sales pipeline, what happened last with a customer or what needs doing next.

## The product

Accountable is a business management system: a sales CRM that will grow into a full Business OS, including ERP. Today it's a complete sales CRM for one person, running on their own computer. Think of it as a private Salesforce that does the everyday CRM essentials really well. It should feel sharp, modern and professional, and be a pleasure to use.

- **Who uses it:** one salesperson, on their own computer, every day. They sell software and services to small and mid-sized companies, with deals from about $5,000 to $150,000 that take weeks to months to close. No other systems are involved.
- **Five sections:** the Dashboard, Organizations, Contacts, Deals and the Pipeline (see Areas).
- **Four kinds of record:** organizations, contacts, deals and activities (see Areas). Activities can have follow-ups, and each deal's stages and each contact's statuses keep a history.
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

## Areas

Read this file first, then only the area files a change touches.

| File | What it covers |
|---|---|
| `docs/specs/dashboard.md` | The Dashboard screen, its figures (including the funnel, concern 7), its charts and its layout |
| `docs/specs/organizations.md` | The Organizations screen, an organization's page, its form, its table and its API |
| `docs/specs/contacts.md` | Contact statuses (R7), the Contacts screen, a contact's page, its form, the contacts and status_changes tables and their API |
| `docs/specs/deals.md` | The six stages and their probabilities, the deal rules (R1 to R6), the Deals screen, a deal's page, its form, the deals and stage_changes tables and their API |
| `docs/specs/pipeline.md` | The Pipeline screen, moving deals out of Won and Lost, its column headings and cards, its layout and its keyboard moves |
| `docs/specs/activities.md` | Activities, follow-ups and timelines (R8 to R10), the activity form, the activities table and its API |
| `docs/specs/records.md` | What every record shares: money and other smaller choices, deleting (R11, R12), tables (R13), keeping changes (R14), forms, the delete questions, messages and the layout of record pages |
| `docs/specs/look.md` | Look and feel: the mockup, contrast, fonts, light mode colors and the color roles, surfaces, components, words and formats, Layout (the sidebar, main area and page header), and Keyboard and accessibility |
| `docs/specs/light-and-dark.md` | Light and dark mode: dark mode colors, how the choice is kept, the Dark mode switch and its testing hook |
| `docs/specs/sample-data.md` | The sample data |
| `docs/specs/platform.md` | Working offline and the first run, Running it, Quality, How it fits together, Libraries, the rules every table and API route share, and Testing hooks |

## Concerns and rules

Concerns are choices about behavior that the rules don't make obvious, each with its reason. The code and tests refer to them by number, such as "concern 7". Each rule has a number so the tests can refer to it.

Each concern and rule keeps its number, and lives in the area file it's about.

| Concern | File |
|---|---|
| 1. Fonts that work offline | `docs/specs/platform.md` |
| 2. The first run needs the internet once | `docs/specs/platform.md` |
| 3. One command before anything is installed | `docs/specs/platform.md` |
| 4. The brand's colors and WCAG AA | `docs/specs/look.md` |
| 5. Six stages, five colors | `docs/specs/deals.md` |
| 6. Each stage's usual probability | `docs/specs/deals.md` |
| 7. What the funnel counts | `docs/specs/dashboard.md` |
| 8. Moving a deal back out of Won or Lost | `docs/specs/pipeline.md` |
| 9. Won and Lost column figures | `docs/specs/pipeline.md` |
| 10. Timelines follow a deal's current main contact | `docs/specs/activities.md` |
| 11. Money is always shown with its currency | `docs/specs/records.md` |
| 12. Smaller choices | `docs/specs/records.md` |
| 13. Dark mode colors | `docs/specs/light-and-dark.md` |
| 14. The light or dark choice is kept in the browser | `docs/specs/light-and-dark.md` |

| Rules | File |
|---|---|
| R1 to R6: deals | `docs/specs/deals.md` |
| R7: contacts | `docs/specs/contacts.md` |
| R8 to R10: activities | `docs/specs/activities.md` |
| R11 to R14: deleting, tables and keeping changes | `docs/specs/records.md` |
