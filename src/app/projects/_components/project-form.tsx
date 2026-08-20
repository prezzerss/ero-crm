import Link from "next/link";
import type { ComponentProps } from "react";
import type { CrmProjectRecord, ProjectCompany, ProjectJobType } from "../data";

type ProjectDefaults = Partial<CrmProjectRecord> & {
  job_type_name?: string;
};

type ProjectFormProps = {
  action: ComponentProps<"form">["action"];
  cancelHref: string;
  companies: ProjectCompany[];
  defaults?: ProjectDefaults | null;
  jobTypes: ProjectJobType[];
  mode: "create" | "edit";
};

function getDefaultJobTypeId(defaults: ProjectDefaults | null | undefined, jobTypes: ProjectJobType[]) {
  if (defaults?.job_type_id) {
    return defaults.job_type_id;
  }

  const requestedName = defaults?.job_type_name?.trim().toLowerCase();

  if (!requestedName) {
    return "";
  }

  return jobTypes.find((jobType) => jobType.name.toLowerCase() === requestedName)?.id ?? "";
}

export function ProjectForm({
  action,
  cancelHref,
  companies,
  defaults,
  jobTypes,
  mode,
}: ProjectFormProps) {
  return (
    <form action={action} className="crm-card grid gap-6 p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 font-bold">
          <span>Client</span>
          <select
            className="crm-input"
            defaultValue={defaults?.company_id ?? ""}
            name="company_id"
            required
          >
            <option value="">Choose client</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 font-bold">
          <span>Job type</span>
          <select
            className="crm-input"
            defaultValue={getDefaultJobTypeId(defaults, jobTypes)}
            name="job_type_id"
            required
          >
            <option value="">Choose job type</option>
            {jobTypes.map((jobType) => (
              <option key={jobType.id} value={jobType.id}>
                {jobType.name}
              </option>
            ))}
          </select>
          {!jobTypes.length && (
            <span className="text-sm font-normal text-red-700">
              No job types are available. Run the database migration or add one on the Projects page.
            </span>
          )}
        </label>

        <label className="grid gap-2 font-bold">
          <span>Current job number</span>
          <input
            className="crm-input"
            defaultValue={defaults?.job_number ?? ""}
            name="job_number"
            placeholder="6123"
            required
          />
        </label>

        <label className="grid gap-2 font-bold">
          <span>Project title</span>
          <input
            className="crm-input"
            defaultValue={defaults?.title ?? ""}
            name="title"
            placeholder="RSN meeting minutes — September 2026"
            required
          />
        </label>

        <label className="grid gap-2 font-bold md:col-span-2">
          <span>Trello card URL</span>
          <input
            className="crm-input"
            defaultValue={defaults?.trello_card_url ?? ""}
            name="trello_card_url"
            placeholder="https://trello.com/c/abc123/card-name"
            required
            type="url"
          />
        </label>

        <label className="grid gap-2 font-bold">
          <span>Trello card ID or short link</span>
          <input
            className="crm-input"
            defaultValue={defaults?.trello_card_key ?? ""}
            name="trello_card_key"
            placeholder="Filled automatically from the URL"
          />
        </label>

        <label className="grid gap-2 font-bold">
          <span>Trello status</span>
          <input
            className="crm-input"
            defaultValue={defaults?.trello_status ?? ""}
            name="trello_status"
            placeholder="Optional, display only"
          />
        </label>

        <label className="grid gap-2 font-bold">
          <span>Started</span>
          <input
            className="crm-input"
            defaultValue={defaults?.started_at ?? ""}
            name="started_at"
            type="date"
          />
        </label>

        <label className="grid gap-2 font-bold">
          <span>Completed</span>
          <input
            className="crm-input"
            defaultValue={defaults?.completed_at ?? ""}
            name="completed_at"
            type="date"
          />
        </label>
      </div>

      <p className="crm-panel-tint p-4 font-bold">
        Trello remains the source of truth for delivery status. This record exists to connect the
        card to client preferences and project history.
      </p>

      <div className="flex flex-wrap gap-3">
        <button className="crm-button crm-button-primary" type="submit">
          {mode === "create" ? "Register Trello project" : "Save project"}
        </button>
        <Link className="crm-button" href={cancelHref}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
