-- Idempotent record of the live schema required by scripts/import-hubspot.ts.
-- These statements reflect the columns and indexes already applied manually.

alter table public.companies
add column if not exists hubspot_id text,
add column if not exists billing_address text,
add column if not exists billing_email text,
add column if not exists billing_notes text,
add column if not exists po_number_required boolean,
add column if not exists imported_from text;

alter table public.contacts
add column if not exists hubspot_id text,
add column if not exists lifecycle_stage text,
add column if not exists lead_status text,
add column if not exists source text,
add column if not exists status text default 'active';

create unique index if not exists companies_hubspot_id_unique
on public.companies (hubspot_id)
where hubspot_id is not null;

create unique index if not exists contacts_hubspot_id_unique
on public.contacts (hubspot_id)
where hubspot_id is not null;

create unique index if not exists contacts_email_lower_unique
on public.contacts (lower(email))
where email is not null and trim(email) <> '';
