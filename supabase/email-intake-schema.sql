alter table contacts
add column if not exists last_contacted_at timestamptz;

create table if not exists inbound_emails (
  id uuid primary key default gen_random_uuid(),
  source_inbox text not null,
  from_email text,
  from_name text,
  subject text,
  snippet text,
  body text,
  job_number text,
  thread_subject text,
  received_at timestamptz default now(),
  status text not null default 'new',
  contact_id uuid references contacts(id) on delete set null,
  company_id uuid references companies(id) on delete set null,
  suggested_tags text[] not null default '{}',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint inbound_emails_source_inbox_check
    check (source_inbox in ('projects', 'quotes', 'enquiries')),
  constraint inbound_emails_status_check
    check (status in ('new', 'reviewing', 'follow_up', 'linked', 'ignored'))
);

alter table inbound_emails
add column if not exists job_number text,
add column if not exists thread_subject text;

create index if not exists inbound_emails_source_inbox_idx
on inbound_emails (source_inbox);

create index if not exists inbound_emails_status_idx
on inbound_emails (status);

create index if not exists inbound_emails_received_at_idx
on inbound_emails (received_at desc);

create index if not exists inbound_emails_job_number_idx
on inbound_emails (job_number);

create index if not exists inbound_emails_thread_subject_idx
on inbound_emails (thread_subject);

create index if not exists inbound_emails_contact_id_idx
on inbound_emails (contact_id);

create index if not exists inbound_emails_company_id_idx
on inbound_emails (company_id);
