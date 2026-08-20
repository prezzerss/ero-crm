import Link from "next/link";
import { ProjectForm } from "../_components/project-form";
import { saveProject } from "../actions";
import { getProjectFormOptions } from "../data";

type NewProjectPageProps = {
  searchParams: Promise<{
    companyId?: string;
    jobNumber?: string;
    jobType?: string;
    title?: string;
    trelloCardId?: string;
    trelloCardUrl?: string;
  }>;
};

export default async function NewProjectPage({ searchParams }: NewProjectPageProps) {
  const params = await searchParams;
  const { companies, error, jobTypes } = await getProjectFormOptions();
  const cancelHref = params.companyId ? `/companies/${params.companyId}` : "/projects";

  return (
    <div className="grid gap-8">
      <header>
        <Link className="font-bold underline" href={cancelHref}>
          Back
        </Link>
        <h1 className="crm-page-title mt-6">Register Trello project</h1>
      </header>

      {error && (
        <section className="crm-panel-tint p-5">
          <p className="font-black">Project tables are not ready in Supabase.</p>
          <p className="crm-muted mt-1">
            Run <code>supabase/trello-crm-quoting-schema.sql</code>, then reload this page.
          </p>
        </section>
      )}

      <ProjectForm
        action={saveProject}
        cancelHref={cancelHref}
        companies={companies}
        defaults={{
          company_id: params.companyId,
          job_number: params.jobNumber,
          job_type_name: params.jobType,
          title: params.title,
          trello_card_key: params.trelloCardId,
          trello_card_url: params.trelloCardUrl,
        }}
        jobTypes={jobTypes}
        mode="create"
      />
    </div>
  );
}
