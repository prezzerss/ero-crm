# Local HubSpot import data

Place the private HubSpot exports here with these filenames:

- `All Companies.xlsx`
- `all-contacts.xlsx`

The Excel files and generated `reports/` directory are ignored by Git. Keep them
out of `public/`; files in that directory can be served by the browser app.

Run a read-only comparison first:

```bash
npm run import:hubspot -- --dry-run
```

Review the JSON report written under `data/hubspot/reports/`. Only then run:

```bash
npm run import:hubspot -- --commit
```

Both modes load `NEXT_PUBLIC_SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` from the local environment (including `.env.local`).
The service-role key must never use a `NEXT_PUBLIC_` name.
