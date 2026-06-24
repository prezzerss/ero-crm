import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { updateEmailStatus } from "../../emails/actions";
import { AutoSaveStatusSelect } from "./auto-save-email-controls";

type SourceKey = "projects" | "quotes" | "enquiries";

type EmailRecord = {
  id: string;
  source_inbox?: string | null;
  from_email?: string | null;
  from_name?: string | null;
  subject?: string | null;
  snippet?: string | null;
  status?: string | null;
  job_number?: string | null;
  thread_subject?: string | null;
  received_at?: string | null;
  conversation_id?: string | null;
  contacts?: {
    id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  } | null;
  companies?: {
    id?: string | null;
    name?: string | null;
  } | null;
};

type QueryError = {
  message: string;
};

type EmailQueryResponse = {
  count: number | null;
  data: EmailRecord[] | null;
  error: QueryError | null;
};

type CountQueryResponse = {
  count: number | null;
};

type InboxPageContentProps = {
  searchParams: Promise<{
    q?: string;
    source?: string;
    status?: string;
    page?: string;
  }>;
  source?: SourceKey;
};

type ThreadSummary = {
  count: number;
  href: string;
  latest?: string | null;
  subject: string;
};

type FilterableEmailQuery = {
  eq(column: string, value: string): FilterableEmailQuery;
  or(filters: string): FilterableEmailQuery;
};

const sourceOptions = [
  { value: "all", label: "All inboxes", href: "/inbox" },
  { value: "enquiries", label: "enquiries@", href: "/inbox/enquiries" },
  { value: "projects", label: "projects@", href: "/inbox/projects" },
  { value: "quotes", label: "quotes@", href: "/inbox/quotes" },
];

const statusOptions = [
  { value: "all", label: "All statuses" },
  { value: "new", label: "New" },
  { value: "reviewing", label: "Reviewing" },
  { value: "follow_up", label: "Follow up" },
  { value: "linked", label: "Linked" },
  { value: "ignored", label: "Ignored" },
];

const PAGE_SIZE = 25;

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

  return "Unknown inbox";
}

