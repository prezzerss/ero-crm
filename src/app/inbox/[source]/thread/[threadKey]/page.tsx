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

export default async function InboxThreadPage({ params }: ThreadPageProps) {
  const { source, threadKey } = await params;

  if (!["projects", "quotes", "enquiries"].includes(source)) {
    notFound();
  }

  const decodedThreadKey = decodeURIComponent(threadKey);

  const { data } = await supabase
    .from("inbound_emails")
    .select("*")
    .eq("source_inbox", source)
    .or(
      [
        `conversation_id.eq.${decodedThreadKey}`,
        `job_number.eq.${decodedThreadKey}`,
        `thread_subject.eq.${decodedThreadKey}`,
      ].join(","),
    )
    .order("received_at", { ascending: true });

  const emails = (data ?? []) as EmailRecord[];

  if (!emails.length) {
    notFound();
  }

  const title =
    emails[0]?.thread_subject ||
    emails[0]?.job_number ||
    emails[0]?.subject ||
    "Thread";

  return (
    <div className="grid gap-8">
      <header>
        <Link href={`/inbox/${source}`} className="font-bold underline">
          Back to {source}@
        </Link>

        <h1 className="crm-page-title mt-4">{title}</h1>
        <p className="crm-muted mt-2 font-bold">
          {emails.length} messages in this thread
        </p>
      </header>

      <section className="grid gap-4">
        {emails.map((email) => (
          <article className="crm-card p-5" key={email.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link href={`/inbox/message/${email.id}`} className="font-black underline">
                  {email.subject || "No subject"}
                </Link>

                <p className="crm-muted mt-1">
                  {email.from_name || email.from_email || "Unknown sender"}
                </p>
              </div>

              <span className="crm-status-pill">
                {formatDate(email.received_at)}
              </span>
            </div>

            {email.body ? (
              <p className="mt-4 whitespace-pre-wrap">{email.body}</p>
            ) : (
              <p className="crm-muted mt-4">{email.snippet || "No body saved."}</p>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}