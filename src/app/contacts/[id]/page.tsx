import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { formatStatus } from "@/lib/format";
import { linkInboxItemToContact } from "@/app/emails/actions";
import { updateContactNotes } from "../actions";

type CompanyRecord = {
  id?: string | null;
  name?: string | null;
};

type ContactRecord = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  role?: string | null;
  status?: string | null;
  source_inbox?: string | null;
  source?: string | null;
  source_email?: string | null;
  mailing_status?: string | null;
  notes?: string | null;
  created_at?: string | null;
  companies?: CompanyRecord | CompanyRecord[] | null;
};

type InboxItemRecord = {
  conversation_id?: string | null;
  from_email?: string | null;
  from_name?: string | null;
  id: string;
  snippet?: string | null;
  subject?: string | null;
  source_inbox?: string | null;
  status?: string | null;
  job_number?: string | null;
  thread_subject?: string | null;
  contact_id?: string | null;
  company_id?: string | null;
  received_at?: string | null;
};

type MailingListRecord = {
  id?: string | null;
  name?: string | null;
  status?: string | null;
};

type MailingListMemberRecord = {
  mailing_lists?: MailingListRecord | MailingListRecord[] | null;
};

type ContactPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type InboxThreadGroup = {
  count: number;
  href: string | null;
  items: InboxItemRecord[];
  key: string;
  label: string;
  latest?: string | null;
};

function getCompany(contact: ContactRecord) {
  if (Array.isArray(contact.companies)) {
    return contact.companies[0] ?? null;
  }

  return contact.companies ?? null;
}

function getFullName(contact: ContactRecord) {
  const name = [contact.first_name, contact.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return name || contact.email || "Unnamed contact";
}

function getSourceLabel(contactOrSource: ContactRecord | string | null | undefined) {
  const source =
    typeof contactOrSource === "string"
      ? contactOrSource
      : contactOrSource?.source_inbox ?? contactOrSource?.source ?? contactOrSource?.source_email ?? "manual";

  if (source.includes("project")) {
    return "projects@";
  }

  if (source.includes("quote")) {
    return "quotes@";
  }

  if (source.includes("enquir") || source.includes("inquir")) {
    return "enquiries@";
  }

  return "Manual entry";
}

function getMailingLabel(contact: ContactRecord) {
  return formatStatus(contact.mailing_status, "Unknown");
}

function getMailingList(row: MailingListMemberRecord) {
  if (Array.isArray(row.mailing_lists)) {
    return row.mailing_lists[0] ?? null;
  }

  return row.mailing_lists ?? null;
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getThreadLabel(item: InboxItemRecord) {
  if (item.job_number && item.thread_subject) {
    return `${item.job_number} / ${item.thread_subject}`;
  }

  if (item.job_number) {
    return item.job_number;
  }

  if (item.thread_subject) {
    return item.thread_subject;
  }

  return item.source_inbox === "projects" ? "No job number" : "-";
}

function getThreadKey(item: InboxItemRecord) {
  return item.conversation_id || item.job_number || item.thread_subject || item.subject || item.id;
}

function getThreadHref(item: InboxItemRecord) {
  if (!item.source_inbox) {
    return null;
  }

  return `/inbox/${item.source_inbox}/thread/${encodeURIComponent(getThreadKey(item))}`;
}

function buildMailtoHref(email: string, name: string) {
  const subject = `Following up from Easy Read Online`;
  const body = `Hi ${name.split(" ")[0] || ""},`;

  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function buildInboxThreadGroups(items: InboxItemRecord[]) {
  const groups = items.reduce((threadGroups, item) => {
    const key = getThreadKey(item);
    const label = getThreadLabel(item) === "-" ? item.subject || "Inbox thread" : getThreadLabel(item);
    const existingGroup = threadGroups.get(key);
    const group: InboxThreadGroup = existingGroup ?? {
      count: 0,
      href: getThreadHref(item),
      items: [],
      key,
      label,
      latest: item.received_at,
    };

    group.count += 1;
    group.items.push(item);

    if (item.received_at && (!group.latest || new Date(item.received_at) > new Date(group.latest))) {
      group.latest = item.received_at;
      group.href = getThreadHref(item);
    }

    threadGroups.set(key, group);

    return threadGroups;
  }, new Map<string, InboxThreadGroup>());

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      items: group.items.sort(
        (a, b) => new Date(b.received_at ?? 0).getTime() - new Date(a.received_at ?? 0).getTime(),
      ),
    }))
    .sort((a, b) => new Date(b.latest ?? 0).getTime() - new Date(a.latest ?? 0).getTime());
}

