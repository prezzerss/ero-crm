import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  getProjectJobType,
  type CrmProjectRecord,
} from "@/app/projects/data";
import {
  RelatedProjectSelector,
  type RelatedProject,
} from "./_components/related-project-selector";

type CompanyProjectsPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    excludeJobNumber?: string;
    jobType?: string;
  }>;
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
  }).format(date);
}

export default async function CompanyProjectsPage({
  params,
  searchParams,
}: CompanyProjectsPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const requestedJobType = query.jobType?.trim() ?? "";
  const excludedJobNumber = query.excludeJobNumber?.trim().toLowerCase() ?? "";
  const supabase = await createServerSupabaseClient();
  const [companyResult, projectResult] = await Promise.all([
    supabase.from("companies").select("id, name").eq("id", id).maybeSingle(),
    supabase
      .from("crm_projects")
      .select(`
        *,
        crm_job_types (id, name)
      `)
      .eq("company_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!companyResult.data) {
    notFound();
  }

  const projects = (projectResult.data ?? []) as CrmProjectRecord[];
  const currentProject = excludedJobNumber
    ? projects.find((project) => project.job_number.toLowerCase() === excludedJobNumber)
    : null;
  const currentJobType = currentProject ? getProjectJobType(currentProject) : null;
  const effectiveJobTypeName = currentJobType?.name ?? requestedJobType;
  const matchingProjects = projects.filter((project) => {
    const projectJobType = getProjectJobType(project);
    const matchesType = currentJobType
      ? projectJobType?.id === currentJobType.id
      : !requestedJobType ||
        projectJobType?.name.toLowerCase() === requestedJobType.toLowerCase();
    const isCurrentJob =
      Boolean(excludedJobNumber) && project.job_number.toLowerCase() === excludedJobNumber;

    return matchesType && !isCurrentJob;
  });
  const selectorProjects: RelatedProject[] = matchingProjects.map((project) => ({
    date: formatDate(project.started_at ?? project.created_at),
    id: project.id,
    jobNumber: project.job_number,
    title: project.title,
    trelloUrl: project.trello_card_url,
  }));

  return (
    <div className="grid gap-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Link className="font-bold underline" href={`/companies/${id}`}>
            Back to {companyResult.data.name}
          </Link>
          <h1 className="crm-page-title mt-5">Related projects</h1>
          <p className="crm-muted mt-2">
            {effectiveJobTypeName
              ? `${companyResult.data.name} / ${effectiveJobTypeName}`
              : `All linked projects for ${companyResult.data.name}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {effectiveJobTypeName && (
            <Link className="crm-button" href={`/companies/${id}/projects`}>
              Widen to all job types
            </Link>
          )}
          <Link className="crm-button crm-button-primary" href={`/projects/new?companyId=${id}`}>
            Register project
          </Link>
        </div>
      </header>

      {projectResult.error && (
        <section className="crm-panel-tint p-5">
          <p className="font-black">Project history is not ready in Supabase.</p>
          <p className="crm-muted mt-1">
            Run <code>supabase/trello-crm-quoting-schema.sql</code>, then reload this page.
          </p>
        </section>
      )}

      <section className="crm-card overflow-hidden">
        <div className="border-b border-[var(--border-soft)] p-5">
          <h2 className="crm-section-title">Choose reference jobs</h2>
          <p className="crm-muted mt-1">
            The current job is excluded. Results are newest first; nothing is selected automatically.
          </p>
        </div>
        <RelatedProjectSelector projects={selectorProjects} />
      </section>
    </div>
  );
}
