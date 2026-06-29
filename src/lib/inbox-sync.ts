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

const publicEmailDomains = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
]);

const lifecycleTags = ["active", "inactive", "offline"] as const;

type LifecycleStatus = (typeof lifecycleTags)[number];

type ContactSyncResult = {
  id: string | null;
  companyId: string | null;
  created: boolean;
};

function getEmailDomain(email: string | null) {
  const domain = email?.split("@")[1]?.trim().toLowerCase();

  if (!domain) {
    return null;
  }

  if (domain === "easy-read-online.co.uk") {
    return null;
  }

  if (publicEmailDomains.has(domain)) {
    return null;
  }

  return domain;
}

function titleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function companyNameFromDomain(domain: string) {
  const parts = domain.split(".").filter(Boolean);

  let base = parts[0] ?? domain;

  if (
    domain.endsWith(".gov.uk") ||
    domain.endsWith(".ac.uk") ||
    domain.endsWith(".nhs.uk")
  ) {
    base = parts.slice(0, -2).join(" ") || base;
  }

  return titleCase(base.replace(/[-_]+/g, " "));
}

function getLifecycleStatus(lastContactedAt?: string | null): LifecycleStatus {
  if (!lastContactedAt) {
    return "offline";
  }

  const lastContactedTime = new Date(lastContactedAt).getTime();

  if (Number.isNaN(lastContactedTime)) {
    return "offline";
  }

  const ageMs = Date.now() - lastContactedTime;
  const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
  const threeMonthsMs = 90 * 24 * 60 * 60 * 1000;

  if (ageMs <= twoWeeksMs) {
    return "active";
  }

  if (ageMs <= threeMonthsMs) {
    return "inactive";
  }

  return "offline";
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
): Promise<ContactSyncResult> {
  if (!sender.email || shouldSkipContactCreation(sender.email)) {
    return {
      id: null,
      companyId: null,
      created: false,
    };
  }

  const companyId = await ensureCompanyForSender(supabase, sender, receivedAt);
  const now = new Date().toISOString();

  const { data: existingContacts, error: existingError } = await supabase
    .from("contacts")
    .select("id, company_id")
    .ilike("email", sender.email)
    .limit(1);

  if (existingError) {
    throw new Error(existingError.message);
  }

  const existingContact = existingContacts?.[0];

  if (existingContact?.id) {
    const updatePayload: Record<string, string | null> = {
      last_contacted_at: receivedAt,
      status: "active",
      updated_at: now,
    };

    if (!existingContact.company_id && companyId) {
      updatePayload.company_id = companyId;
    }

    const { error: updateError } = await supabase
      .from("contacts")
      .update(updatePayload)
      .eq("id", existingContact.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    await applySourceTags(supabase, source, existingContact.id as string);
    await setLifecycleTag(supabase, existingContact.id as string, "active");

    return {
      id: existingContact.id as string,
      companyId: (existingContact.company_id as string | null) ?? companyId,
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
      company_id: companyId,
      source_inbox: source,
      mailing_status: "unknown",
      last_contacted_at: receivedAt,
      status: "active",
      updated_at: now,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "Could not create contact from inbox sender.");
  }

  await applySourceTags(supabase, source, data.id as string);
  await setLifecycleTag(supabase, data.id as string, "active");

  return {
    id: data.id as string,
    companyId,
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
    .select("id, contact_id, company_id")
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
    company_id: existingEmail?.company_id ?? contact.companyId,
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

    console.log(`[inbox-sync] Fetching messages for source "${source}" since ${sinceIso}`);

    const messages = await listRecentInboxMessages(inbox.mailbox, sinceIso);

    console.log(`[inbox-sync] Retrieved ${messages.length} messages for source "${source}"`);

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

async function refreshContactLifecycleStatuses(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("contacts")
    .select("id, last_contacted_at");

  if (error) {
    throw new Error(error.message);
  }

  for (const contact of data ?? []) {
    const status = getLifecycleStatus(contact.last_contacted_at);

    const { error: updateError } = await supabase
      .from("contacts")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contact.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    await setLifecycleTag(supabase, contact.id as string, status);
  }
}

export async function syncAllInboxes() {
  const results: SyncResult[] = [];

  for (const inbox of crmInboxes) {
    results.push(await syncInbox(inbox.source));
  }

  const supabase = createSupabaseAdminClient();
  await refreshContactLifecycleStatuses(supabase);

  return results;
}

async function ensureTag(supabase: SupabaseClient, name: string, color: string) {
  const { data, error } = await supabase
    .from("tags")
    .upsert(
      {
        name,
        color,
      },
      {
        onConflict: "name",
      },
    )
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? `Could not create/find tag: ${name}`);
  }

  return data.id as string;
}

async function addTagToContact(
  supabase: SupabaseClient,
  contactId: string | null,
  name: string,
  color: string,
) {
  if (!contactId) {
    return;
  }

  const tagId = await ensureTag(supabase, name, color);

  const { error } = await supabase
    .from("contact_tags")
    .upsert(
      {
        contact_id: contactId,
        tag_id: tagId,
      },
      {
        onConflict: "contact_id,tag_id",
      },
    );

  if (error) {
    throw new Error(error.message);
  }
}

async function setLifecycleTag(
  supabase: SupabaseClient,
  contactId: string | null,
  lifecycleStatus: LifecycleStatus,
) {
  if (!contactId) {
    return;
  }

  const tagEntries = await Promise.all([
    ensureTag(supabase, "active", "#01979d"),
    ensureTag(supabase, "inactive", "#f7a823"),
    ensureTag(supabase, "offline", "#6b7280"),
  ]);

  const selectedTagId = tagEntries[lifecycleTags.indexOf(lifecycleStatus)];

  const { error: deleteError } = await supabase
    .from("contact_tags")
    .delete()
    .eq("contact_id", contactId)
    .in("tag_id", tagEntries);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const { error: upsertError } = await supabase
    .from("contact_tags")
    .upsert(
      {
        contact_id: contactId,
        tag_id: selectedTagId,
      },
      {
        onConflict: "contact_id,tag_id",
      },
    );

  if (upsertError) {
    throw new Error(upsertError.message);
  }
}

async function applySourceTags(
  supabase: SupabaseClient,
  source: SourceInbox,
  contactId: string | null,
) {
  if (!contactId) {
    return;
  }

  if (source === "projects") {
    await addTagToContact(supabase, contactId, "client", "#01979d");
  }

  if (source === "quotes") {
    await addTagToContact(supabase, contactId, "quote follow-up", "#e94e1b");
    await addTagToContact(supabase, contactId, "prospect", "#f7a823");
  }

  if (source === "enquiries") {
    await addTagToContact(supabase, contactId, "prospect", "#f7a823");
  }
}

async function ensureCompanyForSender(
  supabase: SupabaseClient,
  sender: SenderDetails,
  receivedAt: string | null,
) {
  const domain = getEmailDomain(sender.email);

  if (!domain) {
    return null;
  }

  const now = new Date().toISOString();

  const { data: existingCompanies, error: existingError } = await supabase
    .from("companies")
    .select("id")
    .ilike("domain", domain)
    .limit(1);

  if (existingError) {
    throw new Error(existingError.message);
  }

  const existingCompany = existingCompanies?.[0];

  if (existingCompany?.id) {
    const { error: updateError } = await supabase
      .from("companies")
      .update({
        last_contacted_at: receivedAt,
        updated_at: now,
      })
      .eq("id", existingCompany.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return existingCompany.id as string;
  }

  const { data, error } = await supabase
    .from("companies")
    .insert({
      name: companyNameFromDomain(domain),
      domain,
      website: `https://${domain}`,
      status: "active",
      auto_created: true,
      last_contacted_at: receivedAt,
      updated_at: now,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? `Could not create company for ${domain}`);
  }

  return data.id as string;
}