export default async function ContactDetailPage({ params }: ContactPageProps) {
  const { id } = await params;

  const { data: contact } = await supabase
    .from("contacts")
    .select(`
      *,
      companies (
        id,
        name
      )
    `)
    .eq("id", id)
    .single();

  if (!contact) {
    notFound();
  }

  const typedContact = contact as ContactRecord;
  const company = getCompany(typedContact);
  const [{ data: inboxItems }, { data: allInboxItems }, { data: listRows }] =
    await Promise.all([
    supabase
      .from("inbound_emails")
      .select("*")
      .eq("contact_id", id)
      .order("received_at", { ascending: false })
      .limit(80),
    supabase
      .from("inbound_emails")
      .select("*")
      .order("received_at", { ascending: false })
      .limit(60),
    supabase
      .from("mailing_list_contacts")
      .select(`
        mailing_lists (
          id,
          name,
          status
        )
      `)
      .eq("contact_id", id),
  ]);
  const mailingLists = ((listRows ?? []) as MailingListMemberRecord[])
    .map((row) => getMailingList(row))
    .filter((list): list is MailingListRecord => Boolean(list));
  const inbox = (inboxItems ?? []) as InboxItemRecord[];
  const inboxThreadGroups = buildInboxThreadGroups(inbox);
  const linkableInboxItems = ((allInboxItems ?? []) as InboxItemRecord[]).filter(
    (item) => item.contact_id !== id,
  );
  const contactName = getFullName(typedContact);

  return (
    <div className="grid gap-8">
      <header className="crm-detail-hero p-6 md:p-8">
        <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/contacts" className="font-bold underline">
              Back to contacts
            </Link>

            <h1 className="crm-page-title mt-4">{contactName}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="crm-status-pill">{formatStatus(typedContact.status)}</span>
              <span className="crm-status-pill crm-status-pill-yellow">
                {getMailingLabel(typedContact)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {typedContact.email && (
              <a className="crm-button" href={buildMailtoHref(typedContact.email, contactName)}>
                Email contact
              </a>
            )}

            <Link className="crm-button crm-button-primary" href={`/contacts/${id}/edit`}>
              Edit contact
            </Link>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="crm-card crm-kpi p-5">
          <p className="crm-muted font-bold">Client</p>
          <p className="mt-2 text-xl font-black">
            {company?.id ? (
              <Link href={`/companies/${company.id}`} className="underline">
                {company.name}
              </Link>
            ) : (
              "No client"
            )}
          </p>
        </div>

        <div className="crm-card crm-kpi crm-kpi-orange p-5">
          <p className="crm-muted font-bold">Source</p>
          <p className="mt-2 text-xl font-black">{getSourceLabel(typedContact)}</p>
        </div>

        <div className="crm-card crm-kpi crm-kpi-yellow p-5">
          <p className="crm-muted font-bold">Lists</p>
          <p className="mt-2 text-3xl font-black">{mailingLists.length}</p>
        </div>

        <div className="crm-card crm-kpi p-5">
          <p className="crm-muted font-bold">Inbox items</p>
          <p className="mt-2 text-3xl font-black">{inbox.length}</p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="crm-card p-6">
          <h2 className="crm-section-title">Contact details</h2>
          <div className="crm-info-grid mt-5">
            <div className="crm-info-row">
              <span className="crm-info-label">Email:</span>
              <span className="crm-info-value">
                {typedContact.email ? (
                  <a href={`mailto:${typedContact.email}`} className="underline">
                    {typedContact.email}
                  </a>
                ) : (
                  "No email"
                )}
              </span>
            </div>
            <div className="crm-info-row">
              <span className="crm-info-label">Role:</span>
              <span className="crm-info-value">{typedContact.role || "-"}</span>
            </div>
            <div className="crm-info-row">
              <span className="crm-info-label">Added:</span>
              <span className="crm-info-value">{formatDate(typedContact.created_at)}</span>
            </div>
          </div>
        </div>

        <div className="crm-card p-6">
          <h2 className="crm-section-title">Notes</h2>
          <form action={updateContactNotes.bind(null, id)} className="mt-5 grid gap-3">
            <label className="grid gap-2 font-bold">
              <span>Notes</span>
              <textarea
                className="crm-input min-h-32"
                defaultValue={typedContact.notes ?? ""}
                name="notes"
                placeholder="Preferences, follow-up context, project notes..."
              />
            </label>

            <button className="crm-button w-fit" type="submit">
              Save notes
            </button>
          </form>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="crm-card p-6">
          <h2 className="crm-section-title">Mailing lists</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {mailingLists.map((list) => (
              <Link
                className="crm-status-pill"
                href={`/mailing-lists/${list.id}`}
                key={list.id}
              >
                {list.name}
              </Link>
            ))}

            {!mailingLists.length && <p className="crm-empty">No mailing lists yet.</p>}
          </div>
        </div>

        <section className="crm-card overflow-hidden">
          <div className="grid gap-4 border-b border-[var(--border-soft)] p-5">
            <h2 className="crm-section-title">Inbox items</h2>

            <form
              action={linkInboxItemToContact.bind(null, id)}
              className="grid gap-3 md:grid-cols-[1fr_auto]"
            >
              {company?.id && <input name="company_id" type="hidden" value={company.id} />}
              <select className="crm-input" name="email_id" required>
                <option value="">Link inbox item</option>
                {linkableInboxItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {getSourceLabel(item.source_inbox)} - {getThreadLabel(item)} -{" "}
                    {item.subject || "No subject"}
                  </option>
                ))}
              </select>

              <button className="crm-button crm-button-primary" type="submit">
                Link item
              </button>
            </form>
          </div>
          <div className="grid gap-4 p-5">
            {inboxThreadGroups.map((group) => (
              <article className="crm-thread-group" key={group.key}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black">{group.label}</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="crm-status-pill">{group.count} messages</span>
                      <span className="crm-status-pill crm-status-pill-yellow">
                        Latest {formatDate(group.latest)}
                      </span>
                    </div>
                  </div>

                  {group.href && (
                    <Link className="crm-button" href={group.href}>
                      View thread
                    </Link>
                  )}
                </div>

                <div className="mt-4 grid gap-3">
                  {group.items.map((item) => (
                    <div className="crm-thread-preview" key={item.id}>
                      <div className="min-w-0">
                        <Link className="font-bold underline" href={`/inbox/message/${item.id}`}>
                          {item.subject || "No subject"}
                        </Link>
                        <p className="crm-muted mt-1 text-sm">
                          {getSourceLabel(item.source_inbox)} / {formatDate(item.received_at)}
                        </p>
                      </div>
                      <span className="crm-status-pill">{formatStatus(item.status, "Needs review")}</span>
                    </div>
                  ))}
                </div>
              </article>
            ))}

            {!inboxThreadGroups.length && (
              <p className="crm-empty">No linked inbox items.</p>
            )}
          </div>
        </section>
      </section>
    </div>
  );
}
