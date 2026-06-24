"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";

function cleanString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue || null;
}

function cleanStatus(value: FormDataEntryValue | null) {
  const status = cleanString(value);

  return status && ["active", "paused", "archived"].includes(status) ? status : "active";
}

function isMissingMailingListTableError(errorMessage: string) {
  return /mailing_lists|mailing_list_contacts|schema cache|Could not find the table/i.test(
    errorMessage,
  );
}

export async function createMailingList(formData: FormData) {
  const { data, error } = await supabase
    .from("mailing_lists")
    .insert({
      name: cleanString(formData.get("name")),
      description: cleanString(formData.get("description")),
      status: cleanStatus(formData.get("status")),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    if (error && isMissingMailingListTableError(error.message)) {
      throw new Error(
        "Mailing list tables are not available in Supabase yet. Run supabase/contact-crm-schema.sql, then retry.",
      );
    }

    throw new Error(error?.message ?? "Could not create mailing list.");
  }

  revalidatePath("/");
  revalidatePath("/mailing-lists");
  redirect(`/mailing-lists/${data.id}`);
}

export async function addContactToMailingList(mailingListId: string, formData: FormData) {
  const contactId = cleanString(formData.get("contact_id"));

  if (!contactId) {
    return;
  }

  const { error } = await supabase
    .from("mailing_list_contacts")
    .upsert(
      {
        mailing_list_id: mailingListId,
        contact_id: contactId,
      },
      {
        onConflict: "mailing_list_id,contact_id",
      },
    );

  if (error) {
    throw new Error(error.message);
  }

  await supabase
    .from("contacts")
    .update({
      mailing_status: "subscribed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", contactId);

  revalidatePath("/");
  revalidatePath("/mailing-lists");
  revalidatePath(`/mailing-lists/${mailingListId}`);
  revalidatePath(`/contacts/${contactId}`);
}

export async function removeContactFromMailingList(mailingListId: string, contactId: string) {
  const { error } = await supabase
    .from("mailing_list_contacts")
    .delete()
    .eq("mailing_list_id", mailingListId)
    .eq("contact_id", contactId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/mailing-lists");
  revalidatePath(`/mailing-lists/${mailingListId}`);
  revalidatePath(`/contacts/${contactId}`);
}
