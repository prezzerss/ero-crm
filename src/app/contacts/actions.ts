"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";

const sourceInboxes = ["projects", "quotes", "enquiries", "manual"];
const mailingStatuses = ["unknown", "subscribed", "unsubscribed", "do_not_contact"];

function cleanString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue || null;
}

function cleanOption(
  value: FormDataEntryValue | null,
  allowedValues: string[],
  fallbackValue: string,
) {
  const cleanedValue = cleanString(value);

  if (cleanedValue && allowedValues.includes(cleanedValue)) {
    return cleanedValue;
  }

  return fallbackValue;
}

function buildContactPayload(formData: FormData, includeCrmColumns = true) {
  const payload: Record<string, string | null> = {
    first_name: cleanString(formData.get("first_name")),
    last_name: cleanString(formData.get("last_name")),
    email: cleanString(formData.get("email")),
    role: cleanString(formData.get("role")),
    company_id: cleanString(formData.get("company_id")),
    status: cleanString(formData.get("status")) ?? "active",
  };

  if (includeCrmColumns) {
    payload.source_inbox = cleanOption(formData.get("source_inbox"), sourceInboxes, "manual");
    payload.mailing_status = cleanOption(
      formData.get("mailing_status"),
      mailingStatuses,
      "unknown",
    );
    payload.notes = cleanString(formData.get("notes"));
    payload.updated_at = new Date().toISOString();
  }

  return payload;
}

function isMissingCrmColumnError(errorMessage: string) {
  return (
    /source_inbox|mailing_status|notes|updated_at/.test(errorMessage) &&
    /column|schema cache|does not exist/i.test(errorMessage)
  );
}

function isMissingNotesColumnError(errorMessage: string) {
  return /notes/.test(errorMessage) && /column|schema cache|does not exist/i.test(errorMessage);
}

function isMissingUpdatedAtColumnError(errorMessage: string) {
  return /updated_at/.test(errorMessage) && /column|schema cache|does not exist/i.test(errorMessage);
}

async function saveContactNotesIfPossible(contactId: string, formData: FormData) {
  const notes = cleanString(formData.get("notes"));

  if (!notes) {
    return;
  }

  let { error } = await supabase
    .from("contacts")
    .update({
      notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", contactId);

  if (error && isMissingUpdatedAtColumnError(error.message)) {
    const fallbackResult = await supabase
      .from("contacts")
      .update({ notes })
      .eq("id", contactId);

    error = fallbackResult.error;
  }

  if (error && !isMissingNotesColumnError(error.message)) {
    throw new Error(error.message);
  }
}

export async function createContact(formData: FormData) {
  let payload = buildContactPayload(formData);
  let { data, error } = await supabase
    .from("contacts")
    .insert(payload)
    .select("id")
    .single();

  if (error && isMissingCrmColumnError(error.message)) {
    payload = buildContactPayload(formData, false);
    const fallbackResult = await supabase
      .from("contacts")
      .insert(payload)
      .select("id")
      .single();

    data = fallbackResult.data;
    error = fallbackResult.error;
  }

  if (error || !data?.id) {
    throw new Error(error?.message ?? "Could not create contact.");
  }

  const contactId = data.id;
  const companyId = cleanString(formData.get("company_id"));

  if (!("notes" in payload)) {
    await saveContactNotesIfPossible(contactId, formData);
  }

  revalidatePath("/");
  revalidatePath("/contacts");
  revalidatePath("/companies");

  if (companyId) {
    revalidatePath(`/companies/${companyId}`);
  }

  redirect(`/contacts/${contactId}`);
}

export async function updateContact(contactId: string, formData: FormData) {
  let payload = buildContactPayload(formData);
  let { error } = await supabase
    .from("contacts")
    .update(payload)
    .eq("id", contactId);

  if (error && isMissingCrmColumnError(error.message)) {
    payload = buildContactPayload(formData, false);
    const fallbackResult = await supabase
      .from("contacts")
      .update(payload)
      .eq("id", contactId);

    error = fallbackResult.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  if (!("notes" in payload)) {
    await saveContactNotesIfPossible(contactId, formData);
  }

  const companyId = cleanString(formData.get("company_id"));

  revalidatePath("/");
  revalidatePath("/contacts");
  revalidatePath("/companies");
  revalidatePath(`/contacts/${contactId}`);

  if (companyId) {
    revalidatePath(`/companies/${companyId}`);
  }

  redirect(`/contacts/${contactId}`);
}

export async function updateContactNotes(contactId: string, formData: FormData) {
  const notes = cleanString(formData.get("notes"));
  let { error } = await supabase
    .from("contacts")
    .update({
      notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", contactId);

  if (error && isMissingUpdatedAtColumnError(error.message)) {
    const fallbackResult = await supabase
      .from("contacts")
      .update({ notes })
      .eq("id", contactId);

    error = fallbackResult.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/contacts");
  revalidatePath(`/contacts/${contactId}`);
}
