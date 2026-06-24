import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { formatStatus } from "@/lib/format";

type CompanyRecord = {
  id: string;
  name?: string | null;
  sector?: string | null;
  status?: string | null;
};

type EmailRecord = {
  id: string;
  subject?: string | null;
  source_inbox?: string | null;
  status?: string | null;
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

  return "Mailbox";
}

export default async function DashboardPage() {
  const [
    { count: companyCount },
    { count: contactCount },
    { count: mailingCount },
    { count: emailCount },
    { count: followUpCount },
    { data: recentCompanies },
    { data: recentEmails },
  ] = await Promise.all([
    supabase.from("companies").select("*", { count: "exact", head: true }),
    supabase.from("contacts").select("*", { count: "exact", head: true }),
    supabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("mailing_status", "subscribed"),
    supabase.from("inbound_emails").select("*", { count: "exact", head: true }),
    supabase
      .from("inbound_emails")
      .select("*", { count: "exact", head: true })
      .eq("status", "follow_up"),
    supabase.from("companies").select("id, name, sector, status").order("created_at", { ascending: false }).limit(5),
    supabase
      .from("inbound_emails")
      .select("id, subject, source_inbox, status, received_at")
      .order("received_at", { ascending: false })
      .limit(5),
  ]);

  const companies = (recentCompanies ?? []) as CompanyRecord[];
  const emails = (recentEmails ?? []) as EmailRecord[];

  return (
    <div className="grid gap-8">
      <section className="crm-card crm-card-strong overflow-hidden">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
          <div className="p-6 md:p-8">
            <h1 className="crm-page-title">Easy Read Online CRM</h1>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link className="crm-button" href="/contacts">
                View contacts
              </Link>
              <Link className="crm-button" href="/companies">
                View companies
              </Link>
              <Link className="crm-button" href="/inbox">
                View inbox
              </Link>
              <Link className="crm-button" href="/mailing-lists">
                Mailing lists
              </Link>
              <Link className="crm-button" href="/profile">
                My profile
              </Link>
            </div>
          </div>

          <div className="crm-hero-logo-panel">
            <Image
              alt="Easy Read Online logo"
              className="crm-hero-logo"
              height={963}
              priority
              src="/er_logo.jpg"
              style={{ height: "auto" }}
              width={669}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="crm-card crm-kpi p-5">
          <p className="crm-muted font-bold">Companies</p>
          <p className="mt-3 text-4xl font-black">{companyCount ?? 0}</p>
        </div>

        <div className="crm-card crm-kpi crm-kpi-orange p-5">
          <p className="crm-muted font-bold">Contacts</p>
          <p className="mt-3 text-4xl font-black">{contactCount ?? 0}</p>
        </div>

        <div className="crm-card crm-kpi crm-kpi-yellow p-5">
          <p className="crm-muted font-bold">Mailing list</p>
          <p className="mt-3 text-4xl font-black">{mailingCount ?? 0}</p>
        </div>

        <div className="crm-card crm-kpi p-5">
          <p className="crm-muted font-bold">Inbox items</p>
          <p className="mt-3 text-4xl font-black">{emailCount ?? 0}</p>
        </div>

        <div className="crm-card crm-kpi crm-kpi-orange p-5">
          <p className="crm-muted font-bold">Follow-ups</p>
          <p className="mt-3 text-4xl font-black">{followUpCount ?? 0}</p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="crm-card overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-[var(--border-soft)] p-5">
            <div>
              <h2 className="crm-section-title">Recent companies</h2>
            </div>
            <Link className="crm-button" href="/companies">
              View all
            </Link>
          </div>

          <table className="crm-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Sector</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <tr key={company.id}>
                  <td>
                    <Link className="font-bold underline" href={`/companies/${company.id}`}>
                      {company.name}
                    </Link>
                  </td>
                  <td>{company.sector || "-"}</td>
                  <td>
                    <span className="crm-status-pill">{formatStatus(company.status)}</span>
                  </td>
                </tr>
              ))}

              {!companies.length && (
                <tr>
                  <td colSpan={3}>No companies yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="crm-card overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-[var(--border-soft)] p-5">
            <div>
              <h2 className="crm-section-title">Inbox</h2>
            </div>
            <Link className="crm-button" href="/inbox">
              View inbox
            </Link>
          </div>

          <table className="crm-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Inbox</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {emails.map((email) => (
                <tr key={email.id}>
                  <td>
                    <Link className="font-bold underline" href={`/inbox/message/${email.id}`}>
                      {email.subject || "No subject"}
                    </Link>
                  </td>
                  <td>{getSourceLabel(email.source_inbox)}</td>
                  <td>
                    <span className="crm-status-pill crm-status-pill-yellow">
                      {formatStatus(email.status, "New")}
                    </span>
                  </td>
                </tr>
              ))}

              {!emails.length && (
                <tr>
                  <td colSpan={3}>No inbox items yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
