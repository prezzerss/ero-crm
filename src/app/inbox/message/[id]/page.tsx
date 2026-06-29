import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { formatStatus } from "@/lib/format";
import { supabase } from "@/lib/supabase";

type EmailRecord = {
  id: string;
  source_inbox?: string | null;
  from_email?: string | null;
  from_name?: string | null;
  subject?: string | null;
  snippet?: string | null;
  body?: string | null;
  job_number?: string | null;
  thread_subject?: string | null;
  status?: string | null;
  notes?: string | null;
  contact_id?: string | null;
  company_id?: string | null;
  received_at?: string | null;
  conversation_id?: string | null;
};

type LinkedContact = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
};

type LinkedCompany = {
  id: string;
  name: string;
};

type EmailDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function getThreadKey(email: EmailRecord) {
  return email.conversation_id || email.job_number || email.thread_subject;
}

function getThreadHref(email: EmailRecord) {
  const threadKey = getThreadKey(email);

  if (!threadKey || !email.source_inbox) {
    return null;
  }

  return `/inbox/${email.source_inbox}/thread/${encodeURIComponent(threadKey)}`;
}

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

  return "Inbox";
}

function getSourceHref(source?: string | null) {
  if (source === "projects" || source === "quotes" || source === "enquiries") {
    return `/inbox/${source}`;
  }

  return "/inbox";
}

function splitSenderName(name?: string | null) {
  if (!name) {
    return { firstName: "", lastName: "" };
  }

  const nameParts = name.trim().split(/\s+/);
  const firstName = nameParts.shift() ?? "";

  return {
    firstName,
    lastName: nameParts.join(" "),
  };
}

function createContactHref(email: EmailRecord) {
  const params = new URLSearchParams();
  const { firstName, lastName } = splitSenderName(email.from_name);

  if (firstName) {
    params.set("firstName", firstName);
  }

  if (lastName) {
    params.set("lastName", lastName);
  }

  if (email.from_email) {
    params.set("email", email.from_email);
  }

  if (email.source_inbox) {
    params.set("source", email.source_inbox);
  }

  if (email.company_id) {
    params.set("companyId", email.company_id);
  }

  return `/contacts/new?${params.toString()}`;
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

function buildReplyHref(email: EmailRecord) {
  if (!email.from_email) {
    return null;
  }

  const subject = email.subject?.trim().toLowerCase().startsWith("re:")
    ? email.subject
    : `Re: ${email.subject || "Easy Read Online enquiry"}`;

  return `mailto:${email.from_email}?subject=${encodeURIComponent(subject)}`;
}

function getContactName(contact?: LinkedContact | null) {
  if (!contact) {
    return "";
  }

  return [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.email || "";
}

function DetailRow({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="crm-info-row">
      <span className="crm-info-label">{label}</span>
      <span className="crm-info-value">{children}</span>
    </div>
  );
}

export default async function InboxMessagePage({ params }: EmailDetailPageProps) {
  const { id } = await params;

  const { data: email } = await supabase.from("inbound_emails").select("*").eq("id", id).single();

  if (!email) {
    notFound();
  }

  const typedEmail = email as EmailRecord;
  const [{ data: linkedContact }, { data: linkedCompany }] = await Promise.all([
    typedEmail.contact_id
      ? supabase
          .from("contacts")
          .select("id, first_name, last_name, email")
          .eq("id", typedEmail.contact_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    typedEmail.company_id
      ? supabase
          .from("companies")
          .select("id, name")
          .eq("id", typedEmail.company_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const threadHref = getThreadHref(typedEmail);
  const replyHref = buildReplyHref(typedEmail);
  const messageBody = cleanEmailBody(typedEmail.body || typedEmail.snippet);
  const contact = linkedContact as LinkedContact | null;
  const company = linkedCompany as LinkedCompany | null;

  return (
    <div className="grid gap-8">
      <header>
        <Link href={getSourceHref(typedEmail.source_inbox)} className="font-bold underline">
          Back to {getSourceLabel(typedEmail.source_inbox)}
        </Link>
      </header>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_360px]">
        <article className="crm-card p-6 md:p-8">
          <div className="flex flex-wrap gap-2">
            <span className="crm-status-pill">{getSourceLabel(typedEmail.source_inbox)}</span>
            <span className="crm-status-pill crm-status-pill-yellow">
              {formatStatus(typedEmail.status, "Needs review")}
            </span>
          </div>

          <h1 className="crm-page-title mt-4">{typedEmail.subject || "No subject"}</h1>

          <div className="mt-5 grid gap-2 border-b border-[var(--border-soft)] pb-5">
            <p className="font-black">
              {typedEmail.from_name || "Unknown sender"}
            </p>
            <p className="crm-muted break-words font-bold">
              {typedEmail.from_email || "No email address"}
            </p>
            <p className="crm-muted font-bold">{formatDate(typedEmail.received_at)}</p>
          </div>

          <div className="crm-message-body mt-6 break-words">
            {messageBody || "No message body stored."}
          </div>
        </article>

        <aside className="crm-card h-fit p-6">
          <div>
            <h2 className="crm-section-title">Email details</h2>
            <div className="crm-info-grid mt-5">
              <DetailRow label="Source">
                <Link href={getSourceHref(typedEmail.source_inbox)} className="font-bold underline">
                  {getSourceLabel(typedEmail.source_inbox)}
                </Link>
              </DetailRow>

              <DetailRow label="Status">{formatStatus(typedEmail.status, "Needs review")}</DetailRow>

              <DetailRow label="Linked contact">
                {contact ? (
                  <Link href={`/contacts/${contact.id}`} className="font-bold underline">
                    {getContactName(contact)}
                  </Link>
                ) : (
                  <span className="crm-muted">No contact linked</span>
                )}
              </DetailRow>

              <DetailRow label="Linked client">
                {company ? (
                  <Link href={`/companies/${company.id}`} className="font-bold underline">
                    {company.name}
                  </Link>
                ) : (
                  <span className="crm-muted">No client linked</span>
                )}
              </DetailRow>

              <DetailRow label="Thread">
                {threadHref ? (
                  <Link href={threadHref} className="font-bold underline">
                    View thread
                  </Link>
                ) : (
                  <span className="crm-muted">No thread linked</span>
                )}
              </DetailRow>
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            <Link className="crm-button crm-button-primary" href={createContactHref(typedEmail)}>
              Create contact
            </Link>

            {replyHref && (
              <a className="crm-button" href={replyHref}>
                Reply by email
              </a>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}
