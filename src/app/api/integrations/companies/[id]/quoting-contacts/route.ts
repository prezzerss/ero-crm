import { NextRequest, NextResponse } from "next/server";
import { isIntegrationAuthorised, isUuid } from "@/lib/integration-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type QuotingContactRow = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  is_default_quoting_contact?: boolean | null;
};

type RouteContext = {
  params: Promise<{ id: string }>;
};

function getContactName(contact: QuotingContactRow) {
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim() || contact.email || "Unnamed contact";
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    if (!isIntegrationAuthorised(request)) {
      return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
    }

    const { id: companyId } = await context.params;

    if (!isUuid(companyId)) {
      return NextResponse.json({ error: "Invalid company ID." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id")
      .eq("id", companyId)
      .maybeSingle();

    if (companyError) {
      throw new Error(companyError.message);
    }

    if (!company) {
      return NextResponse.json({ error: "Company not found." }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, email, is_default_quoting_contact")
      .eq("company_id", companyId)
      .eq("contact_type", "quoting")
      .not("email", "is", null)
      .order("is_default_quoting_contact", { ascending: false })
      .order("first_name")
      .order("last_name");

    if (error) {
      throw new Error(error.message);
    }

    const response = ((data ?? []) as QuotingContactRow[]).map((contact) => ({
      id: contact.id,
      name: getContactName(contact),
      email: contact.email as string,
      isDefault: Boolean(contact.is_default_quoting_contact),
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
