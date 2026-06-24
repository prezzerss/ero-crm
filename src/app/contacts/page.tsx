import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatStatus } from "@/lib/format";

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
  created_at?: string | null;
  companies?: CompanyRecord | CompanyRecord[] | null;
  [key: string]: unknown;
};

type ContactTagRow = {
  contact_id?: string | null;
  tags?: unknown;
};

type ContactsPageProps = {
  searchParams: Promise<{
    q?: string;
    source?: string;
    status?: string;
    mailing?: string;
  }>;
};

const sourceOptions = [
  { value: "all", label: "All sources" },
  { value: "projects", label: "projects@" },
  { value: "quotes", label: "quotes@" },
  { value: "enquiries", label: "enquiries@" },
  { value: "manual", label: "Manual" },
];

const mailingOptions = [
  { value: "all", label: "All mailing" },
  { value: "yes", label: "On list" },
  { value: "no", label: "No list" },
  { value: "unknown", label: "Unknown" },
];

function readString(contact: ContactRecord, keys: string[]) {
  for (const key of keys) {
    const value = contact[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function readBoolean(contact: ContactRecord, keys: string[]) {
  for (const key of keys) {
    const value = contact[key];

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      const normalizedValue = value.trim().toLowerCase();

      if (["true", "yes", "y", "1", "opted in", "subscribed"].includes(normalizedValue)) {
        return true;
      }

      if (["false", "no", "n", "0", "opted out", "unsubscribed"].includes(normalizedValue)) {
        return false;
      }
    }
  }

  return null;
}

function getCompany(contact: ContactRecord) {
  if (Array.isArray(contact.companies)) {
    return contact.companies[0] ?? null;
  }

  return contact.companies ?? null;
}

function getCompanyName(contact: ContactRecord) {
  return getCompany(contact)?.name?.trim() || "No company";
}

function getFullName(contact: ContactRecord) {
  const name = [contact.first_name, contact.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return name || contact.email || "Unnamed contact";
}

function getStatus(contact: ContactRecord) {
  return contact.status?.trim() || "active";
}

function getSourceInbox(contact: ContactRecord) {
  const source = readString(contact, [
    "source_inbox",
    "source_email",
    "source",
    "origin",
    "lead_source",
  ]);

  const normalizedSource = source.toLowerCase();

  if (normalizedSource.includes("project")) {
    return "projects@";
  }

  if (normalizedSource.includes("quote")) {
    return "quotes@";
  }

  if (normalizedSource.includes("enquir") || normalizedSource.includes("inquir")) {
    return "enquiries@";
  }

  return source || "Manual entry";
}

function getSourceKey(contact: ContactRecord) {
  const source = getSourceInbox(contact).toLowerCase();

  if (source.includes("project")) {
    return "projects";
  }

  if (source.includes("quote")) {
    return "quotes";
  }

  if (source.includes("enquir") || source.includes("inquir")) {
    return "enquiries";
  }

  return "manual";
}

function getTags(contact: ContactRecord) {
  const rawTags =
    contact.tags ??
    contact.tag_names ??
    contact.contact_tags ??
    contact.mailing_lists ??
    contact.lists;

  if (Array.isArray(rawTags)) {
    return rawTags
      .map((tag) => getTagName(tag))
      .filter(Boolean);
  }

  if (typeof rawTags === "string") {
    return rawTags
      .split(/[,;|]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [];
}

function getTagName(tag: unknown): string {
  if (typeof tag === "string") {
    return tag.trim();
  }

  if (!tag || typeof tag !== "object") {
    return "";
  }

  const tagRecord = tag as Record<string, unknown>;

  if (typeof tagRecord.name === "string") {
    return tagRecord.name.trim();
  }

  if (Array.isArray(tagRecord.tags)) {
    return getTagName(tagRecord.tags[0]);
  }

  return getTagName(tagRecord.tags);
}

function getMailingStatus(contact: ContactRecord) {
  const explicitStatus = readBoolean(contact, [
    "mailing_list",
    "mailing_opt_in",
    "marketing_opt_in",
    "newsletter_opt_in",
    "subscribed",
  ]);

  if (explicitStatus === true) {
    return { key: "yes", label: "On mailing list" };
  }

  if (explicitStatus === false) {
    return { key: "no", label: "Not on list" };
  }

  const tagText = getTags(contact).join(" ").toLowerCase();

  if (tagText.includes("mailing") || tagText.includes("newsletter")) {
    return { key: "yes", label: "On mailing list" };
  }

  return { key: "unknown", label: "Unknown" };
}

function formatCreatedDate(contact: ContactRecord) {
  if (!contact.created_at) {
    return "—";
  }

  const date = new Date(contact.created_at);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function matchesQuery(contact: ContactRecord, query: string) {
  if (!query) {
    return true;
  }

  const haystack = [
    getFullName(contact),
    contact.email,
    contact.role,
    getCompanyName(contact),
    getStatus(contact),
    getSourceInbox(contact),
    getTags(contact).join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

export default async function ContactsPage({ searchParams }: ContactsPageProps) {
  const params = await searchParams;
  const query = params.q?.trim().toLowerCase() ?? "";
  const selectedSource = params.source ?? "all";
  const selectedStatus = params.status ?? "all";
  const selectedMailing = params.mailing ?? "all";

  const { data, error } = await supabase
    .from("contacts")
    .select(`
      *,
      companies (
        id,
        name
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div>
        <h1 className="crm-page-title">Contacts</h1>
        <p className="text-red-600 mt-4">Error loading contacts.</p>
      </div>
    );
  }

  const baseContacts = (data ?? []) as ContactRecord[];
  const contactTagsByContactId = new Map<string, string[]>();

  if (baseContacts.length) {
    const { data: contactTagRows } = await supabase
      .from("contact_tags")
      .select(`
        contact_id,
        tags (
          name
        )
      `)
      .in(
        "contact_id",
        baseContacts.map((contact) => contact.id),
      );

    ((contactTagRows ?? []) as ContactTagRow[]).forEach((tagRow) => {
      if (!tagRow.contact_id) {
        return;
      }

      const tagName = getTagName(tagRow.tags);

      if (!tagName) {
        return;
      }

      const currentTags = contactTagsByContactId.get(tagRow.contact_id) ?? [];
      contactTagsByContactId.set(tagRow.contact_id, [...currentTags, tagName]);
    });
  }

  const contacts = baseContacts.map((contact) => ({
    ...contact,
    contact_tags: contactTagsByContactId.get(contact.id) ?? contact.contact_tags,
  }));
  const statusOptions = Array.from(
    new Set(contacts.map((contact) => getStatus(contact).toLowerCase())),
  ).sort();

  const filteredContacts = contacts.filter((contact) => {
    const mailingStatus = getMailingStatus(contact).key;

    return (
      matchesQuery(contact, query) &&
      (selectedSource === "all" || getSourceKey(contact) === selectedSource) &&
      (selectedStatus === "all" || getStatus(contact).toLowerCase() === selectedStatus) &&
      (selectedMailing === "all" || mailingStatus === selectedMailing)
    );
  });

  const mailingCount = contacts.filter(
    (contact) => getMailingStatus(contact).key === "yes",
  ).length;
  const projectsCount = contacts.filter((contact) => getSourceKey(contact) === "projects").length;
  const quotesCount = contacts.filter((contact) => getSourceKey(contact) === "quotes").length;
  const enquiriesCount = contacts.filter(
    (contact) => getSourceKey(contact) === "enquiries",
  ).length;
  const hasActiveFilters =
    Boolean(query) ||
    selectedSource !== "all" ||
    selectedStatus !== "all" ||
    selectedMailing !== "all";

  return (
    <div className="grid gap-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="crm-page-title">Contacts</h1>
        </div>

        <Link href="/contacts/new" className="crm-button crm-button-primary">
          Add contact
        </Link>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="crm-card crm-kpi p-5">
          <p className="crm-muted font-bold">Total contacts</p>
          <p className="mt-2 text-3xl font-black">{contacts.length}</p>
        </div>

        <div className="crm-card crm-kpi crm-kpi-yellow p-5">
          <p className="crm-muted font-bold">Mailing list</p>
          <p className="mt-2 text-3xl font-black">{mailingCount}</p>
        </div>

        <div className="crm-card crm-kpi crm-kpi-orange p-5">
          <p className="crm-muted font-bold">Quote leads</p>
          <p className="mt-2 text-3xl font-black">{quotesCount}</p>
        </div>

        <div className="crm-card crm-kpi p-5">
          <p className="crm-muted font-bold">Project contacts</p>
          <p className="mt-2 text-3xl font-black">{projectsCount + enquiriesCount}</p>
        </div>
      </section>

      <section className="crm-card overflow-hidden">
        <form
          action="/contacts"
          className="grid gap-3 border-b border-gray-200 p-4 lg:grid-cols-[minmax(220px,1fr)_180px_160px_170px_auto]"
        >
          <input
            className="crm-input"
            defaultValue={params.q ?? ""}
            name="q"
            placeholder="Search name, email, company, tag..."
          />

          <select className="crm-input" defaultValue={selectedSource} name="source">
            {sourceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select className="crm-input" defaultValue={selectedStatus} name="status">
            <option value="all">All statuses</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {formatStatus(status)}
              </option>
            ))}
          </select>

          <select className="crm-input" defaultValue={selectedMailing} name="mailing">
            {mailingOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <button className="crm-button crm-button-primary min-w-24" type="submit">
              Filter
            </button>

            {hasActiveFilters && (
              <Link className="crm-button" href="/contacts">
                Clear
              </Link>
            )}
          </div>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
          <p className="crm-muted font-bold">
            Showing {filteredContacts.length} of {contacts.length}
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="crm-status-pill">projects@ {projectsCount}</span>
            <span className="crm-status-pill">quotes@ {quotesCount}</span>
            <span className="crm-status-pill">enquiries@ {enquiriesCount}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Company</th>
                <th>Source</th>
                <th>Tags / lists</th>
                <th>Status</th>
                <th>Added</th>
              </tr>
            </thead>

            <tbody>
              {filteredContacts.map((contact) => {
                const company = getCompany(contact);
                const tags = getTags(contact);
                const mailingStatus = getMailingStatus(contact);

                return (
                  <tr key={contact.id} className="hover:bg-gray-50">
                    <td>
                      <div className="grid gap-1">
                        <Link href={`/contacts/${contact.id}`} className="font-bold underline">
                          {getFullName(contact)}
                        </Link>
                        {contact.email ? (
                          <a href={`mailto:${contact.email}`} className="crm-muted underline">
                            {contact.email}
                          </a>
                        ) : (
                          <span className="crm-muted">No email</span>
                        )}
                        {contact.role && (
                          <span className="crm-muted text-sm">{contact.role}</span>
                        )}
                      </div>
                    </td>

                    <td>
                      {company?.id ? (
                        <Link href={`/companies/${company.id}`} className="font-bold underline">
                          {getCompanyName(contact)}
                        </Link>
                      ) : (
                        getCompanyName(contact)
                      )}
                    </td>

                    <td>
                      <span className="crm-status-pill">{getSourceInbox(contact)}</span>
                    </td>

                    <td>
                      <div className="flex max-w-sm flex-wrap gap-2">
                        <span className="crm-status-pill">{mailingStatus.label}</span>
                        {tags.slice(0, 4).map((tag) => (
                          <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-bold" key={tag}>
                            {tag}
                          </span>
                        ))}
                        {tags.length > 4 && (
                          <span className="crm-muted text-sm font-bold">
                            +{tags.length - 4} more
                          </span>
                        )}
                      </div>
                    </td>

                    <td>
                      <span className="crm-status-pill">{formatStatus(getStatus(contact))}</span>
                    </td>

                    <td>{formatCreatedDate(contact)}</td>
                  </tr>
                );
              })}

              {!filteredContacts.length && (
                <tr>
                  <td colSpan={6}>No contacts match these filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
