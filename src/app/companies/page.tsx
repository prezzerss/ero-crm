import Link from "next/link";
import { clientTypeOptions } from "@/lib/client-types";
import { supabase } from "@/lib/supabase";
import { formatStatus } from "@/lib/format";

type CompaniesPageProps = {
  searchParams: Promise<{
    q?: string;
    page?: string;
    clientType?: string;
    sort?: string;
    status?: string;
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

const statusFilterOptions = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "offline", label: "Offline" },
];

const sortOptions = [
  { value: "alpha_az", label: "Alphabetical A-Z" },
  { value: "alpha_za", label: "Alphabetical Z-A" },
  { value: "recent_contact", label: "Recently contacted" },
];

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

function normaliseSort(sort?: string) {
  return sortOptions.some((option) => option.value === sort) ? sort ?? "alpha_az" : "alpha_az";
}

function buildPageHref(
  page: number,
  values: {
    selectedClientType: string;
    query: string;
    selectedSort: string;
    selectedStatus: string;
  },
) {
  const params = new URLSearchParams();

  if (values.query) {
    params.set("q", values.query);
  }

  if (values.selectedStatus !== "all") {
    params.set("status", values.selectedStatus);
  }

  if (values.selectedClientType !== "all") {
    params.set("clientType", values.selectedClientType);
  }

  if (values.selectedSort !== "alpha_az") {
    params.set("sort", values.selectedSort);
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

export default async function CompaniesPage({ searchParams }: CompaniesPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const selectedClientType = params.clientType ?? "all";
  const selectedStatus = params.status ?? "all";
  const selectedSort = normaliseSort(params.sort);
  const currentPage = getCurrentPage(params.page);
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let companiesQuery = supabase
    .from("companies")
    .select("*", { count: "exact" });

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

  if (selectedStatus !== "all") {
    companiesQuery = companiesQuery.ilike("status", selectedStatus);
  }

  if (selectedClientType !== "all") {
    companiesQuery = companiesQuery.eq("sector", selectedClientType);
  }

  if (selectedSort === "alpha_za") {
    companiesQuery = companiesQuery.order("name", { ascending: false });
  } else if (selectedSort === "recent_contact") {
    companiesQuery = companiesQuery.order("last_contacted_at", { ascending: false });
  } else {
    companiesQuery = companiesQuery.order("name");
  }

  companiesQuery = companiesQuery.range(from, to);

  const [
    { data: companies, error, count: totalCompanies },
    { count: linkedContactCount },
    { count: activeCompanyCount },
    { count: linkedEmailCount },
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
      .from("inbound_emails")
      .select("*", { count: "exact", head: true })
      .not("company_id", "is", null),
  ]);

  if (error) {
    return (
      <div>
        <h1 className="crm-page-title">Clients</h1>
        <p className="mt-4 text-red-600">Error loading clients.</p>
      </div>
    );
  }

  const rows = (companies ?? []) as CompanyRecord[];
  const matchingCount = totalCompanies ?? 0;
  const totalPages = Math.max(1, Math.ceil(matchingCount / PAGE_SIZE));
  const billingCount = rows.filter((company) => Boolean(company.billing_email || company.billing_address)).length;
  const hasActiveFilters =
    Boolean(query) ||
    selectedStatus !== "all" ||
    selectedClientType !== "all" ||
    selectedSort !== "alpha_az";
  const pageValues = {
    selectedClientType,
    query,
    selectedSort,
    selectedStatus,
  };
  const companyCards = [
    {
      title: hasActiveFilters ? "Matching clients" : "Clients",
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
      title: "Linked emails",
      count: linkedEmailCount ?? 0,
      className: "",
    },
  ];

  return (
    <div className="grid gap-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="crm-page-title">Clients</h1>
        </div>

        <Link href="/companies/new" className="crm-button crm-button-primary">
          Add client
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
        <form
          action="/companies"
          className="grid gap-3 border-b border-gray-200 p-4 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_160px_190px_190px_auto]"
        >
          <input
            className="crm-input"
            defaultValue={query}
            name="q"
            placeholder="Search client name or type"
          />

          <select className="crm-input" defaultValue={selectedStatus} name="status">
            {statusFilterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select className="crm-input" defaultValue={selectedClientType} name="clientType">
            <option value="all">Client type</option>
            {clientTypeOptions.map((clientType) => (
              <option key={clientType} value={clientType}>
                {clientType}
              </option>
            ))}
          </select>

          <select className="crm-input" defaultValue={selectedSort} name="sort">
            {sortOptions.map((option) => (
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
              <Link href="/companies" className="crm-button">
                Clear
              </Link>
            )}
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Client name</th>
                <th>Client type</th>
                <th>Status</th>
                <th>Last contacted</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((company) => {
                return (
                  <tr key={company.id} className="transition-colors hover:bg-gray-50">
                    <td>
                      <div className="grid gap-1">
                        <Link href={`/companies/${company.id}`} className="font-bold hover:underline">
                          {company.name || "Unnamed client"}
                        </Link>
                      </div>
                    </td>

                    <td>{company.sector || "-"}</td>

                    <td>
                      <span className="crm-status-pill">{formatStatus(company.status)}</span>
                    </td>

                    <td>{formatDate(company.last_contacted_at)}</td>
                  </tr>
                );
              })}

              {!rows.length && (
                <tr>
                  <td colSpan={4}>
                    {hasActiveFilters ? "No clients match these filters." : "No clients found."}
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
              <Link className="crm-button" href={buildPageHref(currentPage - 1, pageValues)}>
                Previous
              </Link>
            ) : (
              <span className="crm-button opacity-50">Previous</span>
            )}

            <span className="crm-muted font-bold">
              Page {currentPage} of {totalPages}
            </span>

            {currentPage < totalPages ? (
              <Link className="crm-button" href={buildPageHref(currentPage + 1, pageValues)}>
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
          {billingCount} clients on this page have billing details saved.
        </p>
      )}
    </div>
  );
}
