import Link from "next/link";
import { formatStatus } from "@/lib/format";
import { getReportingData, getStatusBreakdown, getSummaryRows, getTopTags } from "./data";

const exportLinks = [
  { href: "/reporting/export?table=clients", label: "Export clients" },
  { href: "/reporting/export?table=contacts", label: "Export contacts" },
  { href: "/reporting/export?table=inbox", label: "Export inbox" },
  { href: "/reporting/export?table=summary", label: "Export summary" },
];

export default async function ReportingPage() {
  const data = await getReportingData();
  const summaryRows = getSummaryRows(data);
  const clientStatuses = getStatusBreakdown(data.clients.map((client) => formatStatus(client.status)));
  const contactStatuses = getStatusBreakdown(data.contacts.map((contact) => formatStatus(contact.status)));
  const inboxStatuses = getStatusBreakdown(
    data.emails.map((email) => formatStatus(email.status, "Needs review")),
  );
  const clientTags = getTopTags(data.clientTags);
  const contactTags = getTopTags(data.contactTags);

  return (
    <div className="grid gap-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="crm-page-title">Reporting</h1>
        </div>

        <div className="flex flex-wrap gap-2">
          {exportLinks.map((link) => (
            <Link className="crm-button" href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryRows.slice(0, 4).map(([metric, value], index) => (
          <div
            className={`crm-card crm-kpi p-5 ${index === 1 ? "crm-kpi-orange" : index === 2 ? "crm-kpi-yellow" : ""}`}
            key={metric}
          >
            <p className="crm-muted font-bold">{metric}</p>
            <p className="mt-3 text-4xl font-black">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="crm-card overflow-hidden">
          <div className="border-b border-[var(--border-soft)] p-5">
            <h2 className="crm-section-title">CRM summary</h2>
          </div>
          <table className="crm-table">
            <tbody>
              {summaryRows.map(([metric, value]) => (
                <tr key={metric}>
                  <td className="font-bold">{metric}</td>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="crm-card overflow-hidden">
          <div className="border-b border-[var(--border-soft)] p-5">
            <h2 className="crm-section-title">Inbox report</h2>
          </div>
          <table className="crm-table">
            <tbody>
              {inboxStatuses.map(([status, count]) => (
                <tr key={status}>
                  <td className="font-bold">{status}</td>
                  <td>{count}</td>
                </tr>
              ))}
              {!inboxStatuses.length && (
                <tr>
                  <td colSpan={2}>No inbox data yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="crm-card overflow-hidden">
          <div className="border-b border-[var(--border-soft)] p-5">
            <h2 className="crm-section-title">Client report</h2>
          </div>
          <table className="crm-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {clientStatuses.map(([status, count]) => (
                <tr key={status}>
                  <td>{status}</td>
                  <td>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="crm-card overflow-hidden">
          <div className="border-b border-[var(--border-soft)] p-5">
            <h2 className="crm-section-title">Contact report</h2>
          </div>
          <table className="crm-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {contactStatuses.map(([status, count]) => (
                <tr key={status}>
                  <td>{status}</td>
                  <td>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="crm-card overflow-hidden">
          <div className="border-b border-[var(--border-soft)] p-5">
            <h2 className="crm-section-title">Client tags</h2>
          </div>
          <table className="crm-table">
            <tbody>
              {clientTags.map(([tag, count]) => (
                <tr key={tag}>
                  <td className="font-bold">{tag}</td>
                  <td>{count}</td>
                </tr>
              ))}
              {!clientTags.length && (
                <tr>
                  <td colSpan={2}>No client tags yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="crm-card overflow-hidden">
          <div className="border-b border-[var(--border-soft)] p-5">
            <h2 className="crm-section-title">Contact tags</h2>
          </div>
          <table className="crm-table">
            <tbody>
              {contactTags.map(([tag, count]) => (
                <tr key={tag}>
                  <td className="font-bold">{tag}</td>
                  <td>{count}</td>
                </tr>
              ))}
              {!contactTags.length && (
                <tr>
                  <td colSpan={2}>No contact tags yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
