import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatStatus } from "@/lib/format";

export default async function CompaniesPage() {
  const [{ data: companies, error }, { count: linkedContactCount }] = await Promise.all([
    supabase
      .from("companies")
      .select("*")
      .order("name"),
    supabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .not("company_id", "is", null),
  ]);

  if (error) {
    return (
      <div>
        <h1 className="crm-page-title">Companies</h1>
        <p className="text-red-600 mt-4">
          Error loading companies.
        </p>
      </div>
    );
  }

  const activeCompanies =
    companies?.filter((company) => (company.status || "active").toLowerCase() === "active").length ?? 0;
  const billingCount =
    companies?.filter((company) => Boolean(company.billing_email || company.billing_address)).length ?? 0;
  const companyCards = [
    {
      title: "Organisations",
      count: companies?.length ?? 0,
      className: "",
    },
    {
      title: "Active",
      count: activeCompanies,
      className: "crm-kpi-orange",
    },
    {
      title: "Linked contacts",
      count: linkedContactCount ?? 0,
      className: "crm-kpi-yellow",
    },
    {
      title: "Billing details",
      count: billingCount,
      className: "",
    },
  ];

  return (
    <div className="grid gap-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="crm-page-title">
            Companies
          </h1>
        </div>

        <Link href="/companies/new" className="crm-button crm-button-primary">
          Add company
        </Link>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {companyCards.map((card) => (
          <div className={`crm-card crm-kpi p-5 ${card.className}`} key={card.title}>
            <p className="crm-muted font-bold">{card.title}</p>
            <p className="mt-3 text-4xl font-black">{card.count}</p>
          </div>
        ))}
      </section>

      <section className="crm-card overflow-hidden">
        <div className="border-b border-gray-200 p-4">
          <input
            className="crm-input"
            placeholder="Search companies..."
          />
        </div>

        <div className="overflow-x-auto">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Sector</th>
                <th>Status</th>
                <th>Website</th>
              </tr>
            </thead>

            <tbody>
              {companies?.map((company) => (
                <tr
                  key={company.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td>
                    <div className="grid gap-1">
                      <Link
                        href={`/companies/${company.id}`}
                        className="font-bold hover:underline"
                      >
                        {company.name}
                      </Link>

                      <span className="crm-muted text-sm">
                        {company.notes || "No notes"}
                      </span>
                    </div>
                  </td>

                  <td>
                    {company.sector || "—"}
                  </td>

                  <td>
                    <span className="crm-status-pill">
                      {formatStatus(company.status)}
                    </span>
                  </td>

                  <td>
                    {company.website ? (
                      <a
                        href={company.website}
                        target="_blank"
                        className="font-semibold underline"
                      >
                        Visit
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}

              {!companies?.length && (
                <tr>
                  <td colSpan={4}>
                    No companies found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
