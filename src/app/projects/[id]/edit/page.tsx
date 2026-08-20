import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectForm } from "../../_components/project-form";
import { updateProject } from "../../actions";
import { getProject, getProjectFormOptions } from "../../data";

type EditProjectPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditProjectPage({ params }: EditProjectPageProps) {
  const { id } = await params;
  const [{ project }, { companies, jobTypes }] = await Promise.all([
    getProject(id),
    getProjectFormOptions(),
  ]);

  if (!project) {
    notFound();
  }

  return (
    <div className="grid gap-8">
      <header>
        <Link className="font-bold underline" href={`/companies/${project.company_id}`}>
          Back to client
        </Link>
        <h1 className="crm-page-title mt-6">Edit {project.job_number}</h1>
      </header>
      <ProjectForm
        action={updateProject.bind(null, id)}
        cancelHref={`/companies/${project.company_id}`}
        companies={companies}
        defaults={project}
        jobTypes={jobTypes}
        mode="edit"
      />
    </div>
  );
}
