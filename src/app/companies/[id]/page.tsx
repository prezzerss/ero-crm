import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyTextButton } from "@/app/_components/copy-text-button";
import { supabase } from "@/lib/supabase";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { formatContactType } from "@/lib/contact-types";
import { formatStatus } from "@/lib/format";
import { linkInboxItemToCompany } from "@/app/emails/actions";
import { updateCompanyPreferences } from "../actions";

type ContactRecord = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  role?: string | null;
  status?: string | null;
  contact_type?: string | null;
  is_default_quoting_contact?: boolean | null;
};

type JobTypeRecord = {
  id?: string | null;
  name?: string | null;
};

type ProjectRecord = {
  id: string;
  job_number?: string | null;
  title?: string | null;
  trello_card_url?: string | null;
  trello_status?: string | null;
  created_at?: string | null;
  crm_job_types?: JobTypeRecord | JobTypeRecord[] | null;
};

type CompanyPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type InboxItemRecord = {
  id: string;
  subject?: string | null;
  source_inbox?: string | null;
  status?: string | null;
  job_number?: string | null;
  thread_subject?: string | null;
  company_id?: string | null;
  received_at?: string | null;
};

function getSourceLabel(source?: string | null) {
  if (source === "projects") {
    return "projects@";
  }

  if (source === "quotes") {
    return "quotes@";
  }

  if (source === "enquiries") {
    return "enquiries@";
  }

  return "Inbox";
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

function getContactName(contact: ContactRecord) {
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim() || contact.email || "Unnamed contact";
}

function getProjectJobType(project: ProjectRecord) {
  return Array.isArray(project.crm_job_types)
    ? project.crm_job_types[0]?.name ?? null
    : project.crm_job_types?.name ?? null;
}

export default async function CompanyDetailPage({ params }: CompanyPageProps) {
  const { id } = await params;

  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .single();

  if (!company) {
    notFound();
  }

  const authenticatedSupabase = await createServerSupabaseClient();
  const [
    { data: contacts },
    { data: companyInboxItems },
    { data: allInboxItems },
    { data: projectRows },
  ] = await Promise.all([
    supabase
      .from("contacts")
      .select("*")
      .eq("company_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("inbound_emails")
      .select("*")
      .eq("company_id", id)
      .order("received_at", { ascending: false })
      .limit(8),
    supabase
      .from("inbound_emails")
      .select("*")
      .order("received_at", { ascending: false })
      .limit(60),
    authenticatedSupabase
      .from("crm_projects")
      .select(`
        id,
        job_number,
        title,
        trello_card_url,
        trello_status,
        created_at,
        crm_job_types (id, name)
      `)
      .eq("company_id", id)
      .order("created_at", { ascending: false }),
  ]);
  const companyContacts = (contacts ?? []) as ContactRecord[];
  const quotingContacts = companyContacts.filter((contact) => contact.contact_type === "quoting");
  const projects = (projectRows ?? []) as ProjectRecord[];
  const inboxItems = (companyInboxItems ?? []) as InboxItemRecord[];
  const linkableInboxItems = ((allInboxItems ?? []) as InboxItemRecord[]).filter(
    (item) => item.company_id !== id,
  );

  return (
    <div className="grid gap-8">
      <header className="crm-detail-hero p-6 md:p-8">
        <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/companies" className="font-bold underline">
              Back to clients
            </Link>
            <h1 className="crm-page-title mt-4">{company.name}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="crm-status-pill">{formatStatus(company.status)}</span>
              {company.sector && (
                <span className="crm-status-pill crm-status-pill-yellow">{company.sector}</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href={`/companies/${id}/edit`} className="crm-button">
              Edit client
            </Link>
            <Link href={`/contacts/new?companyId=${id}`} className="crm-button crm-button-primary">
              Add contact
            </Link>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="crm-card crm-kpi p-5">
          <p className="crm-muted font-bold">Contacts</p>
          <p className="mt-2 text-3xl font-black">{companyContacts.length}</p>
        </div>

        <div className="crm-card crm-kpi crm-kpi-orange p-5">
          <p className="crm-muted font-bold">Linked projects</p>
          <p className="mt-2 text-3xl font-black">{projects.length}</p>
        </div>

        <div className="crm-card crm-kpi crm-kpi-yellow p-5">
          <p className="crm-muted font-bold">Quoting contacts</p>
          <p className="mt-2 text-3xl font-black">{quotingContacts.length}</p>
        </div>

        <div className="crm-card crm-kpi p-5">
          <p className="crm-muted font-bold">Website</p>
          <p className="mt-2 text-xl font-black">
            {company.website ? (
              <a href={company.website} target="_blank" className="underline">
                Visit
              </a>
            ) : (
              "-"
            )}
          </p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]" id="preferences">
        <div className="crm-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="crm-section-title">Company preferences</h2>
              <p className="crm-muted mt-1">
                Trello opens this live record so preferences are not copied into individual cards.
              </p>
            </div>
            <span className="crm-status-pill">
              Reviewed {formatDate(company.preferences_reviewed_at)}
            </span>
          </div>
          <form action={updateCompanyPreferences.bind(null, id)} className="mt-5 grid gap-3">
            <label className="grid gap-2 font-bold">
              <span>Preferences</span>
              <textarea
                className="crm-input min-h-40"
                defaultValue={company.preferences ?? ""}
                name="preferences"
                placeholder="Company-wide style, accessibility, communication and delivery preferences..."
              />
            </label>
            <button className="crm-button crm-button-primary w-fit" type="submit">
              Save and mark reviewed
            </button>
          </form>
        </div>

        <div className="crm-card p-6">
          <h2 className="crm-section-title">Trello link details</h2>
          <p className="crm-muted mt-2">
            Use this stable ID when linking a Trello card. It will not change if the client name changes.
          </p>
          <div className="crm-panel-tint mt-5 grid gap-3 p-4">
            <code className="break-all font-black">{id}</code>
            <CopyTextButton label="Copy company ID" text={id} />
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link className="crm-button" href={`/companies/${id}/projects`}>
              View related projects
            </Link>
            <Link className="crm-button crm-button-primary" href={`/projects/new?companyId=${id}`}>
              Register project
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="crm-card p-6">
          <h2 className="crm-section-title">Client details</h2>
          <div className="crm-info-grid mt-5">
            <div className="crm-info-row">
              <span className="crm-info-label">Client type:</span>
              <span className="crm-info-value">{company.sector || "-"}</span>
            </div>
            <div className="crm-info-row">
              <span className="crm-info-label">Status:</span>
              <span className="crm-info-value">{formatStatus(company.status)}</span>
            </div>
            <div className="crm-info-row">
              <span className="crm-info-label">Notes:</span>
              <span className="crm-info-value whitespace-pre-wrap">
                {company.notes || "No notes recorded."}
              </span>
            </div>
          </div>
        </div>

        <div className="crm-card p-6">
          <h2 className="crm-section-title">Billing details</h2>
          <div className="crm-info-grid mt-5">
            <div className="crm-info-row">
              <span className="crm-info-label">Billing contact:</span>
              <span className="crm-info-value">{company.billing_contact_name || "-"}</span>
            </div>
            <div className="crm-info-row">
              <span className="crm-info-label">Billing email:</span>
              <span className="crm-info-value">
                {company.billing_email ? (
                  <a href={`mailto:${company.billing_email}`} className="underline">
                    {company.billing_email}
                  </a>
                ) : (
                  "-"
                )}
              </span>
            </div>
            <div className="crm-info-row">
              <span className="crm-info-label">Billing address:</span>
              <span className="crm-info-value whitespace-pre-wrap">
                {company.billing_address || "-"}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="crm-card overflow-hidden" id="projects">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 p-6">
          <div>
            <h2 className="crm-section-title">Linked Trello projects</h2>
            <p className="crm-muted mt-1">Project history used by the Similar jobs button.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="crm-button" href={`/companies/${id}/projects`}>
              Find related projects
            </Link>
            <Link className="crm-button crm-button-primary" href={`/projects/new?companyId=${id}`}>
              Register project
            </Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Job type</th>
                <th>Status</th>
                <th>Trello</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id}>
                  <td>
                    <p className="font-black">{project.job_number || "-"}</p>
                    <p className="crm-muted mt-1">{project.title || "Untitled project"}</p>
                  </td>
                  <td>{getProjectJobType(project) || "-"}</td>
                  <td>
                    <span className="crm-status-pill">
                      {project.trello_status || "Managed in Trello"}
                    </span>
                  </td>
                  <td>
                    {project.trello_card_url ? (
                      <a
                        className="font-bold underline"
                        href={project.trello_card_url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Open card
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    <Link className="crm-button" href={`/projects/${project.id}/edit`}>
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
              {!projects.length && (
                <tr>
                  <td colSpan={5}>No Trello projects registered for this client yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="crm-card overflow-hidden" id="quoting-contacts">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 p-6">
          <div>
            <h2 className="crm-section-title">Quoting contacts</h2>
            <p className="crm-muted mt-1">
              Returned to the quote tool by stable company ID. Separate from invoicing contacts.
            </p>
          </div>
          <Link
            className="crm-button crm-button-primary"
            href={`/contacts/new?companyId=${id}&contactType=quoting`}
          >
            Add quoting contact
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Default</th>
              </tr>
            </thead>
            <tbody>
              {quotingContacts.map((contact) => (
                <tr key={contact.id}>
                  <td>
                    <Link className="font-bold underline" href={`/contacts/${contact.id}`}>
                      {getContactName(contact)}
                    </Link>
                  </td>
                  <td>
                    {contact.email ? (
                      <a className="underline" href={`mailto:${contact.email}`}>
                        {contact.email}
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>{contact.role || "-"}</td>
                  <td>
                    {contact.is_default_quoting_contact ? (
                      <span className="crm-status-pill crm-status-pill-yellow">Default</span>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
              {!quotingContacts.length && (
                <tr>
                  <td colSpan={4}>No quoting contacts have been set for this client.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="crm-card overflow-hidden">
        <div className="grid gap-4 border-b border-gray-200 p-6 xl:grid-cols-[0.75fr_1.25fr]">
          <div>
            <h2 className="crm-section-title">Inbox items</h2>
          </div>

          <form
            action={linkInboxItemToCompany.bind(null, id)}
            className="grid gap-3 md:grid-cols-[1fr_auto]"
          >
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

        <div className="overflow-x-auto">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Message</th>
                <th>Inbox</th>
                <th>Job / thread</th>
                <th>Received</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {inboxItems.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link className="font-bold underline" href={`/inbox/message/${item.id}`}>
                      {item.subject || "No subject"}
                    </Link>
                  </td>
                  <td>{getSourceLabel(item.source_inbox)}</td>
                  <td>{getThreadLabel(item)}</td>
                  <td>{formatDate(item.received_at)}</td>
                  <td>
                    <span className="crm-status-pill">{formatStatus(item.status, "Needs review")}</span>
                  </td>
                </tr>
              ))}

              {!inboxItems.length && (
                <tr>
                  <td colSpan={5}>No linked inbox items.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="crm-card overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-gray-200 p-6">
          <h2 className="crm-section-title">Contacts</h2>
          <Link href={`/contacts/new?companyId=${id}`} className="crm-button crm-button-primary">
            Add contact
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {companyContacts.map((contact) => (
                <tr key={contact.id}>
                  <td>
                    <Link href={`/contacts/${contact.id}`} className="font-bold underline">
                      {contact.first_name} {contact.last_name}
                    </Link>
                  </td>
                  <td>
                    {contact.email ? (
                      <a href={`mailto:${contact.email}`} className="underline">
                        {contact.email}
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>{contact.role || "-"}</td>
                  <td>
                    <span className="crm-status-pill">
                      {formatContactType(contact.contact_type)}
                    </span>
                  </td>
                  <td>
                    <span className="crm-status-pill">{formatStatus(contact.status)}</span>
                  </td>
                </tr>
              ))}

              {!companyContacts.length && (
                <tr>
                  <td colSpan={5}>No contacts linked to this client yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
