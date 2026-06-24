import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "./supabase-admin";
import { type GraphMessage, listRecentInboxMessages } from "./microsoft-graph";

const crmInboxes = [
  {
    source: "projects",
    mailbox: "projects@easy-read-online.co.uk",
  },
  {
    source: "quotes",
    mailbox: "quotes@easy-read-online.co.uk",
  },
  {
    source: "enquiries",
    mailbox: "enquiries@easy-read-online.co.uk",
  },
] as const;

export type SourceInbox = (typeof crmInboxes)[number]["source"];

type SyncResult = {
  source: SourceInbox;
  mailbox: string;
  fetched: number;
  inserted: number;
  updated: number;
  contactsCreated: number;
  error?: string;
};

type SenderDetails = {
  email: string | null;
  name: string | null;
};

function getSinceIso(lastSyncedAt?: string | null) {
  if (lastSyncedAt) {
    const date = new Date(lastSyncedAt);

    if (!Number.isNaN(date.getTime())) {
      // Small overlap helps avoid missing emails around sync timing edges.
      return new Date(date.getTime() - 5 * 60 * 1000).toISOString();
    }
  }

  const lookbackDays = Number(process.env.INBOX_SYNC_LOOKBACK_DAYS ?? "14");

  return new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
}

function normaliseEmail(value?: string | null) {
  return value?.trim().replace(/^mailto:/i, "").toLowerCase() || null;
}

function getSender(message: GraphMessage): SenderDetails {
  const from = message.from?.emailAddress ?? message.sender?.emailAddress ?? null;

  return {
    email: normaliseEmail(from?.address),
    name: from?.name?.trim() || null,
  };
}

function getRecipientEmails(recipients?: { emailAddress?: { address?: string | null } | null }[] | null) {
  return (recipients ?? [])
    .map((recipient) => normaliseEmail(recipient.emailAddress?.address))
    .filter((email): email is string => Boolean(email));
}

function shouldSkipContactCreation(email: string | null) {
  if (!email) {
    return true;
  }

  const localPart = email.split("@")[0] ?? "";

  return (
    email.endsWith("@easy-read-online.co.uk") ||
    localPart.includes("noreply") ||
    localPart.includes("no-reply") ||
    localPart.includes("mailer-daemon") ||
    localPart.includes("postmaster")
  );
}

function splitSenderName(displayName: string | null, email: string) {
  const fallback = email.split("@")[0]?.replace(/[._-]+/g, " ") ?? "";
  const usableName = displayName && !displayName.includes("@") ? displayName : fallback;
  const parts = usableName.trim().split(/\s+/).filter(Boolean);
  const firstName = parts.shift() ?? "";

  return {
    firstName: firstName || null,
    lastName: parts.join(" ") || null,
  };
}

