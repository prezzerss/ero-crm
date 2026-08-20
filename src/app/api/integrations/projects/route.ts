import { NextRequest, NextResponse } from "next/server";
import { isIntegrationAuthorised, isUuid } from "@/lib/integration-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getTrelloCardKey, isTrelloCardUrl } from "@/lib/trello";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ProjectRequestBody = {
  companyId?: unknown;
  jobNumber?: unknown;
  jobType?: unknown;
  title?: unknown;
  trelloCardId?: unknown;
  trelloCardUrl?: unknown;
  trelloStatus?: unknown;
};

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeLikeValue(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

function getSiteUrl(request: NextRequest) {
  return (process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin).replace(/\/$/, "");
}

export async function POST(request: NextRequest) {
  try {
    if (!isIntegrationAuthorised(request)) {
      return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
    }

    const body = (await request.json()) as ProjectRequestBody;
    const companyId = readString(body.companyId);
    const jobNumber = readString(body.jobNumber);
    const jobTypeName = readString(body.jobType);
    const title = readString(body.title);
    const trelloCardUrl = readString(body.trelloCardUrl);
    const trelloCardKey = getTrelloCardKey(trelloCardUrl, readString(body.trelloCardId));
    const trelloStatus = readString(body.trelloStatus) || null;

    if (!isUuid(companyId)) {
      return NextResponse.json({ error: "A valid stable companyId is required." }, { status: 400 });
    }

    if (!jobNumber || !jobTypeName || !title) {
      return NextResponse.json(
        { error: "jobNumber, jobType and title are required." },
        { status: 400 },
      );
    }

    if (!isTrelloCardUrl(trelloCardUrl) || !trelloCardKey) {
      return NextResponse.json({ error: "A valid Trello card URL is required." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const [{ data: company, error: companyError }, { data: jobTypes, error: jobTypeError }] =
      await Promise.all([
        supabase.from("companies").select("id").eq("id", companyId).maybeSingle(),
        supabase
          .from("crm_job_types")
          .select("id, name")
          .ilike("name", escapeLikeValue(jobTypeName))
          .eq("active", true)
          .limit(1),
      ]);

    if (companyError || jobTypeError) {
      throw new Error(companyError?.message ?? jobTypeError?.message ?? "Could not validate project.");
    }

    if (!company) {
      return NextResponse.json({ error: "Company not found." }, { status: 404 });
    }

    const jobType = jobTypes?.[0];

    if (!jobType) {
      return NextResponse.json(
        { error: `Unknown job type: ${jobTypeName}. Add it in the CRM first.` },
        { status: 400 },
      );
    }

    const { data: project, error } = await supabase
      .from("crm_projects")
      .upsert(
        {
          company_id: companyId,
          job_number: jobNumber,
          job_type_id: jobType.id,
          title,
          trello_card_key: trelloCardKey,
          trello_card_url: trelloCardUrl,
          trello_status: trelloStatus,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "trello_card_key" },
      )
      .select("id, company_id, job_number, title, trello_card_key, trello_card_url")
      .single();

    if (error || !project) {
      if (/crm_projects_job_number_uidx|duplicate key.*job_number/i.test(error?.message ?? "")) {
        return NextResponse.json(
          { error: "That job number is already linked to another Trello card." },
          { status: 409 },
        );
      }

      throw new Error(error?.message ?? "Could not save project.");
    }

    const siteUrl = getSiteUrl(request);
    const relatedQuery = new URLSearchParams({
      excludeJobNumber: jobNumber,
      jobType: jobType.name,
    });

    return NextResponse.json(
      {
        companyId,
        id: project.id,
        jobNumber: project.job_number,
        jobType: jobType.name,
        preferencesUrl: `${siteUrl}/companies/${companyId}#preferences`,
        relatedProjectsUrl: `${siteUrl}/companies/${companyId}/projects?${relatedQuery}`,
        trelloCardId: project.trello_card_key,
        trelloCardUrl: project.trello_card_url,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown integration error.";
    const isConfigurationError = message.includes("CRM_INTEGRATION_SECRET");

    return NextResponse.json(
      {
        error: isConfigurationError ? "Integration API is not configured." : message,
      },
      { status: 500 },
    );
  }
}
