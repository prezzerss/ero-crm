# Trello and quote-tool integration

## What is implemented

- Company-level preferences in the CRM.
- Stable CRM company IDs displayed on each client page.
- Dedicated `General`, `Quoting`, and `Invoicing` contact types. Quoting contacts require a name, company and email address.
- Multiple quoting contacts per company and one optional default quoting contact.
- A server-to-server endpoint that returns quoting contacts by stable company ID.
- CRM job types and linked projects, including Trello card IDs and URLs.
- A same-company, same-job-type related-project selector that copies reference job numbers.
- A Trello Power-Up with CRM linking, preference, similar-job, project-registration, and reference-job actions.

## Required environment variables

Add the following server-only value to the CRM deployment:

```text
CRM_INTEGRATION_SECRET=<a-long-random-value>
```

Use the same value in the quote tool. Do not prefix it with `NEXT_PUBLIC_` or expose it in browser code.

The CRM also continues to require its existing Supabase variables, including the server-only `SUPABASE_SERVICE_ROLE_KEY`.

## Database setup

Run `supabase/trello-crm-quoting-schema.sql` once in the Supabase SQL editor. It is idempotent and may safely be rerun.

It adds:

- `companies.preferences` and `companies.preferences_reviewed_at`;
- `contacts.contact_type` and `contacts.is_default_quoting_contact`;
- `crm_job_types`;
- `crm_projects`;
- validation, indexes, row-level-security policies, and the one-default-quoting-contact rule.

If the database already contains a free-text `contacts.contact_type` column, the migration safely normalises it. Quote and billing variants are mapped to the new categories. Other legacy values are retained in an empty `role` field before the category becomes `General`. Incomplete legacy quoting contacts remain `General` until their required name, company and email are completed in the CRM.

## Quote-tool API contract

### Search companies

```http
GET /api/integrations/companies?search=Bristol
Authorization: Bearer {CRM_INTEGRATION_SECRET}
```

The endpoint performs a case-insensitive partial search of company names, returns at most 20 results ordered by name, and responds with:

```json
[
  {
    "id": "company-id",
    "name": "Bristol CC"
  }
]
```

Use the selected `id` for all subsequent CRM requests. An empty array means no companies matched. A missing search term returns `400`; a missing or incorrect bearer secret returns `401`.

### Get quoting contacts

```http
GET /api/integrations/companies/{companyId}/quoting-contacts
Authorization: Bearer {CRM_INTEGRATION_SECRET}
```

Call this from the quote tool's server, not directly from a browser. `{companyId}` must be the CRM company's UUID, not its name.

The endpoint returns HTTP `200` and a JSON array. An empty array means that the company has no quoting contacts.

```json
[
  {
    "id": "contact-id",
    "name": "Jane Smith",
    "email": "jane@example.com",
    "isDefault": true
  }
]
```

The default contact is returned first. Other responses are:

- `400` for an invalid company ID;
- `401` for a missing or incorrect bearer secret;
- `404` when the company does not exist;
- `500` when the CRM integration is not configured or the database query fails.

### Quote-tool selection rules

1. Fetch contacts after the user selects a company with a stored CRM company ID.
2. If one result has `isDefault: true`, select it automatically.
3. If several results are present, show all of them in a dropdown and keep the default selected when one exists.
4. If one non-default result is returned, it may be selected automatically.
5. If no results are returned, the request fails, or the company has no CRM ID, leave manual contact entry available.
6. Save the selected contact ID and a name/email snapshot on the quote so historical quotes remain readable if a CRM contact later changes.

## Additional integration endpoints

### Active job types

```http
GET /api/integrations/job-types
Authorization: Bearer {CRM_INTEGRATION_SECRET}
```

### Register or update a Trello project

```http
POST /api/integrations/projects
Authorization: Bearer {CRM_INTEGRATION_SECRET}
Content-Type: application/json

{
  "companyId": "stable-company-uuid",
  "jobNumber": "6123",
  "jobType": "Meeting minutes",
  "title": "RSN board meeting minutes – June",
  "trelloCardId": "trello-card-id-or-short-link",
  "trelloCardUrl": "https://trello.com/c/example/card-title",
  "trelloStatus": "In progress"
}
```

The same Trello card ID updates its existing CRM project rather than creating another one. Job numbers remain unique.

## Trello data stored on each card

The Power-Up stores shared card data under the key `crmLink`:

```json
{
  "companyId": "stable-company-uuid",
  "jobNumber": "6123",
  "jobType": "Meeting minutes",
  "referenceJobs": "6068, 5994"
}
```

The first three values identify the current project. `referenceJobs` contains only the older, manually selected job numbers used as references.

## Trello Power-Up configuration

After deploying the CRM, set the Power-Up iframe connector URL to:

```text
https://<crm-domain>/trello/power-up
```

Enable these capabilities:

- `card-buttons`
- `card-badges`
- `card-detail-badges`

No Trello custom fields are required for this version. The card buttons store and read the shared Power-Up data directly.

## Acceptance test using cards 0001–0003

1. Create or choose one CRM test company and copy its stable company ID.
2. Create job type `Meeting minutes` if it is not already available.
3. Link cards `0001` and `0002` to that company and job type, using the matching job number on each card.
4. Use **Register in CRM** on both cards and save their prefilled project forms.
5. On card `0002`, open **Similar jobs**. Confirm that `0001` appears, select it, and copy the job number.
6. Back on `0002`, open **Reference jobs**, paste `0001`, and save. Confirm that it appears as a card detail badge.
7. Link `0003` to either a different company or a different job type. Confirm it does not appear as an automatic same-company, same-job-type match for `0002`.
8. Add two quoting contacts to the test company, mark one as default, and call the quoting-contacts endpoint. Confirm both are returned and exactly one has `isDefault: true`.
9. Open **Client preferences** from a linked Trello card and confirm it goes to the correct company's preference section.
