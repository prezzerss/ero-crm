import Link from "next/link";
import type { ComponentProps } from "react";
import { clientTypeOptions } from "@/lib/client-types";

type CompanyFormProps = {
  action: ComponentProps<"form">["action"];
  cancelHref: string;
  company?: {
    name?: string | null;
    sector?: string | null;
    status?: string | null;
    website?: string | null;
    billing_contact_name?: string | null;
    billing_email?: string | null;
    billing_address?: string | null;
    notes?: string | null;
    domain?: string | null;
    auto_created?: boolean | null;
  } | null;
  mode: "create" | "edit";
};

const statusOptions = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "offline", label: "Offline" },
];

function normaliseStatus(company: CompanyFormProps["company"]) {
  const status = company?.status?.toLowerCase() ?? "active";

  return statusOptions.some((option) => option.value === status) ? status : "active";
}

export function CompanyForm({
  action,
  cancelHref,
  company,
  mode,
}: CompanyFormProps) {
  return (
    <form action={action} className="crm-card grid gap-6 p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 font-bold">
          <span>Client name</span>
          <input
            className="crm-input"
            defaultValue={company?.name ?? ""}
            name="name"
            placeholder="Organisation name"
            required
          />
        </label>

        <label className="grid gap-2 font-bold">
          <span>Client type</span>
          <select className="crm-input" defaultValue={company?.sector ?? ""} name="sector">
            <option value="">Choose client type</option>
            {clientTypeOptions.map((clientType) => (
              <option key={clientType} value={clientType}>
                {clientType}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 font-bold">
          <span>Status</span>
          <select className="crm-input" defaultValue={normaliseStatus(company)} name="status">
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 font-bold">
          <span>Email domain</span>
          <input
            className="crm-input"
            defaultValue={company?.domain ?? ""}
            name="domain"
            placeholder="example.org.uk"
          />
        </label>

        <label className="grid gap-2 font-bold">
          <span>Website</span>
          <input
            className="crm-input"
            defaultValue={company?.website ?? ""}
            name="website"
            placeholder="https://example.com"
          />
        </label>

        <label className="grid gap-2 font-bold">
          <span>Billing contact</span>
          <input
            className="crm-input"
            defaultValue={company?.billing_contact_name ?? ""}
            name="billing_contact_name"
            placeholder="Finance team, contact name..."
          />
        </label>

        <label className="grid gap-2 font-bold">
          <span>Billing email</span>
          <input
            className="crm-input"
            defaultValue={company?.billing_email ?? ""}
            name="billing_email"
            placeholder="finance@example.com"
            type="email"
          />
        </label>
      </div>

      <label className="grid gap-2 font-bold">
        <span>Billing address</span>
        <textarea
          className="crm-input min-h-28"
          defaultValue={company?.billing_address ?? ""}
          name="billing_address"
          placeholder="Invoice address"
        />
      </label>

      <label className="grid gap-2 font-bold">
        <span>Notes</span>
        <textarea
          className="crm-input min-h-32"
          defaultValue={company?.notes ?? ""}
          name="notes"
          placeholder="Preferences, context, accessibility requirements..."
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <button className="crm-button crm-button-primary" type="submit">
          {mode === "create" ? "Create client" : "Save changes"}
        </button>

        <Link className="crm-button" href={cancelHref}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