function extractJobNumber(subject?: string | null) {
  if (!subject) {
    return null;
  }

  const match =
    subject.match(/\b(?:job|project)\s*#?:?\s*([a-z0-9-]+)/i) ??
    subject.match(/\b([a-z]{2,}-\d{2,}|\d{3,})\b/i);

  return match?.[1]?.toUpperCase() ?? null;
}

function getSuggestedTags(source: SourceInbox) {
  if (source === "quotes") {
    return ["quote follow-up", "prospect"];
  }

  if (source === "enquiries") {
    return ["prospect"];
  }

  return ["client"];
}

async function findOrCreateContact(
  supabase: SupabaseClient,
  source: SourceInbox,
  sender: SenderDetails,
  receivedAt: string | null,
) {
  if (!sender.email || shouldSkipContactCreation(sender.email)) {
    return {
      id: null,
      created: false,
    };
  }

  const { data: existingContacts, error: existingError } = await supabase
    .from("contacts")
    .select("id")
    .ilike("email", sender.email)
    .limit(1);

  if (existingError) {
    throw new Error(existingError.message);
  }

  const existingContact = existingContacts?.[0];

  if (existingContact?.id) {
    const { error: updateError } = await supabase
      .from("contacts")
      .update({
        last_contacted_at: receivedAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingContact.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return {
      id: existingContact.id as string,
      created: false,
    };
  }

  const { firstName, lastName } = splitSenderName(sender.name, sender.email);

  const { data, error } = await supabase
    .from("contacts")
    .insert({
      first_name: firstName,
      last_name: lastName,
      email: sender.email,
      source_inbox: source,
      mailing_status: "unknown",
      last_contacted_at: receivedAt,
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "Could not create contact from inbox sender.");
  }

  return {
    id: data.id as string,
    created: true,
  };
}

async function syncMessage(
  supabase: SupabaseClient,
  source: SourceInbox,
  message: GraphMessage,
) {
  const sender = getSender(message);
  const receivedAt = message.receivedDateTime ?? new Date().toISOString();
  const contact = await findOrCreateContact(supabase, source, sender, receivedAt);

  const { data: existingEmails, error: existingError } = await supabase
    .from("inbound_emails")
    .select("id, contact_id")
    .eq("source_inbox", source)
    .eq("graph_message_id", message.id)
    .limit(1);

  if (existingError) {
    throw new Error(existingError.message);
  }

  const existingEmail = existingEmails?.[0];

  const payload = {
    source_inbox: source,
    graph_message_id: message.id,
    internet_message_id: message.internetMessageId ?? null,
    conversation_id: message.conversationId ?? null,
    from_email: sender.email,
    from_name: sender.name,
    subject: message.subject ?? null,
    snippet: message.bodyPreview ?? null,
    body: message.body?.content ?? message.bodyPreview ?? null,
    job_number: source === "projects" ? extractJobNumber(message.subject) : null,
    thread_subject: message.subject ?? null,
    received_at: receivedAt,
    contact_id: existingEmail?.contact_id ?? contact.id,
    suggested_tags: getSuggestedTags(source),
    to_recipients: getRecipientEmails(message.toRecipients),
    cc_recipients: getRecipientEmails(message.ccRecipients),
    raw_graph: message,
    updated_at: new Date().toISOString(),
  };

  if (existingEmail?.id) {
    const { error } = await supabase
      .from("inbound_emails")
      .update(payload)
      .eq("id", existingEmail.id);

    if (error) {
      throw new Error(error.message);
    }

    return {
      inserted: 0,
      updated: 1,
      contactsCreated: contact.created ? 1 : 0,
    };
  }

  const { error } = await supabase.from("inbound_emails").insert({
    ...payload,
    status: "new",
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    inserted: 1,
    updated: 0,
    contactsCreated: contact.created ? 1 : 0,
  };
}

async function syncInbox(source: SourceInbox): Promise<SyncResult> {
  const inbox = crmInboxes.find((item) => item.source === source);

  if (!inbox) {
    throw new Error(`Unknown inbox source: ${source}`);
  }

  const supabase = createSupabaseAdminClient();

  try {
    const { data: state } = await supabase
      .from("inbox_sync_state")
      .select("last_synced_at")
      .eq("source_inbox", source)
      .maybeSingle();

    const sinceIso = getSinceIso(state?.last_synced_at);
    const messages = await listRecentInboxMessages(inbox.mailbox, sinceIso);

    // Process oldest first so contact.last_contacted_at ends on the newest email.
    messages.sort((a, b) => {
      return (
        new Date(a.receivedDateTime ?? 0).getTime() -
        new Date(b.receivedDateTime ?? 0).getTime()
      );
    });

    const result: SyncResult = {
      source,
      mailbox: inbox.mailbox,
      fetched: messages.length,
      inserted: 0,
      updated: 0,
      contactsCreated: 0,
    };

    for (const message of messages) {
      const itemResult = await syncMessage(supabase, source, message);

      result.inserted += itemResult.inserted;
      result.updated += itemResult.updated;
      result.contactsCreated += itemResult.contactsCreated;
    }

    await supabase.from("inbox_sync_state").upsert(
      {
        source_inbox: source,
        mailbox_address: inbox.mailbox,
        last_synced_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "source_inbox",
      },
    );

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync error";

    await supabase.from("inbox_sync_state").upsert(
      {
        source_inbox: source,
        mailbox_address: inbox.mailbox,
        last_error: message,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "source_inbox",
      },
    );

    return {
      source,
      mailbox: inbox.mailbox,
      fetched: 0,
      inserted: 0,
      updated: 0,
      contactsCreated: 0,
      error: message,
    };
  }
}

export async function syncAllInboxes() {
  const results: SyncResult[] = [];

  for (const inbox of crmInboxes) {
    results.push(await syncInbox(inbox.source));
  }

  return results;
}