import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { saveEmailReview } from "../../../emails/actions";

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
};

type ContactOption = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
};

type CompanyOption = {
  id: string;
  name: string;
};

type EmailDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const statusOptions = [
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

  return "Inbox";
}

function getSourceHref(source?: string | null) {
  if (source === "projects" || source === "quotes" || source === "enquiries") {
    return `/inbox/${source}`;
  }

  return "/inbox";
}

function getContactName(contact: ContactOption) {
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.email || "";
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

function extractJobNumber(subject?: string | null) {
  if (!subject) {
    return "";
  }

  const match =
    subject.match(/\b(?:job|project)\s*#?:?\s*([a-z0-9-]+)/i) ??
    subject.match(/\b([a-z]{2,}-\d{2,}|\d{3,})\b/i);

  return match?.[1]?.toUpperCase() ?? "";
}

function getDefaultThreadSubject(email: EmailRecord) {
  if (email.thread_subject) {
    return email.thread_subject;
  }

  const jobNumber = email.job_number ?? extractJobNumber(email.subject);

  if (email.source_inbox === "projects" && jobNumber && email.subject) {
    return `${jobNumber} - ${email.subject}`;
  }

  return email.subject ?? "";
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

export default async function InboxMessagePage({ params }: EmailDetailPageProps) {
  const { id } = await params;

  const [{ data: email }, { data: contacts }, { data: companies }] = await Promise.all([
    supabase.from("inbound_emails").select("*").eq("id", id).single(),
    supabase.from("contacts").select("id, first_name, last_name, email").order("first_name"),
    supabase.from("companies").select("id, name").order("name"),
  ]);

  if (!email) {
    notFound();
  }

  const typedEmail = email as EmailRecord;
  const contactOptions = (contacts ?? []) as ContactOption[];
  const companyOptions = (companies ?? []) as CompanyOption[];

  return (
    <div className="grid gap-8">
      <header className="crm-detail-hero p-6 md:p-8">
        <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href={getSourceHref(typedEmail.source_inbox)} className="font-bold underline">
              Back to {getSourceLabel(typedEmail.source_inbox)}
            </Link>

            <h1 className="crm-page-title mt-4">{typedEmail.subject || "No subject"}</h1>
            <p className="crm-muted mt-3 font-bold">
              {typedEmail.from_name || "Unknown sender"} / {typedEmail.from_email || "No email"} /{" "}
              {formatDate(typedEmail.received_at)}
            </p>
          </div>

          <Link className="crm-button crm-button-primary" href={createContactHref(typedEmail)}>
            Create contact
          </Link>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <article className="crm-card p-6">
          <h2 className="crm-section-title">Message</h2>
          {typedEmail.snippet && (
            <p className="crm-muted mt-3 font-bold">{typedEmail.snippet}</p>
          )}
          <div className="crm-muted mt-6 whitespace-pre-wrap">
            {typedEmail.body || "No message body stored."}
          </div>
        </article>

        <form action={saveEmailReview.bind(null, id)} className="crm-card grid gap-5 p-6">
          <h2 className="crm-section-title">Review</h2>

          <label className="grid gap-2 font-bold">
            <span>Status</span>
            <select className="crm-input" defaultValue={typedEmail.status ?? "new"} name="status">
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 font-bold">
            <span>Contact</span>
            <select className="crm-input" defaultValue={typedEmail.contact_id ?? ""} name="contact_id">
              <option value="">No contact linked</option>
              {contactOptions.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {getContactName(contact)}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 font-bold">
            <span>Company</span>
            <select className="crm-input" defaultValue={typedEmail.company_id ?? ""} name="company_id">
              <option value="">No company linked</option>
              {companyOptions.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>

          <input name="subject" type="hidden" value={typedEmail.subject ?? ""} />

          <label className="grid gap-2 font-bold">
            <span>Job number</span>
            <input
              className="crm-input"
              defaultValue={typedEmail.job_number ?? extractJobNumber(typedEmail.subject)}
              name="job_number"
              placeholder="Example: 2451"
            />
          </label>

          <label className="grid gap-2 font-bold">
            <span>Thread subject</span>
            <input
              className="crm-input"
              defaultValue={getDefaultThreadSubject(typedEmail)}
              name="thread_subject"
              placeholder="Short thread name"
            />
          </label>

          <label className="grid gap-2 font-bold">
            <span>Notes</span>
            <textarea
              className="crm-input min-h-32"
              defaultValue={typedEmail.notes ?? ""}
              name="notes"
              placeholder="Follow-up notes, quote context, list decisions..."
            />
          </label>

          <button className="crm-button crm-button-primary" type="submit">
            Save review
          </button>
        </form>
      </section>
    </div>
  );
}
