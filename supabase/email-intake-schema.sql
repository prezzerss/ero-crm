alter table contacts
add column if not exists last_contacted_at timestamptz;

create table if not exists inbound_emails (
  id uuid primary key default gen_random_uuid(),
  source_inbox text not null,
  graph_message_id text,
  internet_message_id text,
  conversation_id text,
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
  to_recipients text[] not null default '{}',
  cc_recipients text[] not null default '{}',
  notes text,
  raw_graph jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint inbound_emails_source_inbox_check
    check (source_inbox in ('projects', 'quotes', 'enquiries')),
  constraint inbound_emails_status_check
    check (status in ('new', 'reviewing', 'follow_up', 'linked', 'ignored'))
);

alter table inbound_emails
add column if not exists job_number text,
add column if not exists thread_subject text,
add column if not exists graph_message_id text,
add column if not exists internet_message_id text,
add column if not exists conversation_id text,
add column if not exists to_recipients text[] not null default '{}',
add column if not exists cc_recipients text[] not null default '{}',
add column if not exists raw_graph jsonb;

create table if not exists inbox_sync_state (
  source_inbox text primary key,
  mailbox_address text not null,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint inbox_sync_state_source_inbox_check
    check (source_inbox in ('projects', 'quotes', 'enquiries'))
);

create unique index if not exists inbound_emails_source_graph_message_uidx
on inbound_emails (source_inbox, graph_message_id)
where graph_message_id is not null;

create index if not exists inbound_emails_conversation_id_idx
on inbound_emails (conversation_id);

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
