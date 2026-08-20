import { NextRequest, NextResponse } from "next/server";
import { isIntegrationAuthorised } from "@/lib/integration-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CompanySearchRow = {
  id: string;
  name?: string | null;
};

function escapeLikeValue(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

export async function GET(request: NextRequest) {
  try {
    if (!isIntegrationAuthorised(request)) {
      return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
    }

    const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";

    if (!search) {
      return NextResponse.json(
        { error: "The search query parameter is required." },
        { status: 400 },
      );
    }

    if (search.length > 100) {
      return NextResponse.json(
        { error: "The search query must be 100 characters or fewer." },
        { status: 400 },
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("companies")
      .select("id, name")
      .not("name", "is", null)
      .ilike("name", `%${escapeLikeValue(search)}%`)
      .order("name")
      .limit(20);

    if (error) {
      throw new Error(error.message);
    }

    const response = ((data ?? []) as CompanySearchRow[])
      .filter((company): company is CompanySearchRow & { name: string } => Boolean(company.name))
      .map((company) => ({
        id: company.id,
        name: company.name,
      }));

    return NextResponse.json(response, {
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
