import { createServerSupabaseClient } from "@/lib/supabase-server";

export type ProjectCompany = {
  id: string;
  name: string;
};

export type ProjectJobType = {
  id: string;
  name: string;
  active?: boolean | null;
};

export type CrmProjectRecord = {
  id: string;
  company_id: string;
  job_type_id: string;
  job_number: string;
  title: string;
  trello_card_key: string;
  trello_card_url: string;
  trello_status?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  companies?: ProjectCompany | ProjectCompany[] | null;
  crm_job_types?: ProjectJobType | ProjectJobType[] | null;
};

export function getProjectCompany(project: CrmProjectRecord) {
  return Array.isArray(project.companies)
    ? project.companies[0] ?? null
    : project.companies ?? null;
}

export function getProjectJobType(project: CrmProjectRecord) {
  return Array.isArray(project.crm_job_types)
    ? project.crm_job_types[0] ?? null
    : project.crm_job_types ?? null;
}

export async function getProjectFormOptions() {
  const supabase = await createServerSupabaseClient();
  const [companyResult, jobTypeResult] = await Promise.all([
    supabase.from("companies").select("id, name").order("name"),
    supabase
      .from("crm_job_types")
      .select("id, name, active")
      .eq("active", true)
      .order("name"),
  ]);

  return {
    companies: (companyResult.data ?? []) as ProjectCompany[],
    error: jobTypeResult.error?.message ?? companyResult.error?.message ?? null,
    jobTypes: (jobTypeResult.data ?? []) as ProjectJobType[],
  };
}

export async function getProject(projectId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("crm_projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();

  return {
    error: error?.message ?? null,
    project: (data as CrmProjectRecord | null) ?? null,
  };
}
