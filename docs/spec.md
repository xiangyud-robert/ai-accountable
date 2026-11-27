# Spec: Accountable

This file is a short summary of Accountable as it stands today: what it's for and what it does, with an index of the files that hold the detail. The detail is in one file per area in `docs/specs/`, listed under Areas, and together they describe how it behaves and how it looks. They cover the whole product, and every change updates the files it affects, so they always describe the product as it is. The look follows the brand skill (`.claude/skills/brand/SKILL.md`), and the stack follows `docs/TECH_STACK.md`.

## The problem

A small business keeps track of its customers and sales in spreadsheets, inboxes and people's heads. Nobody on the team can see at a glance which companies we deal with, who our contacts are, what's in the sales pipeline, what happened last with a customer, what needs doing next or who did it.

## The product

Accountable is a business management system: a sales CRM that will grow into a full Business OS, including ERP. Today it's a complete sales CRM for a small team, shared on the web. Think of it as a private Salesforce that does the everyday CRM essentials really well. It should feel sharp, modern and professional, and be a pleasure to use.

- **Who uses it:** a small sales team, each person signing in from their own computer every day and working on the same organizations, contacts and deals. They sell software and services to small and mid-sized companies, with deals from about $5,000 to $150,000 that take weeks to months to close. The only other system involved is Supabase, which holds the data and the sign-in.
- **Signing in:** with an email and password. People are added in Supabase's dashboard, with no sign-up page, and everyone can do everything (see Areas).
- **Five sections:** the Dashboard, Organizations, Contacts, Deals and the Pipeline (see Areas).
- **A top bar** on every page, with a search box that finds any organization, contact or deal by part of its name, and a menu under your initials with the theme and Sign out.
- **Four kinds of record:** organizations, contacts, deals and activities (see Areas). Activities can have follow-ups, and each deal's stages and each contact's statuses keep a history. Every record and activity shows who added it.
- **One time zone** for the whole team, set by `ACCOUNTABLE_TIMEZONE`, for today, due dates, months and every time shown.
- **Sample data** fills every screen the first time it starts, spread across four made-up teammates, and one command resets the local copy to it.
- **Every change is kept,** in Postgres on Supabase, through a refresh and a restart, and everyone sees it.
- **Light, dark or system,** chosen in the menu under your initials. Light is the default, System follows the device's setting, and each browser remembers the choice.
- **Two ways to run it:** on Render for the team, against Supabase, and on this computer with `npm run dev`, which has a database of its own and a stand-in sign-in, and never reaches Supabase.

**Not in Accountable yet:**

- roles and permissions
- signing in with Google or magic links, signing up, and resetting a password
- a full history of who did what: each record keeps only who added it and who last changed it, and stage and status changes don't record who made them
- a separate time zone for each person
- moving the data in a local database to Supabase
- a layout for phones
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
| `docs/specs/records.md` | What every record shares: money and other smaller choices, deleting (R11, R12), tables (R13), keeping changes (R14), who added and changed it (R17), forms, the delete questions, messages and the layout of record pages |
| `docs/specs/look.md` | Look and feel: the mockup, contrast, fonts, light mode colors and the color roles, surfaces, components, words and formats, Layout (the sidebar, main area, top bar and page header), and Keyboard and accessibility |
| `docs/specs/light-and-dark.md` | Light and dark mode: dark mode colors, the Light, Dark and System choice, how it's kept, and its testing hooks |
| `docs/specs/sign-in.md` | Signing in (R15), the stand-in sign-in, how a person shows (R16), staying signed in and signing out, the user menu, the users table and its API |
| `docs/specs/search.md` | The search box in the top bar (R18), its results, its keyboard use and its API |
| `docs/specs/sample-data.md` | The sample data, with its made-up teammates |
| `docs/specs/platform.md` | Two ways to run it, the first run, the time zone, row-level security, Running it, On Render, Quality, How it fits together, Libraries, the rules every table and API route share, and Testing hooks |

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
| 14. The theme choice is kept in the browser | `docs/specs/light-and-dark.md` |
| 15. Two ways to run it | `docs/specs/platform.md` |
| 16. One time zone for the team | `docs/specs/platform.md` |
| 17. Row-level security on every table | `docs/specs/platform.md` |
| 18. The stand-in sign-in | `docs/specs/sign-in.md` |
| 19. People's names come from their tokens | `docs/specs/sign-in.md` |
| 20. Removing someone takes up to an hour | `docs/specs/sign-in.md` |
| 21. Ignoring case the same way on SQLite and Postgres | `docs/specs/search.md` |

| Rules | File |
|---|---|
| R1 to R6: deals | `docs/specs/deals.md` |
| R7: contacts | `docs/specs/contacts.md` |
| R8 to R10: activities | `docs/specs/activities.md` |
| R11 to R14: deleting, tables and keeping changes | `docs/specs/records.md` |
| R15, R16: signing in and how a person shows | `docs/specs/sign-in.md` |
| R17: who added and changed a record | `docs/specs/records.md` |
| R18: search | `docs/specs/search.md` |
