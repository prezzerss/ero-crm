import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatStatus } from "@/lib/format";

type CompaniesPageProps = {
  searchParams: Promise<{
    q?: string;
    page?: string;
  }>;
};

type CompanyRecord = {
  id: string;
  name?: string | null;
  sector?: string | null;
  status?: string | null;
  website?: string | null;
  domain?: string | null;
  notes?: string | null;
  billing_email?: string | null;
  billing_address?: string | null;
  auto_created?: boolean | null;
  last_contacted_at?: string | null;
};

const PAGE_SIZE = 25;

function getCurrentPage(page?: string) {
  const parsedPage = Number(page ?? "1");

  if (!Number.isFinite(parsedPage) || parsedPage < 1) {
    return 1;
  }

  return Math.floor(parsedPage);
}

function escapeSearchValue(value: string) {
  return value.replaceAll("%", "\\%").replaceAll("_", "\\_");
}

function buildPageHref(query: string, page: number) {
  const params = new URLSearchParams();

  if (query) {
    params.set("q", query);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const queryString = params.toString();

  return queryString ? `/companies?${queryString}` : "/companies";
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

function normaliseWebsiteUrl(value?: string | null) {
  if (!value) {
    return null;
  }

  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

export default async function CompaniesPage({ searchParams }: CompaniesPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const currentPage = getCurrentPage(params.page);
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let companiesQuery = supabase
    .from("companies")
    .select("*", { count: "exact" })
    .order("name")
    .range(from, to);

  if (query) {
    const escapedQuery = escapeSearchValue(query);

    companiesQuery = companiesQuery.or(
      [
        `name.ilike.%${escapedQuery}%`,
        `domain.ilike.%${escapedQuery}%`,
        `website.ilike.%${escapedQuery}%`,
        `sector.ilike.%${escapedQuery}%`,
      ].join(","),
    );
  }

  const [
    { data: companies, error, count: totalCompanies },
    { count: linkedContactCount },
    { count: activeCompanyCount },
    { count: autoCreatedCount },
  ] = await Promise.all([
    companiesQuery,
    supabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .not("company_id", "is", null),
    supabase
      .from("companies")
      .select("*", { count: "exact", head: true })
      .ilike("status", "active"),
    supabase
      .from("companies")
      .select("*", { count: "exact", head: true })
      .eq("auto_created", true),
  ]);

  if (error) {
    return (
      <div>
        <h1 className="crm-page-title">Companies</h1>
        <p className="mt-4 text-red-600">Error loading companies.</p>
      </div>
    );
  }

  const rows = (companies ?? []) as CompanyRecord[];
  const matchingCount = totalCompanies ?? 0;
  const totalPages = Math.max(1, Math.ceil(matchingCount / PAGE_SIZE));
  const billingCount = rows.filter((company) => Boolean(company.billing_email || company.billing_address)).length;
  const companyCards = [
    {
      title: query ? "Matching organisations" : "Organisations",
      count: matchingCount,
      className: "",
    },
    {
      title: "Active",
      count: activeCompanyCount ?? 0,
      className: "crm-kpi-orange",
    },
    {
      title: "Linked contacts",
      count: linkedContactCount ?? 0,
      className: "crm-kpi-yellow",
    },
    {
      title: "Auto-created",
      count: autoCreatedCount ?? 0,
      className: "",
    },
  ];

  return (
    <div className="grid gap-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="crm-page-title">Companies</h1>
          <p className="crm-muted mt-2 font-bold">
            Organisations, billing details, and auto-created companies from email domains.
          </p>
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
        <form action="/companies" className="border-b border-gray-200 p-4">
          <label className="grid gap-2 font-bold">
            <span>Search companies</span>
            <div className="flex flex-wrap gap-2">
              <input
                className="crm-input min-w-72 flex-1"
                defaultValue={query}
                name="q"
                placeholder="Search by name, domain, website or sector"
              />
              <button className="crm-button crm-button-primary" type="submit">
                Search
              </button>
              {query && (
                <Link href="/companies" className="crm-button">
                  Clear
                </Link>
              )}
            </div>
          </label>
        </form>

        <div className="overflow-x-auto">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Domain</th>
                <th>Sector</th>
                <th>Status</th>
                <th>Last contacted</th>
                <th>Website</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((company) => {
                const websiteUrl = normaliseWebsiteUrl(company.website);

                return (
                  <tr key={company.id} className="transition-colors hover:bg-gray-50">
                    <td>
                      <div className="grid gap-1">
                        <Link href={`/companies/${company.id}`} className="font-bold hover:underline">
                          {company.name || "Unnamed company"}
                        </Link>

                        <div className="flex flex-wrap gap-2">
                          {company.auto_created && (
                            <span className="crm-status-pill crm-status-pill-yellow">
                              Auto-created
                            </span>
                          )}
                          {company.billing_email || company.billing_address ? (
                            <span className="crm-status-pill">Billing details</span>
                          ) : null}
                        </div>

                        <span className="crm-muted text-sm">{company.notes || "No notes"}</span>
                      </div>
                    </td>

                    <td>{company.domain || "-"}</td>
                    <td>{company.sector || "-"}</td>

                    <td>
                      <span className="crm-status-pill">{formatStatus(company.status)}</span>
                    </td>

                    <td>{formatDate(company.last_contacted_at)}</td>

                    <td>
                      {websiteUrl ? (
                        <a href={websiteUrl} target="_blank" className="font-semibold underline">
                          Visit
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                );
              })}

              {!rows.length && (
                <tr>
                  <td colSpan={6}>
                    {query ? "No companies match that search." : "No companies found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-4 py-3">
          <p className="crm-muted font-bold">
            Showing {rows.length ? from + 1 : 0}-{Math.min(to + 1, matchingCount)} of {matchingCount}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {currentPage > 1 ? (
              <Link className="crm-button" href={buildPageHref(query, currentPage - 1)}>
                Previous
              </Link>
            ) : (
              <span className="crm-button opacity-50">Previous</span>
            )}

            <span className="crm-muted font-bold">
              Page {currentPage} of {totalPages}
            </span>

            {currentPage < totalPages ? (
              <Link className="crm-button" href={buildPageHref(query, currentPage + 1)}>
                Next
              </Link>
            ) : (
              <span className="crm-button opacity-50">Next</span>
            )}
          </div>
        </div>
      </section>

      {billingCount > 0 && (
        <p className="crm-muted text-sm font-bold">
          {billingCount} companies on this page have billing details saved.
        </p>
      )}
    </div>
  );
}