function getContactName(email: EmailRecord) {
  const contact = email.contacts;

  if (!contact) {
    return "";
  }

  return [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.email || "";
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

function getPageTitle(source?: SourceKey) {
  return source ? getSourceLabel(source) : "Inbox";
}

function getThreadLabel(email: EmailRecord) {
  if (email.job_number && email.thread_subject) {
    return `${email.job_number} / ${email.thread_subject}`;
  }

  if (email.job_number) {
    return email.job_number;
  }

  if (email.thread_subject) {
    return email.thread_subject;
  }

  return email.source_inbox === "projects" ? "No job number" : "-";
}

function getThreadKey(email: EmailRecord) {
  return email.conversation_id || email.job_number || email.thread_subject || email.subject || email.id;
}

function getThreadHref(email: EmailRecord) {
  const source = email.source_inbox || "projects";

  return `/inbox/${source}/thread/${encodeURIComponent(getThreadKey(email))}`;
}

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

function buildPageHref(
  formAction: string,
  page: number,
  values: {
    query: string;
    selectedSource: string;
    selectedStatus: string;
    source?: SourceKey;
  },
) {
  const params = new URLSearchParams();

  if (values.query) {
    params.set("q", values.query);
  }

  if (!values.source && values.selectedSource !== "all") {
    params.set("source", values.selectedSource);
  }

  if (values.selectedStatus !== "all") {
    params.set("status", values.selectedStatus);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const queryString = params.toString();

  return queryString ? `${formAction}?${queryString}` : formAction;
}

function applyFiltersToQuery(
  emailQuery: FilterableEmailQuery,
  values: {
    query: string;
    selectedSource: string;
    selectedStatus: string;
    source?: SourceKey;
  },
) {
  let filteredQuery: FilterableEmailQuery = emailQuery;

  if (values.source) {
    filteredQuery = filteredQuery.eq("source_inbox", values.source);
  } else if (values.selectedSource !== "all") {
    filteredQuery = filteredQuery.eq("source_inbox", values.selectedSource);
  }

  if (values.selectedStatus !== "all") {
    filteredQuery = filteredQuery.eq("status", values.selectedStatus);
  }

  if (values.query) {
    const escapedQuery = escapeSearchValue(values.query);

    filteredQuery = filteredQuery.or(
      [
        `from_email.ilike.%${escapedQuery}%`,
        `from_name.ilike.%${escapedQuery}%`,
        `subject.ilike.%${escapedQuery}%`,
        `snippet.ilike.%${escapedQuery}%`,
      ].join(","),
    );
  }

  return filteredQuery;
}

function buildProjectThreadSummaries(emails: EmailRecord[]) {
  return Array.from(
    emails.reduce((threads, email) => {
      const threadKey = getThreadLabel(email);
      const existingThread = threads.get(threadKey);
      const thread = existingThread ?? {
        count: 0,
        href: getThreadHref(email),
        latest: email.received_at,
        subject: email.subject || "No subject",
      };

      thread.count += 1;

      if (email.received_at && (!thread.latest || new Date(email.received_at) > new Date(thread.latest))) {
        thread.latest = email.received_at;
        thread.subject = email.subject || "No subject";
        thread.href = getThreadHref(email);
      }

      threads.set(threadKey, thread);

      return threads;
    }, new Map<string, ThreadSummary>()),
  );
}

export async function InboxPageContent({ searchParams, source }: InboxPageContentProps) {
  const params = await searchParams;
  const query = params.q?.trim().toLowerCase() ?? "";
  const selectedSource = source ?? params.source ?? "all";
  const selectedStatus = params.status ?? "all";
  const formAction = source ? `/inbox/${source}` : "/inbox";
  const currentPage = getCurrentPage(params.page);
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const filterValues = {
    query,
    selectedSource,
    selectedStatus,
    source,
  };

  const baseEmailQuery = supabase
    .from("inbound_emails")
    .select(
      `
        *,
        contacts (
          id,
          first_name,
          last_name,
          email
        ),
        companies (
          id,
          name
        )
      `,
      {
        count: "exact",
      },
    )
    .order("received_at", { ascending: false })
    .range(from, to);

  const emailQuery = applyFiltersToQuery(
    baseEmailQuery as unknown as FilterableEmailQuery,
    filterValues,
  ) as unknown as PromiseLike<EmailQueryResponse>;

  const baseCountQuery = supabase.from("inbound_emails").select("id", { count: "exact", head: true });
  const countQuery = applyFiltersToQuery(
    baseCountQuery as unknown as FilterableEmailQuery,
    filterValues,
  ) as unknown as PromiseLike<CountQueryResponse>;

  const baseNewCountQuery = supabase.from("inbound_emails").select("id", { count: "exact", head: true });
  const newCountQuery = applyFiltersToQuery(
    baseNewCountQuery as unknown as FilterableEmailQuery,
    {
      ...filterValues,
      selectedStatus: "new",
    },
  ) as unknown as PromiseLike<CountQueryResponse>;

  const baseFollowUpCountQuery = supabase.from("inbound_emails").select("id", { count: "exact", head: true });
  const followUpCountQuery = applyFiltersToQuery(
    baseFollowUpCountQuery as unknown as FilterableEmailQuery,
    {
      ...filterValues,
      selectedStatus: "follow_up",
    },
  ) as unknown as PromiseLike<CountQueryResponse>;

  const baseLinkedCountQuery = supabase.from("inbound_emails").select("id", { count: "exact", head: true });
  const linkedCountQuery = applyFiltersToQuery(
    baseLinkedCountQuery as unknown as FilterableEmailQuery,
    {
      ...filterValues,
      selectedStatus: "linked",
    },
  ) as unknown as PromiseLike<CountQueryResponse>;

  const [
    { data, error, count },
    { count: totalMatchingCount },
    { count: newCount },
    { count: followUpCount },
    { count: linkedCount },
  ] = await Promise.all([
    emailQuery,
    countQuery,
    newCountQuery,
    followUpCountQuery,
    linkedCountQuery,
  ]);

  if (error) {
    return (
      <div className="grid gap-8">
        <header>
          <h1 className="crm-page-title">{getPageTitle(source)}</h1>
        </header>

        <section className="crm-card p-6">
          <h2 className="crm-section-title">Inbox unavailable</h2>
          <p className="crm-muted mt-2">Inbox items could not be loaded.</p>
        </section>
      </div>
    );
  }

  const emails = (data ?? []) as EmailRecord[];
  const totalEmails = count ?? totalMatchingCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalEmails / PAGE_SIZE));
  const hasActiveFilters = Boolean(query) || (!source && selectedSource !== "all") || selectedStatus !== "all";

  let projectThreadEmails: EmailRecord[] = [];

  if (source === "projects") {
    let threadQuery = supabase
      .from("inbound_emails")
      .select(
        `
          id,
          source_inbox,
          subject,
          job_number,
          thread_subject,
          conversation_id,
          received_at
        `,
      )
      .eq("source_inbox", "projects")
      .order("received_at", { ascending: false })
      .limit(200);

    if (selectedStatus !== "all") {
      threadQuery = threadQuery.eq("status", selectedStatus);
    }

    if (query) {
      const escapedQuery = escapeSearchValue(query);

      threadQuery = threadQuery.or(
        [
          `from_email.ilike.%${escapedQuery}%`,
          `from_name.ilike.%${escapedQuery}%`,
          `subject.ilike.%${escapedQuery}%`,
          `snippet.ilike.%${escapedQuery}%`,
        ].join(","),
      );
    }

    const { data: threadRows } = await threadQuery;
    projectThreadEmails = (threadRows ?? []) as EmailRecord[];
  }

  const projectThreads = buildProjectThreadSummaries(projectThreadEmails);

  return (
    <div className="grid gap-8">
      <header>
        <h1 className="crm-page-title">{getPageTitle(source)}</h1>
      </header>

      <nav className="crm-tabs flex flex-wrap gap-3" aria-label="Inbox sections">
        {sourceOptions.map((option) => {
          const isActive = source ? option.value === source : selectedSource === option.value;

          return (
            <Link
              className={`crm-tab inline-flex min-h-11 items-center rounded-[var(--radius)] border px-4 py-2 font-black ${
                isActive
                  ? "crm-tab-active border-[var(--brand-teal)] bg-[var(--brand-teal-soft)] text-[var(--brand-teal-dark)]"
                  : "border-[var(--border-soft)] bg-white"
              }`}
              href={option.href}
              key={option.value}
            >
              {option.label}
            </Link>
          );
        })}
      </nav>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="crm-card crm-kpi p-5">
          <p className="crm-muted font-bold">Matching items</p>
          <p className="mt-2 text-3xl font-black">{totalEmails}</p>
        </div>

        <div className="crm-card crm-kpi crm-kpi-yellow p-5">
          <p className="crm-muted font-bold">New</p>
          <p className="mt-2 text-3xl font-black">{newCount ?? 0}</p>
        </div>

        <div className="crm-card crm-kpi crm-kpi-orange p-5">
          <p className="crm-muted font-bold">Follow up</p>
          <p className="mt-2 text-3xl font-black">{followUpCount ?? 0}</p>
        </div>

        <div className="crm-card crm-kpi p-5">
          <p className="crm-muted font-bold">Linked</p>
          <p className="mt-2 text-3xl font-black">{linkedCount ?? 0}</p>
        </div>
      </section>

      {source === "projects" && (
        <section className="crm-card overflow-hidden">
          <div className="border-b border-[var(--border-soft)] p-5">
            <h2 className="crm-section-title">Project threads</h2>
            <p className="crm-muted mt-2 font-bold">Recent project conversations grouped by job/thread.</p>
          </div>

          <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
            {projectThreads.map(([thread, summary]) => (
              <Link className="crm-panel grid gap-2 p-4 hover:underline" href={summary.href} key={thread}>
                <p className="font-black">{thread}</p>
                <p className="crm-muted text-sm">{summary.subject}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <span className="crm-status-pill">{summary.count} messages</span>
                  <span className="crm-status-pill crm-status-pill-yellow">
                    {formatDate(summary.latest)}
                  </span>
                </div>
              </Link>
            ))}

            {!projectThreads.length && (
              <p className="crm-empty md:col-span-2 xl:col-span-3">No project threads yet.</p>
            )}
          </div>
        </section>
      )}

      <section className="crm-card overflow-hidden">
        <form
          action={formAction}
          className={`grid gap-3 border-b border-gray-200 p-4 ${
            source ? "md:grid-cols-[1fr_170px_auto]" : "md:grid-cols-[1fr_180px_170px_auto]"
          }`}
        >
          <label className="grid gap-2 font-bold md:contents">
            <span className="sr-only">Search inbox</span>
            <input
              className="crm-input"
              defaultValue={params.q ?? ""}
              name="q"
              placeholder="Search sender or subject..."
            />
          </label>

          {!source && (
            <label className="grid gap-2 font-bold md:contents">
              <span className="sr-only">Source inbox</span>
              <select className="crm-input" defaultValue={selectedSource} name="source">
                {sourceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="grid gap-2 font-bold md:contents">
            <span className="sr-only">Status</span>
            <select className="crm-input" defaultValue={selectedStatus} name="status">
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-2">
            <button className="crm-button crm-button-primary min-w-24" type="submit">
              Filter
            </button>

            {hasActiveFilters && (
              <Link className="crm-button" href={formAction}>
                Clear
              </Link>
            )}
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Message</th>
                <th>Inbox</th>
                <th>Job / thread</th>
                <th>Linked to</th>
                <th>Received</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {emails.map((email) => (
                <tr key={email.id} className="hover:bg-gray-50">
                  <td>
                    <div className="grid gap-1">
                      <Link href={`/inbox/message/${email.id}`} className="font-bold underline">
                        {email.subject || "No subject"}
                      </Link>
                      <span className="crm-muted">{email.from_name || email.from_email || "Unknown sender"}</span>
                      {email.snippet && (
                        <span className="crm-muted max-w-xl truncate text-sm">{email.snippet}</span>
                      )}
                    </div>
                  </td>

                  <td>
                    <span className="crm-status-pill">{getSourceLabel(email.source_inbox)}</span>
                  </td>

                  <td>
                    {email.source_inbox === "projects" ? (
                      <Link href={getThreadHref(email)} className="font-bold underline">
                        {getThreadLabel(email)}
                      </Link>
                    ) : (
                      getThreadLabel(email)
                    )}
                  </td>

                  <td>
                    <div className="grid gap-1">
                      {email.contacts?.id ? (
                        <Link href={`/contacts/${email.contacts.id}`} className="font-bold underline">
                          {getContactName(email)}
                        </Link>
                      ) : (
                        <span className="crm-muted">No contact</span>
                      )}
                      {email.companies?.id && (
                        <Link href={`/companies/${email.companies.id}`} className="crm-muted underline">
                          {email.companies.name}
                        </Link>
                      )}
                    </div>
                  </td>

                  <td>{formatDate(email.received_at)}</td>

                  <td>
                    <AutoSaveStatusSelect
                      action={updateEmailStatus.bind(null, email.id)}
                      options={statusOptions.filter((option) => option.value !== "all")}
                      value={email.status ?? "new"}
                    />
                  </td>
                </tr>
              ))}

              {!emails.length && (
                <tr>
                  <td colSpan={6}>No inbox items match these filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-4 py-3">
          <p className="crm-muted font-bold">
            Showing {emails.length ? from + 1 : 0}-{Math.min(to + 1, totalEmails)} of {totalEmails}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {currentPage > 1 ? (
              <Link className="crm-button" href={buildPageHref(formAction, currentPage - 1, filterValues)}>
                Previous
              </Link>
            ) : (
              <span className="crm-button opacity-50">Previous</span>
            )}

            <span className="crm-muted font-bold">
              Page {currentPage} of {totalPages}
            </span>

            {currentPage < totalPages ? (
              <Link className="crm-button" href={buildPageHref(formAction, currentPage + 1, filterValues)}>
                Next
              </Link>
            ) : (
              <span className="crm-button opacity-50">Next</span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
