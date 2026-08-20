"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getTrelloCardKey, isTrelloCardUrl } from "@/lib/trello";

function cleanString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normaliseDate(value: FormDataEntryValue | null) {
  const cleanedValue = cleanString(value);

  return cleanedValue || null;
}

function buildProjectPayload(formData: FormData) {
  const companyId = cleanString(formData.get("company_id"));
  const jobTypeId = cleanString(formData.get("job_type_id"));
  const jobNumber = cleanString(formData.get("job_number"));
  const title = cleanString(formData.get("title"));
  const trelloCardUrl = cleanString(formData.get("trello_card_url"));
  const trelloCardKey = getTrelloCardKey(
    trelloCardUrl,
    cleanString(formData.get("trello_card_key")),
  );

  if (!companyId || !jobTypeId || !jobNumber || !title) {
    throw new Error("Client, job type, job number and project title are required.");
  }

  if (!isTrelloCardUrl(trelloCardUrl) || !trelloCardKey) {
    throw new Error("Enter a valid Trello card URL such as https://trello.com/c/abc123/card-name.");
  }

  return {
    company_id: companyId,
    job_type_id: jobTypeId,
    job_number: jobNumber,
    title,
    trello_card_key: trelloCardKey,
    trello_card_url: trelloCardUrl,
    trello_status: cleanString(formData.get("trello_status")) || null,
    started_at: normaliseDate(formData.get("started_at")),
    completed_at: normaliseDate(formData.get("completed_at")),
    updated_at: new Date().toISOString(),
  };
}

function formatProjectError(message?: string) {
  if (/crm_projects|crm_job_types|schema cache|does not exist/i.test(message ?? "")) {
    return "Project linking is not available in Supabase yet. Run supabase/trello-crm-quoting-schema.sql, then retry.";
  }

  if (/crm_projects_job_number_uidx|duplicate key.*job_number/i.test(message ?? "")) {
    return "That job number is already linked to another project.";
  }

  return message || "Could not save this project.";
}

export async function saveProject(formData: FormData) {
  const payload = buildProjectPayload(formData);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("crm_projects")
    .upsert(payload, { onConflict: "trello_card_key" })
    .select("id, company_id")
    .single();

  if (error || !data?.id) {
    throw new Error(formatProjectError(error?.message));
  }

  revalidatePath("/projects");
  revalidatePath(`/companies/${data.company_id}`);
  revalidatePath(`/companies/${data.company_id}/projects`);
  redirect(`/companies/${data.company_id}#projects`);
}

export async function updateProject(projectId: string, formData: FormData) {
  const payload = buildProjectPayload(formData);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("crm_projects")
    .update(payload)
    .eq("id", projectId)
    .select("id, company_id")
    .single();

  if (error || !data?.id) {
    throw new Error(formatProjectError(error?.message));
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}/edit`);
  revalidatePath(`/companies/${data.company_id}`);
  revalidatePath(`/companies/${data.company_id}/projects`);
  redirect(`/companies/${data.company_id}#projects`);
}

export async function createJobType(formData: FormData) {
  const name = cleanString(formData.get("name"));

  if (!name) {
    throw new Error("Enter a job type name.");
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("crm_job_types").insert({ name });

  if (error && !/duplicate key/i.test(error.message)) {
    throw new Error(formatProjectError(error.message));
  }

  revalidatePath("/projects");
  revalidatePath("/projects/new");
}
