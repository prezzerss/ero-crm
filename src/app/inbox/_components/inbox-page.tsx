import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { updateEmailStatus } from "../../emails/actions";

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

type InboxPageContentProps = {
  searchParams: Promise<{
    q?: string;
    source?: string;
    status?: string;
  }>;
  source?: SourceKey;
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

function matchesQuery(email: EmailRecord, query: string) {
  if (!query) {
    return true;
  }

  const haystack = [
    email.from_email,
    email.from_name,
    email.subject,
    email.snippet,
    getSourceLabel(email.source_inbox),
    getContactName(email),
    email.companies?.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
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

export async function InboxPageContent({ searchParams, source }: InboxPageContentProps) {
  const params = await searchParams;
  const query = params.q?.trim().toLowerCase() ?? "";
  const selectedSource = source ?? params.source ?? "all";
  const selectedStatus = params.status ?? "all";
  const formAction = source ? `/inbox/${source}` : "/inbox";

  const { data, error } = await supabase
    .from("inbound_emails")
    .select(`
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
    `)
    .order("received_at", { ascending: false });

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

  const allEmails = (data ?? []) as EmailRecord[];
  const scopedEmails = source
    ? allEmails.filter((email) => email.source_inbox === source)
    : allEmails;
  const emails = scopedEmails.filter((email) => {
    return (
      matchesQuery(email, query) &&
      (source || selectedSource === "all" || email.source_inbox === selectedSource) &&
      (selectedStatus === "all" || (email.status ?? "new") === selectedStatus)
    );
  });
  const newCount = scopedEmails.filter((email) => (email.status ?? "new") === "new").length;
  const followUpCount = scopedEmails.filter((email) => email.status === "follow_up").length;
  const linkedCount = scopedEmails.filter((email) => email.status === "linked").length;
  const hasActiveFilters =
    Boolean(query) || (!source && selectedSource !== "all") || selectedStatus !== "all";
  const projectThreads = Array.from(
    scopedEmails
      .filter((email) => email.source_inbox === "projects")
      .reduce((threads, email) => {
        const threadKey = getThreadLabel(email);
        const thread = threads.get(threadKey) ?? {
          count: 0,
          latest: email.received_at,
          subject: email.subject || "No subject",
        };

        thread.count += 1;

        if (
          email.received_at &&
          (!thread.latest || new Date(email.received_at) > new Date(thread.latest))
        ) {
          thread.latest = email.received_at;
          thread.subject = email.subject || "No subject";
        }

        threads.set(threadKey, thread);

        return threads;
      }, new Map<string, { count: number; latest?: string | null; subject: string }>()),
  );

  return (
    <div className="grid gap-8">
      <header>
        <h1 className="crm-page-title">{getPageTitle(source)}</h1>
      </header>

      <nav className="crm-tabs flex flex-wrap gap-3" aria-label="Inbox sections">
        {sourceOptions.map((option) => {
          const isActive = source
            ? option.value === source
            : option.value === "all";

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
          <p className="crm-muted font-bold">Inbox items</p>
          <p className="mt-2 text-3xl font-black">{scopedEmails.length}</p>
        </div>

        <div className="crm-card crm-kpi crm-kpi-yellow p-5">
          <p className="crm-muted font-bold">New</p>
          <p className="mt-2 text-3xl font-black">{newCount}</p>
        </div>

        <div className="crm-card crm-kpi crm-kpi-orange p-5">
          <p className="crm-muted font-bold">Follow up</p>
          <p className="mt-2 text-3xl font-black">{followUpCount}</p>
        </div>

        <div className="crm-card crm-kpi p-5">
          <p className="crm-muted font-bold">Linked</p>
          <p className="mt-2 text-3xl font-black">{linkedCount}</p>
        </div>
      </section>

      {source === "projects" && (
        <section className="crm-card overflow-hidden">
          <div className="border-b border-[var(--border-soft)] p-5">
            <h2 className="crm-section-title">Project threads</h2>
          </div>

          <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
            {projectThreads.map(([thread, summary]) => (
              <div className="crm-panel p-4" key={thread}>
                <p className="font-black">{thread}</p>
                <p className="crm-muted mt-1 text-sm">{summary.subject}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="crm-status-pill">{summary.count} messages</span>
                  <span className="crm-status-pill crm-status-pill-yellow">
                    {formatDate(summary.latest)}
                  </span>
                </div>
              </div>
            ))}

            {!projectThreads.length && (
              <p className="crm-empty md:col-span-2 xl:col-span-3">
                No project threads yet.
              </p>
            )}
          </div>
        </section>
      )}

      <section className="crm-card overflow-hidden">
        <form
          action={formAction}
          className={`grid gap-3 border-b border-gray-200 p-4 ${
            source
              ? "md:grid-cols-[1fr_170px_auto]"
              : "md:grid-cols-[1fr_180px_170px_auto]"
          }`}
        >
          <input
            className="crm-input"
            defaultValue={params.q ?? ""}
            name="q"
            placeholder="Search sender, subject, company..."
          />

          {!source && (
            <select className="crm-input" defaultValue={selectedSource} name="source">
              {sourceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}

          <select className="crm-input" defaultValue={selectedStatus} name="status">
            {statusOptions.map((option) => (
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
                      <span className="crm-muted">
                        {email.from_name || email.from_email || "Unknown sender"}
                      </span>
                      {email.snippet && (
                        <span className="crm-muted max-w-xl truncate text-sm">
                          {email.snippet}
                        </span>
                      )}
                    </div>
                  </td>

                  <td>
                    <span className="crm-status-pill">{getSourceLabel(email.source_inbox)}</span>
                  </td>

                  <td>{getThreadLabel(email)}</td>

                  <td>
                    <div className="grid gap-1">
                      {email.contacts?.id ? (
                        <Link
                          href={`/contacts/${email.contacts.id}`}
                          className="font-bold underline"
                        >
                          {getContactName(email)}
                        </Link>
                      ) : (
                        <span className="crm-muted">No contact</span>
                      )}
                      {email.companies?.id && (
                        <Link
                          href={`/companies/${email.companies.id}`}
                          className="crm-muted underline"
                        >
                          {email.companies.name}
                        </Link>
                      )}
                    </div>
                  </td>

                  <td>{formatDate(email.received_at)}</td>

                  <td>
                    <form action={updateEmailStatus.bind(null, email.id)} className="flex gap-2">
                      <select
                        className="crm-input min-w-36"
                        defaultValue={email.status ?? "new"}
                        name="status"
                      >
                        {statusOptions
                          .filter((option) => option.value !== "all")
                          .map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                      </select>
                      <button className="crm-button" type="submit">
                        Save
                      </button>
                    </form>
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
      </section>
    </div>
  );
}
