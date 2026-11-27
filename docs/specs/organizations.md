# Organizations

Part of the spec. `docs/spec.md` has the summary of the whole product and the index of every area file, concern and rule.

## Screen

**Organizations** (`/organizations`)

- Table columns: Name, Industry, Website, Contacts, Open deals, Open value (USD). Sorted by name to begin with.
- An organization's page (`/organizations/:id`) shows its name, industry, website (opening in a new tab) and notes, with Edit and Delete, and who added it and last changed it (R17).
- A **Contacts** panel lists its contacts, with an Add contact button that fills in the organization.
- A **Deals** panel lists its deals, with their total open value and total won value, and an Add deal button that fills in the organization.

## Form

- **Organization:** Name, Website, Industry (suggesting industries already used), Notes.

## Data model

**organizations**

| Column | Type | Rules |
|---|---|---|
| name | text | required, up to 120 characters |
| website | text | optional, up to 300 characters, counting any `https://` added; `https://` is added if no scheme is given, and only `http` and `https` addresses are kept, since it becomes a link |
| industry | text | optional, up to 80 characters |
| notes | text | optional, up to 5,000 characters |

## API

| Method and path | What it does |
|---|---|
| `GET /api/organizations` | All organizations, with contact count, open deal count, open value and deal count |
| `POST /api/organizations` | Adds one |
| `GET /api/organizations/{id}` | One organization, with its contacts and deals |
| `PATCH /api/organizations/{id}` | Changes one |
| `DELETE /api/organizations/{id}` | Deletes one (R11) |
