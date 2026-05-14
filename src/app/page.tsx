import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default async function DashboardPage() {
  const { count: companyCount } = await supabase
    .from("companies")
    .select("*", { count: "exact", head: true });

  const { count: contactCount } = await supabase
    .from("contacts")
    .select("*", { count: "exact", head: true });

  const { data: recentCompanies } = await supabase
    .from("companies")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div className="grid gap-8">
      <header>
        <p className="font-bold text-[var(--brand-teal)]">Overview</p>
        <h1 className="crm-page-title">Dashboard</h1>
        <p className="crm-muted mt-2">
          A simple overview of companies and contacts stored in the CRM.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="crm-card p-6">
          <p className="crm-muted font-bold">Companies</p>
          <p className="text-4xl font-black mt-2">{companyCount ?? 0}</p>
        </div>

        <div className="crm-card p-6">
          <p className="crm-muted font-bold">Contacts</p>
          <p className="text-4xl font-black mt-2">{contactCount ?? 0}</p>
        </div>

        <div className="crm-card p-6">
          <p className="crm-muted font-bold">Email tracking</p>
          <p className="text-4xl font-black mt-2">Soon</p>
        </div>
      </section>

      <section className="crm-card p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black">Recent companies</h2>
            <p className="crm-muted">Latest organisations added to the CRM.</p>
          </div>

          <Link href="/companies" className="crm-button crm-button-primary">
            View companies
          </Link>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Sector</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentCompanies?.map((company) => (
                <tr key={company.id}>
                  <td className="font-bold">{company.name}</td>
                  <td>{company.sector || "—"}</td>
                  <td>
                    <span className="crm-status-pill">
                      {company.status || "active"}
                    </span>
                  </td>
                </tr>
              ))}

              {!recentCompanies?.length && (
                <tr>
                  <td colSpan={3}>No companies yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}