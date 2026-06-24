import Link from "next/link";
import type { ComponentProps } from "react";
import type { CompanyOption, TagOption } from "../data";

type ContactFormContact = {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  role?: string | null;
  company_id?: string | null;
  status?: string | null;
  source_inbox?: string | null;
  source?: string | null;
  source_email?: string | null;
  mailing_status?: string | null;
  notes?: string | null;
};

type ContactFormProps = {
  action: ComponentProps<"form">["action"];
  cancelHref: string;
  companies: CompanyOption[];
  contact?: ContactFormContact | null;
  defaultCompanyId?: string;
  mode: "create" | "edit";
  selectedTagIds?: string[];
  tags: TagOption[];
};

const sourceInboxOptions = [
  { value: "manual", label: "Manual" },
  { value: "projects", label: "projects@" },
  { value: "quotes", label: "quotes@" },
  { value: "enquiries", label: "enquiries@" },
];

const mailingStatusOptions = [
  { value: "unknown", label: "Unknown" },
  { value: "subscribed", label: "Subscribed" },
  { value: "unsubscribed", label: "Unsubscribed" },
  { value: "do_not_contact", label: "Do not contact" },
];

function normaliseSource(contact?: ContactFormContact | null) {
  const source = contact?.source_inbox ?? contact?.source ?? contact?.source_email ?? "manual";

  if (source.includes("project")) {
    return "projects";
  }

  if (source.includes("quote")) {
    return "quotes";
  }

  if (source.includes("enquir") || source.includes("inquir")) {
    return "enquiries";
  }

  return sourceInboxOptions.some((option) => option.value === source) ? source : "manual";
}

function normaliseMailingStatus(contact?: ContactFormContact | null) {
  const mailingStatus = contact?.mailing_status ?? "unknown";

  return mailingStatusOptions.some((option) => option.value === mailingStatus)
    ? mailingStatus
    : "unknown";
}

export function ContactForm({
  action,
  cancelHref,
  companies,
  contact,
  defaultCompanyId,
  mode,
  selectedTagIds = [],
  tags,
}: ContactFormProps) {
  return (
    <form action={action} className="crm-card grid gap-6 p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 font-bold">
          <span>First name</span>
          <input
            className="crm-input"
            defaultValue={contact?.first_name ?? ""}
            name="first_name"
            placeholder="First name"
          />
        </label>

        <label className="grid gap-2 font-bold">
          <span>Last name</span>
          <input
            className="crm-input"
            defaultValue={contact?.last_name ?? ""}
            name="last_name"
            placeholder="Last name"
          />
        </label>

        <label className="grid gap-2 font-bold">
          <span>Email</span>
          <input
            className="crm-input"
            defaultValue={contact?.email ?? ""}
            name="email"
            placeholder="name@example.com"
            type="email"
          />
        </label>

        <label className="grid gap-2 font-bold">
          <span>Role</span>
          <input
            className="crm-input"
            defaultValue={contact?.role ?? ""}
            name="role"
            placeholder="Project lead, comms lead..."
          />
        </label>

        <label className="grid gap-2 font-bold">
          <span>Company</span>
          <select
            className="crm-input"
            defaultValue={contact?.company_id ?? defaultCompanyId ?? ""}
            name="company_id"
          >
            <option value="">No company</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 font-bold">
          <span>Status</span>
          <input
            className="crm-input"
            defaultValue={contact?.status ?? "Active"}
            name="status"
            placeholder="Active"
          />
        </label>

        <label className="grid gap-2 font-bold">
          <span>Source inbox</span>
          <select className="crm-input" defaultValue={normaliseSource(contact)} name="source_inbox">
            {sourceInboxOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 font-bold">
          <span>Mailing status</span>
          <select
            className="crm-input"
            defaultValue={normaliseMailingStatus(contact)}
            name="mailing_status"
          >
            {mailingStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="grid gap-2 font-bold">
        <span>Tags</span>
        <select
          className="crm-input min-h-36"
          defaultValue={selectedTagIds}
          multiple
          name="tag_ids"
        >
          {tags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-2 font-bold">
        <span>Notes</span>
        <textarea
          className="crm-input min-h-36"
          defaultValue={contact?.notes ?? ""}
          name="notes"
          placeholder="Preferences, follow-up context, project notes..."
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <button className="crm-button crm-button-primary" type="submit">
          {mode === "create" ? "Create contact" : "Save changes"}
        </button>

        <Link className="crm-button" href={cancelHref}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
