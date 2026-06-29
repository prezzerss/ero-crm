import { supabase } from "@/lib/supabase";
import { formatStatus } from "@/lib/format";

export type ReportTable = "clients" | "contacts" | "inbox" | "summary";

type ClientRecord = {
  id: string;
  name?: string | null;
  domain?: string | null;
  sector?: string | null;
  status?: string | null;
  website?: string | null;
  billing_email?: string | null;
  last_contacted_at?: string | null;
  created_at?: string | null;
};

type ContactRecord = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  role?: string | null;
  status?: string | null;
  mailing_status?: string | null;
  company_id?: string | null;
  created_at?: string | null;
  companies?: { name?: string | null } | { name?: string | null }[] | null;
};

type EmailRecord = {
  id: string;
  source_inbox?: string | null;
  from_email?: string | null;
  from_name?: string | null;
  subject?: string | null;
  status?: string | null;
  received_at?: string | null;
  suggested_tags?: string[] | null;
};

type TagJoinRow = {
  company_id?: string | null;
  contact_id?: string | null;
  tags?: { name?: string | null } | { name?: string | null }[] | null;
};

export type ReportingData = {
  clientTags: Map<string, string[]>;
  clients: ClientRecord[];
  contactTags: Map<string, string[]>;
  contacts: ContactRecord[];
  emails: EmailRecord[];
};

function getTagName(tags?: TagJoinRow["tags"]) {
  if (Array.isArray(tags)) {
    return tags[0]?.name?.trim() ?? "";
  }

  return tags?.name?.trim() ?? "";
}

function addTagToMap(map: Map<string, string[]>, id: string | null | undefined, tagName: string) {
  if (!id || !tagName) {
    return;
  }

  const currentTags = map.get(id) ?? [];
  map.set(id, [...currentTags, tagName]);
}

function getCompanyName(contact: ContactRecord) {
  if (Array.isArray(contact.companies)) {
    return contact.companies[0]?.name ?? "";
  }

  return contact.companies?.name ?? "";
}

function getContactName(contact: ContactRecord) {
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim();
}

function csvEscape(value: unknown) {
  const stringValue = value == null ? "" : String(value);

  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function toCsv(headers: string[], rows: unknown[][]) {
  return [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
}

function countBy(values: string[]) {
  return values.reduce((counts, value) => {
    const key = value || "Unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);

    return counts;
  }, new Map<string, number>());
}

export async function getReportingData(): Promise<ReportingData> {
  const [
    { data: clients },
    { data: contacts },
    { data: emails },
    { data: clientTagRows },
    { data: contactTagRows },
  ] = await Promise.all([
    supabase
      .from("companies")
      .select("id, name, domain, sector, status, website, billing_email, last_contacted_at, created_at")
      .order("name"),
    supabase
      .from("contacts")
      .select(`
        id,
        first_name,
        last_name,
        email,
        role,
        status,
        mailing_status,
        company_id,
        created_at,
        companies (
          name
        )
      `)
      .order("first_name"),
    supabase
      .from("inbound_emails")
      .select("id, source_inbox, from_email, from_name, subject, status, received_at, suggested_tags")
      .order("received_at", { ascending: false }),
    supabase
      .from("company_tags")
      .select(`
        company_id,
        tags (
          name
        )
      `),
    supabase
      .from("contact_tags")
      .select(`
        contact_id,
        tags (
          name
        )
      `),
  ]);
  const clientTags = new Map<string, string[]>();
  const contactTags = new Map<string, string[]>();

  ((clientTagRows ?? []) as TagJoinRow[]).forEach((row) => {
    addTagToMap(clientTags, row.company_id, getTagName(row.tags));
  });

  ((contactTagRows ?? []) as TagJoinRow[]).forEach((row) => {
    addTagToMap(contactTags, row.contact_id, getTagName(row.tags));
  });

  return {
    clientTags,
    clients: (clients ?? []) as ClientRecord[],
    contactTags,
    contacts: (contacts ?? []) as ContactRecord[],
    emails: (emails ?? []) as EmailRecord[],
  };
}

export function getSummaryRows(data: ReportingData) {
  const activeClients = data.clients.filter(
    (client) => client.status?.toLowerCase() === "active",
  ).length;
  const activeContacts = data.contacts.filter(
    (contact) => contact.status?.toLowerCase() === "active",
  ).length;
  const mailingContacts = data.contacts.filter(
    (contact) => contact.mailing_status === "subscribed",
  ).length;
  const followUps = data.emails.filter((email) => email.status === "follow_up").length;

  return [
    ["Clients", data.clients.length],
    ["Active clients", activeClients],
    ["Contacts", data.contacts.length],
    ["Active contacts", activeContacts],
    ["Subscribed contacts", mailingContacts],
    ["Inbox items", data.emails.length],
    ["Follow-up inbox items", followUps],
  ];
}

export function buildCsv(table: ReportTable, data: ReportingData) {
  if (table === "clients") {
    return toCsv(
      ["Name", "Domain", "Client type", "Status", "Tags", "Website", "Billing email", "Last contacted", "Created"],
      data.clients.map((client) => [
        client.name,
        client.domain,
        client.sector,
        formatStatus(client.status),
        (data.clientTags.get(client.id) ?? []).join("; "),
        client.website,
        client.billing_email,
        client.last_contacted_at,
        client.created_at,
      ]),
    );
  }

  if (table === "contacts") {
    return toCsv(
      ["Name", "Email", "Role", "Client", "Status", "Mailing status", "Tags", "Created"],
      data.contacts.map((contact) => [
        getContactName(contact),
        contact.email,
        contact.role,
        getCompanyName(contact),
        formatStatus(contact.status),
        formatStatus(contact.mailing_status, "Unknown"),
        (data.contactTags.get(contact.id) ?? []).join("; "),
        contact.created_at,
      ]),
    );
  }

  if (table === "inbox") {
    return toCsv(
      ["Source", "From name", "From email", "Subject", "Status", "Tags", "Received"],
      data.emails.map((email) => [
        email.source_inbox,
        email.from_name,
        email.from_email,
        email.subject,
        formatStatus(email.status, "Needs review"),
        (email.suggested_tags ?? []).join("; "),
        email.received_at,
      ]),
    );
  }

  return toCsv(["Metric", "Value"], getSummaryRows(data));
}

export function getStatusBreakdown(values: string[]) {
  return Array.from(countBy(values).entries()).sort(([first], [second]) =>
    first.localeCompare(second),
  );
}

export function getTopTags(tagMap: Map<string, string[]>) {
  return Array.from(countBy(Array.from(tagMap.values()).flat()).entries())
    .sort(([, firstCount], [, secondCount]) => secondCount - firstCount)
    .slice(0, 8);
}
