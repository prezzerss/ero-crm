import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { formatStatus } from "@/lib/format";
import { linkInboxItemToCompany } from "@/app/emails/actions";

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

  const [{ data: contacts }, { data: companyInboxItems }, { data: allInboxItems }] = await Promise.all([
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
  ]);
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
              Back to companies
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
              Edit company
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
          <p className="mt-2 text-3xl font-black">{contacts?.length ?? 0}</p>
        </div>

        <div className="crm-card crm-kpi crm-kpi-orange p-5">
          <p className="crm-muted font-bold">Inbox items</p>
          <p className="mt-2 text-3xl font-black">{inboxItems.length}</p>
        </div>

        <div className="crm-card crm-kpi crm-kpi-yellow p-5">
          <p className="crm-muted font-bold">Billing email</p>
          <p className="mt-2 text-3xl font-black">{company.billing_email ? "Yes" : "No"}</p>
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

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="crm-card p-6">
          <h2 className="crm-section-title">Company details</h2>
          <div className="crm-info-grid mt-5">
            <div className="crm-info-row">
              <span className="crm-info-label">Sector:</span>
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
                    <span className="crm-status-pill">{formatStatus(item.status, "New")}</span>
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
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {contacts?.map((contact) => (
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
                    <span className="crm-status-pill">{formatStatus(contact.status)}</span>
                  </td>
                </tr>
              ))}

              {!contacts?.length && (
                <tr>
                  <td colSpan={4}>No contacts linked to this company yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
