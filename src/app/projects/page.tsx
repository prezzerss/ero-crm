import Link from "next/link";
import { createJobType } from "./actions";
import {
  getProjectCompany,
  getProjectJobType,
  type CrmProjectRecord,
  type ProjectJobType,
} from "./data";
import { createServerSupabaseClient } from "@/lib/supabase-server";

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

export default async function ProjectsPage() {
  const supabase = await createServerSupabaseClient();
  const [projectResult, jobTypeResult] = await Promise.all([
    supabase
      .from("crm_projects")
      .select(`
        *,
        companies (id, name),
        crm_job_types (id, name)
      `)
      .order("created_at", { ascending: false }),
    supabase.from("crm_job_types").select("id, name, active").order("name"),
  ]);
  const projects = (projectResult.data ?? []) as CrmProjectRecord[];
  const jobTypes = (jobTypeResult.data ?? []) as ProjectJobType[];
  const loadError = projectResult.error?.message ?? jobTypeResult.error?.message ?? null;

  return (
    <div className="grid gap-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="crm-page-title">Projects</h1>
          <p className="crm-muted mt-2 max-w-3xl">
            A searchable index of Trello jobs. Trello remains responsible for project status and
            day-to-day delivery.
          </p>
        </div>
        <Link className="crm-button crm-button-primary" href="/projects/new">
          Register Trello project
        </Link>
      </header>

      {loadError && (
        <section className="crm-panel-tint p-5">
          <p className="font-black">Project tables are not ready in Supabase.</p>
          <p className="crm-muted mt-1">
            Run <code>supabase/trello-crm-quoting-schema.sql</code>, then reload this page.
          </p>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="crm-card crm-kpi p-5">
          <p className="crm-muted font-bold">Linked projects</p>
          <p className="mt-2 text-3xl font-black">{projects.length}</p>
        </div>
        <div className="crm-card crm-kpi crm-kpi-orange p-5">
          <p className="crm-muted font-bold">Active job types</p>
          <p className="mt-2 text-3xl font-black">
            {jobTypes.filter((jobType) => jobType.active !== false).length}
          </p>
        </div>
      </section>

      <section className="crm-card overflow-hidden">
        <div className="border-b border-[var(--border-soft)] p-5">
          <h2 className="crm-section-title">Linked Trello projects</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Client</th>
                <th>Job type</th>
                <th>Trello</th>
                <th>Added</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => {
                const company = getProjectCompany(project);
                const jobType = getProjectJobType(project);

                return (
                  <tr key={project.id}>
                    <td>
                      <p className="font-black">{project.job_number}</p>
                      <p className="crm-muted mt-1">{project.title}</p>
                    </td>
                    <td>
                      {company ? (
                        <Link className="font-bold underline" href={`/companies/${company.id}`}>
                          {company.name}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>{jobType?.name ?? "-"}</td>
                    <td>
                      <a
                        className="font-bold underline"
                        href={project.trello_card_url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Open card
                      </a>
                    </td>
                    <td>{formatDate(project.created_at)}</td>
                    <td>
                      <Link className="crm-button" href={`/projects/${project.id}/edit`}>
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {!projects.length && (
                <tr>
                  <td colSpan={6}>No Trello projects have been registered yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="crm-card p-6">
        <h2 className="crm-section-title">Job types</h2>
        <p className="crm-muted mt-2">
          Similar jobs match only when both the client and this controlled job type are the same.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {jobTypes.map((jobType) => (
            <span className="crm-status-pill" key={jobType.id}>
              {jobType.name}
            </span>
          ))}
        </div>
        <form action={createJobType} className="mt-5 flex flex-col gap-3 md:flex-row">
          <input
            className="crm-input"
            name="name"
            placeholder="Add a controlled job type"
            required
          />
          <button className="crm-button crm-button-primary md:min-w-36" type="submit">
            Add job type
          </button>
        </form>
      </section>
    </div>
  );
}
