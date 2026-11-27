# Contacts

Part of the spec. `docs/spec.md` has the summary of the whole product and the index of every area file, concern and rule.

## Rules

- **R7.** A contact's status is lead, qualified or customer, and starts as lead. It can be changed by hand in any direction, and never goes back by itself. Every change records an entry such as "Status changed from Lead to Qualified".

## Screen

**Contacts** (`/contacts`)

- Table columns: Name, Organization, Job title, Email, Phone, Status. Sorted by name to begin with.
- A lead is a contact with the lead status, so there's no separate list of leads.
- A status filter shows All, Leads, Qualified and Customers, each with its count. It works together with the search, and is kept in the address (`/contacts?status=lead`) so it survives a refresh.
- A contact's page (`/contacts/:id`) shows their name, status, job title, organization (as a link), email (as a mail link) and phone, with Edit and Delete.
- A **Deals** panel lists the deals where they're the main contact, with an Add deal button that fills in the contact and organization.
- Their **timeline** (R10) has the Log activity form at the top.

## Form

- **Contact:** Name, Email, Phone, Job title, Organization (a picker you can search), Status.

## Data model

**contacts**

| Column | Type | Rules |
|---|---|---|
| name | text | required, up to 120 characters |
| email | text | optional, up to 254 characters, must look like an email address |
| phone | text | optional, up to 40 characters |
| job_title | text | optional, up to 120 characters |
| organization_id | integer, nullable | links to organizations; set to empty when the organization is deleted |
| status | text | `lead`, `qualified` or `customer`; `lead` by default |

**status_changes**: one row each time a contact's status changes.

| Column | Type | Rules |
|---|---|---|
| contact_id | integer | deleted with the contact |
| from_status, to_status | text | |
| won_deal_id | integer, nullable | the deal whose win caused it; set to empty when that deal is deleted |
| changed_at | datetime | |

## API

| Method and path | What it does |
|---|---|
| `GET /api/contacts` | All contacts, with organization name, deal count and activity count |
| `POST /api/contacts` | Adds one |
| `GET /api/contacts/{id}` | One contact, with their organization, their deals and their timeline |
| `PATCH /api/contacts/{id}` | Changes one, recording a status change if the status changed |
| `DELETE /api/contacts/{id}` | Deletes one (R11) |
