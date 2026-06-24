create extension if not exists pgcrypto;

alter table companies
add column if not exists billing_contact_name text,
add column if not exists billing_email text,
add column if not exists billing_address text,
add column if not exists updated_at timestamptz default now();

alter table contacts
add column if not exists source_inbox text default 'manual',
add column if not exists mailing_status text default 'unknown',
add column if not exists notes text,
add column if not exists last_contacted_at timestamptz,
add column if not exists updated_at timestamptz default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'contacts_source_inbox_check'
  ) then
    alter table contacts
    add constraint contacts_source_inbox_check
    check (source_inbox in ('projects', 'quotes', 'enquiries', 'manual'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'contacts_mailing_status_check'
  ) then
    alter table contacts
    add constraint contacts_mailing_status_check
    check (mailing_status in ('unknown', 'subscribed', 'unsubscribed', 'do_not_contact'));
  end if;
end $$;

create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text,
  created_at timestamptz default now()
);

create table if not exists contact_tags (
  contact_id uuid references contacts(id) on delete cascade,
  tag_id uuid references tags(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (contact_id, tag_id)
);

create table if not exists mailing_lists (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  status text not null default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint mailing_lists_status_check
    check (status in ('active', 'paused', 'archived'))
);

create table if not exists mailing_list_contacts (
  mailing_list_id uuid references mailing_lists(id) on delete cascade,
  contact_id uuid references contacts(id) on delete cascade,
  added_at timestamptz default now(),
  primary key (mailing_list_id, contact_id)
);

create index if not exists mailing_list_contacts_contact_id_idx
on mailing_list_contacts (contact_id);

insert into tags (name, color) values
('client', '#01979d'),
('prospect', '#f7a823'),
('quote follow-up', '#e94e1b'),
('mailing list', '#166534'),
('do not contact', '#b00020')
on conflict (name) do nothing;
