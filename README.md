This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Historical HubSpot import

The one-off importer is a local Node script and is not called by the application,
Vercel builds, or application startup. Put the private exports in
`data/hubspot/` as described in
[`data/hubspot/README.md`](data/hubspot/README.md), then run:

```bash
npm run import:hubspot -- --dry-run
```

The dry run validates the real workbook sheets and headings, compares them with
the live CRM, and writes a private JSON review report. After resolving conflicts
and unmatched associations, commit explicitly with:

```bash
npm run import:hubspot -- --commit
```

The script requires `NEXT_PUBLIC_SUPABASE_URL` and the server-only
`SUPABASE_SERVICE_ROLE_KEY`. Never expose the latter through a `NEXT_PUBLIC_`
variable or client component. The required live schema is recorded
idempotently in `supabase/hubspot-import-schema.sql`; do not run it
automatically as part of the import.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
