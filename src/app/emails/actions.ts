"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";

const emailStatuses = ["new", "reviewing", "follow_up", "linked", "ignored"];

function cleanString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue || null;
}

function cleanStatus(value: FormDataEntryValue | null) {
  const status = cleanString(value);

  return status && emailStatuses.includes(status) ? status : "new";
}

function cleanThreadSubject(
  value: FormDataEntryValue | null,
  fallback?: FormDataEntryValue | null,
) {
  return cleanString(value) ?? cleanString(fallback ?? null);
}

function revalidateInboxPaths(emailId?: string) {
  revalidatePath("/");
  revalidatePath("/inbox");
  revalidatePath("/inbox/projects");
  revalidatePath("/inbox/quotes");
  revalidatePath("/inbox/enquiries");

  if (emailId) {
    revalidatePath(`/inbox/message/${emailId}`);
  }
}

function buildEmailReviewPayload(formData: FormData, includeThreadColumns = true) {
  const payload: Record<string, string | null> = {
    status: cleanStatus(formData.get("status")),
    contact_id: cleanString(formData.get("contact_id")),
    company_id: cleanString(formData.get("company_id")),
    notes: cleanString(formData.get("notes")),
    updated_at: new Date().toISOString(),
  };

  if (includeThreadColumns) {
    payload.job_number = cleanString(formData.get("job_number"));
    payload.thread_subject = cleanThreadSubject(
      formData.get("thread_subject"),
      formData.get("subject"),
    );
  }

  return payload;
}

function isMissingThreadColumnError(errorMessage: string) {
  return (
    /job_number|thread_subject/.test(errorMessage) &&
    /column|schema cache|does not exist/i.test(errorMessage)
  );
}

export async function updateEmailStatus(emailId: string, formData: FormData) {
  const { error } = await supabase
    .from("inbound_emails")
    .update({
      status: cleanStatus(formData.get("status")),
      updated_at: new Date().toISOString(),
    })
    .eq("id", emailId);

  if (error) {
    throw new Error(error.message);
  }

  revalidateInboxPaths(emailId);
}

export async function saveEmailReview(emailId: string, formData: FormData) {
  let payload = buildEmailReviewPayload(formData);
  let { error } = await supabase
    .from("inbound_emails")
    .update(payload)
    .eq("id", emailId);

  if (error && isMissingThreadColumnError(error.message)) {
    payload = buildEmailReviewPayload(formData, false);
    const fallbackResult = await supabase
      .from("inbound_emails")
      .update(payload)
      .eq("id", emailId);

    error = fallbackResult.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  revalidateInboxPaths(emailId);
  redirect(`/inbox/message/${emailId}`);
}

export async function autoSaveEmailReview(emailId: string, formData: FormData) {
  let payload = buildEmailReviewPayload(formData);
  let { error } = await supabase
    .from("inbound_emails")
    .update(payload)
    .eq("id", emailId);

  if (error && isMissingThreadColumnError(error.message)) {
    payload = buildEmailReviewPayload(formData, false);
    const fallbackResult = await supabase
      .from("inbound_emails")
      .update(payload)
      .eq("id", emailId);

    error = fallbackResult.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  revalidateInboxPaths(emailId);
}

export async function linkInboxItemToContact(contactId: string, formData: FormData) {
  const emailId = cleanString(formData.get("email_id"));
  const companyId = cleanString(formData.get("company_id"));

  if (!emailId) {
    return;
  }

  const { error } = await supabase
    .from("inbound_emails")
    .update({
      contact_id: contactId,
      company_id: companyId,
      status: "linked",
      updated_at: new Date().toISOString(),
    })
    .eq("id", emailId);

  if (error) {
    throw new Error(error.message);
  }

  revalidateInboxPaths(emailId);
  revalidatePath("/contacts");
  revalidatePath(`/contacts/${contactId}`);

  if (companyId) {
    revalidatePath(`/companies/${companyId}`);
  }
}

export async function linkInboxItemToCompany(companyId: string, formData: FormData) {
  const emailId = cleanString(formData.get("email_id"));

  if (!emailId) {
    return;
  }

  const { error } = await supabase
    .from("inbound_emails")
    .update({
      company_id: companyId,
      status: "linked",
      updated_at: new Date().toISOString(),
    })
    .eq("id", emailId);

  if (error) {
    throw new Error(error.message);
  }

  revalidateInboxPaths(emailId);
  revalidatePath("/companies");
  revalidatePath(`/companies/${companyId}`);
}
