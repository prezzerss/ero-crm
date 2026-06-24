import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ThreadPageProps = {
  params: Promise<{
    source: string;
    threadKey: string;
  }>;
};

type EmailRecord = {
  id: string;
  source_inbox?: string | null;
  from_email?: string | null;
  from_name?: string | null;
  subject?: string | null;
  snippet?: string | null;
  body?: string | null;
  status?: string | null;
  job_number?: string | null;
  thread_subject?: string | null;
  conversation_id?: string | null;
  received_at?: string | null;
};

const validSources = ["projects", "quotes", "enquiries"];

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
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function uniqueEmails(rows: EmailRecord[]) {
  return Array.from(new Map(rows.map((row) => [row.id, row])).values()).sort((a, b) => {
    return new Date(a.received_at ?? 0).getTime() - new Date(b.received_at ?? 0).getTime();
  });
}

function cleanEmailBody(value?: string | null) {
  return (value ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildReplyHref(email: EmailRecord) {
  if (!email.from_email) {
    return null;
  }

  const subject = email.subject?.trim().toLowerCase().startsWith("re:")
    ? email.subject
    : `Re: ${email.subject || "Easy Read Online enquiry"}`;

  return `mailto:${email.from_email}?subject=${encodeURIComponent(subject)}`;
}

export default async function InboxThreadPage({ params }: ThreadPageProps) {
  const { source, threadKey } = await params;

  if (!validSources.includes(source)) {
    notFound();
  }

  const decodedThreadKey = decodeURIComponent(threadKey);

  const [byConversation, byJob, byThreadSubject, bySubject, byId] = await Promise.all([
    supabase
      .from("inbound_emails")
      .select("*")
      .eq("source_inbox", source)
      .eq("conversation_id", decodedThreadKey),
    supabase
      .from("inbound_emails")
      .select("*")
      .eq("source_inbox", source)
      .eq("job_number", decodedThreadKey),
    supabase
      .from("inbound_emails")
      .select("*")
      .eq("source_inbox", source)
      .eq("thread_subject", decodedThreadKey),
    supabase
      .from("inbound_emails")
      .select("*")
      .eq("source_inbox", source)
      .eq("subject", decodedThreadKey),
    supabase
      .from("inbound_emails")
      .select("*")
      .eq("source_inbox", source)
      .eq("id", decodedThreadKey),
  ]);

  const emails = uniqueEmails([
    ...((byConversation.data ?? []) as EmailRecord[]),
    ...((byJob.data ?? []) as EmailRecord[]),
    ...((byThreadSubject.data ?? []) as EmailRecord[]),
    ...((bySubject.data ?? []) as EmailRecord[]),
    ...((byId.data ?? []) as EmailRecord[]),
  ]);

  if (!emails.length) {
    notFound();
  }

  const title =
    emails[0]?.thread_subject ||
    emails[0]?.job_number ||
    emails[0]?.subject ||
    "Inbox thread";

  return (
    <div className="grid gap-8">
      <header className="crm-detail-hero p-6 md:p-8">
        <div className="relative z-10">
          <Link href={`/inbox/${source}`} className="font-bold underline">
            Back to {source}@
          </Link>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="crm-status-pill">{source}@</span>
            <span className="crm-status-pill crm-status-pill-yellow">
              {emails.length} messages
            </span>
          </div>

          <h1 className="crm-page-title mt-4">{title}</h1>
          <p className="crm-muted mt-2 font-bold">
            Latest message: {formatDate(emails.at(-1)?.received_at)}
          </p>
        </div>
      </header>

      <section className="crm-thread-timeline">
        {emails.map((email, index) => {
          const replyHref = buildReplyHref(email);

          return (
            <article className="crm-thread-message" key={email.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="crm-thread-number">{index + 1}</span>
                    <Link href={`/inbox/message/${email.id}`} className="font-black underline">
                      {email.subject || "No subject"}
                    </Link>
                  </div>

                  <p className="crm-muted mt-2 font-bold">
                    {email.from_name || email.from_email || "Unknown sender"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="crm-status-pill">{email.status ?? "new"}</span>
                  <span className="crm-status-pill crm-status-pill-yellow">
                    {formatDate(email.received_at)}
                  </span>
                </div>
              </div>

              <div className="crm-message-body mt-5">
                {cleanEmailBody(email.body || email.snippet) || "No message body saved."}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Link className="crm-button" href={`/inbox/message/${email.id}`}>
                  Open message
                </Link>
                {replyHref && (
                  <a className="crm-button" href={replyHref}>
                    Reply by email
                  </a>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
