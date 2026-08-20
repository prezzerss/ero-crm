-- Trello project linking, company preferences, and dedicated quoting contacts.
-- Safe to run more than once in the Supabase SQL editor.

create extension if not exists pgcrypto;

alter table public.companies
add column if not exists preferences text,
add column if not exists preferences_reviewed_at timestamptz;

alter table public.contacts
add column if not exists contact_type text not null default 'general',
add column if not exists is_default_quoting_contact boolean not null default false,
add column if not exists updated_at timestamptz not null default now();

-- Some CRM databases already have a free-text contact_type column. Preserve an
-- unrecognised legacy value as the contact's role when that field is empty,
-- then convert the category to one of the three controlled values used here.
update public.contacts
set role = trim(contact_type)
where contact_type is not null
  and trim(contact_type) <> ''
  and regexp_replace(lower(trim(contact_type)), '[^a-z]+', '', 'g') not in (
    'general',
    'quote',
    'quotes',
    'quoting',
    'quotation',
    'quotations',
    'estimate',
    'estimates',
    'invoice',
    'invoices',
    'invoicing',
    'billing',
    'accounts',
    'accountspayable',
    'finance'
  )
  and coalesce(trim(role), '') = '';

update public.contacts
set contact_type = case
  when regexp_replace(lower(trim(coalesce(contact_type, ''))), '[^a-z]+', '', 'g') in (
    'quote',
    'quotes',
    'quoting',
    'quotation',
    'quotations',
    'estimate',
    'estimates'
  ) then 'quoting'
  when regexp_replace(lower(trim(coalesce(contact_type, ''))), '[^a-z]+', '', 'g') in (
    'invoice',
    'invoices',
    'invoicing',
    'billing',
    'accounts',
    'accountspayable',
    'finance'
  ) then 'invoicing'
  else 'general'
end
where contact_type is null
   or contact_type not in ('general', 'quoting', 'invoicing');

-- Do not let incomplete legacy records prevent the new constraints from being
-- installed. They remain available as General contacts and can be completed
-- and changed to Quoting in the CRM afterwards.
update public.contacts
set
  contact_type = 'general',
  is_default_quoting_contact = false
where contact_type = 'quoting'
  and (
    (
      coalesce(trim(first_name), '') = ''
      and coalesce(trim(last_name), '') = ''
    )
    or company_id is null
    or coalesce(trim(email), '') = ''
  );

update public.contacts
set is_default_quoting_contact = false
where contact_type <> 'quoting'
  and is_default_quoting_contact;

update public.contacts
set is_default_quoting_contact = false
where is_default_quoting_contact is null;

alter table public.contacts
alter column contact_type set default 'general',
alter column contact_type set not null,
alter column is_default_quoting_contact set default false,
alter column is_default_quoting_contact set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'contacts_contact_type_check'
  ) then
    alter table public.contacts
    add constraint contacts_contact_type_check
    check (contact_type in ('general', 'quoting', 'invoicing'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'contacts_quoting_details_check'
  ) then
    alter table public.contacts
    add constraint contacts_quoting_details_check
    check (
      contact_type <> 'quoting'
      or (
        (
          coalesce(trim(first_name), '') <> ''
          or coalesce(trim(last_name), '') <> ''
        )
        and
        company_id is not null
        and email is not null
        and trim(email) <> ''
      )
    );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'contacts_default_quoting_type_check'
  ) then
    alter table public.contacts
    add constraint contacts_default_quoting_type_check
    check (not is_default_quoting_contact or contact_type = 'quoting');
  end if;
end $$;

create unique index if not exists contacts_one_default_quoting_per_company_uidx
on public.contacts (company_id)
where contact_type = 'quoting' and is_default_quoting_contact;

create index if not exists contacts_company_contact_type_idx
on public.contacts (company_id, contact_type);

create or replace function public.clear_other_default_quoting_contacts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.contact_type = 'quoting' and new.is_default_quoting_contact then
    update public.contacts
    set
      is_default_quoting_contact = false,
      updated_at = now()
    where company_id = new.company_id
      and id <> new.id
      and contact_type = 'quoting'
      and is_default_quoting_contact;
  end if;

  return new;
end;
$$;

drop trigger if exists contacts_clear_other_default_quoting_contacts on public.contacts;

create trigger contacts_clear_other_default_quoting_contacts
before insert or update of company_id, contact_type, is_default_quoting_contact
on public.contacts
for each row
execute function public.clear_other_default_quoting_contacts();

create table if not exists public.crm_job_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_job_types_name_check check (trim(name) <> '')
);

create unique index if not exists crm_job_types_name_lower_uidx
on public.crm_job_types (lower(name));

insert into public.crm_job_types (name)
values
  ('Meeting minutes'),
  ('Other')
on conflict do nothing;

create table if not exists public.crm_projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_type_id uuid not null references public.crm_job_types(id) on delete restrict,
  job_number text not null,
  title text not null,
  trello_card_key text not null,
  trello_card_url text not null,
  trello_status text,
  started_at date,
  completed_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_projects_job_number_check check (trim(job_number) <> ''),
  constraint crm_projects_title_check check (trim(title) <> ''),
  constraint crm_projects_trello_card_key_check check (trim(trello_card_key) <> ''),
  constraint crm_projects_trello_card_url_check
    check (trello_card_url ~* '^https://trello\.com/c/')
);

create unique index if not exists crm_projects_job_number_uidx
on public.crm_projects (lower(job_number));

create unique index if not exists crm_projects_trello_card_key_uidx
on public.crm_projects (trello_card_key);

create index if not exists crm_projects_company_job_type_idx
on public.crm_projects (company_id, job_type_id, created_at desc);

create or replace function public.set_crm_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists crm_job_types_set_updated_at on public.crm_job_types;
create trigger crm_job_types_set_updated_at
before update on public.crm_job_types
for each row execute function public.set_crm_updated_at();

drop trigger if exists crm_projects_set_updated_at on public.crm_projects;
create trigger crm_projects_set_updated_at
before update on public.crm_projects
for each row execute function public.set_crm_updated_at();

alter table public.crm_job_types enable row level security;
alter table public.crm_projects enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'crm_job_types'
      and policyname = 'Authenticated users can read job types'
  ) then
    create policy "Authenticated users can read job types"
    on public.crm_job_types for select
    to authenticated
    using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'crm_job_types'
      and policyname = 'Authenticated users can manage job types'
  ) then
    create policy "Authenticated users can manage job types"
    on public.crm_job_types for all
    to authenticated
    using (true)
    with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'crm_projects'
      and policyname = 'Authenticated users can read CRM projects'
  ) then
    create policy "Authenticated users can read CRM projects"
    on public.crm_projects for select
    to authenticated
    using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'crm_projects'
      and policyname = 'Authenticated users can manage CRM projects'
  ) then
    create policy "Authenticated users can manage CRM projects"
    on public.crm_projects for all
    to authenticated
    using (true)
    with check (true);
  end if;
end $$;

grant select, insert, update, delete on public.crm_job_types to authenticated;
grant select, insert, update, delete on public.crm_projects to authenticated;
grant all on public.crm_job_types to service_role;
grant all on public.crm_projects to service_role;
