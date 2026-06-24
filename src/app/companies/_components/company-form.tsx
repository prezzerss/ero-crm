import Link from "next/link";
import type { ComponentProps } from "react";

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
  } | null;
  mode: "create" | "edit";
};

export function CompanyForm({ action, cancelHref, company, mode }: CompanyFormProps) {
  return (
    <form action={action} className="crm-card grid gap-6 p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 font-bold">
          <span>Company name</span>
          <input
            className="crm-input"
            defaultValue={company?.name ?? ""}
            name="name"
            placeholder="Organisation name"
            required
          />
        </label>

        <label className="grid gap-2 font-bold">
          <span>Sector</span>
          <input
            className="crm-input"
            defaultValue={company?.sector ?? ""}
            name="sector"
            placeholder="Council, charity, health..."
          />
        </label>

        <label className="grid gap-2 font-bold">
          <span>Status</span>
          <input className="crm-input" defaultValue={company?.status ?? "Active"} name="status" />
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
          {mode === "create" ? "Create company" : "Save changes"}
        </button>

        <Link className="crm-button" href={cancelHref}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
