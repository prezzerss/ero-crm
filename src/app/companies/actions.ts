"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clientTypeOptions } from "@/lib/client-types";
import { supabase } from "@/lib/supabase";
import { createServerSupabaseClient } from "@/lib/supabase-server";

function cleanString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue || null;
}

function buildCompanyPayload(formData: FormData, includeBillingColumns = true) {
  const payload: Record<string, string | null> = {
    name: cleanString(formData.get("name")),
    sector: cleanString(formData.get("sector")),
    status: cleanString(formData.get("status")) ?? "active",
    website: cleanString(formData.get("website")),
    domain: cleanString(formData.get("domain")),
    notes: cleanString(formData.get("notes")),
  };

  if (includeBillingColumns) {
    payload.billing_contact_name = cleanString(formData.get("billing_contact_name"));
    payload.billing_email = cleanString(formData.get("billing_email"));
    payload.billing_address = cleanString(formData.get("billing_address"));
    payload.updated_at = new Date().toISOString();
  }

  return payload;
}

function hasBillingDetails(formData: FormData) {
  return Boolean(
    cleanString(formData.get("billing_contact_name")) ||
    cleanString(formData.get("billing_email")) ||
    cleanString(formData.get("billing_address")),
  );
}

function isMissingBillingColumnError(errorMessage: string) {
  return (
    /billing_contact_name|billing_email|billing_address|updated_at/.test(errorMessage) &&
    /column|schema cache|does not exist/i.test(errorMessage)
  );
}

export async function createCompany(formData: FormData) {
  let payload = buildCompanyPayload(formData);
  let { data, error } = await supabase
    .from("companies")
    .insert(payload)
    .select("id")
    .single();

  if (error && isMissingBillingColumnError(error.message)) {
    if (hasBillingDetails(formData)) {
      throw new Error(
        "Billing fields are not available in Supabase yet. Run supabase/contact-crm-schema.sql, then retry.",
      );
    }

    payload = buildCompanyPayload(formData, false);
    const fallbackResult = await supabase
      .from("companies")
      .insert(payload)
      .select("id")
      .single();

    data = fallbackResult.data;
    error = fallbackResult.error;
  }

  if (error || !data?.id) {
    throw new Error(error?.message ?? "Could not create client.");
  }

  revalidatePath("/");
  revalidatePath("/companies");
  redirect(`/companies/${data.id}`);
}

export async function updateCompany(companyId: string, formData: FormData) {
  let payload = buildCompanyPayload(formData);
  let { error } = await supabase
    .from("companies")
    .update(payload)
    .eq("id", companyId);

  if (error && isMissingBillingColumnError(error.message)) {
    if (hasBillingDetails(formData)) {
      throw new Error(
        "Billing fields are not available in Supabase yet. Run supabase/contact-crm-schema.sql, then retry.",
      );
    }

    payload = buildCompanyPayload(formData, false);
    const fallbackResult = await supabase
      .from("companies")
      .update(payload)
      .eq("id", companyId);

    error = fallbackResult.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/companies");
  revalidatePath(`/companies/${companyId}`);
  redirect(`/companies/${companyId}`);
}

export type UpdateCompanyClientTypeResult =
  | { ok: true }
  | { error: string; ok: false };

export async function updateCompanyClientType(
  companyId: string,
  nextClientType: string,
): Promise<UpdateCompanyClientTypeResult> {
  const clientType = nextClientType.trim();

  if (!companyId.trim()) {
    return { error: "Missing client ID.", ok: false };
  }

  if (clientType && !clientTypeOptions.includes(clientType)) {
    return { error: "Choose a valid client type.", ok: false };
  }

  const authenticatedSupabase = await createServerSupabaseClient();
  const { data, error } = await authenticatedSupabase
    .from("companies")
    .update({
      sector: clientType || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", companyId)
    .select("id")
    .maybeSingle();

  if (error || !data?.id) {
    return {
      error: error?.message ?? "Could not update this client.",
      ok: false,
    };
  }

  revalidatePath("/");
  revalidatePath("/companies");
  revalidatePath(`/companies/${companyId}`);

  return { ok: true };
}
