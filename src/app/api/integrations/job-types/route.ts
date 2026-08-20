import { NextRequest, NextResponse } from "next/server";
import { isIntegrationAuthorised } from "@/lib/integration-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    if (!isIntegrationAuthorised(request)) {
      return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("crm_job_types")
      .select("id, name")
      .eq("active", true)
      .order("name");

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json(data ?? [], {
      headers: {
        "Cache-Control": "no-store",
      },
    });
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
