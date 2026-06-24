import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buildFallbackProfile, getInitials, getStaffProfileByEmail } from "@/lib/profiles";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { signOut } from "../auth/actions";

export const dynamic = "force-dynamic";

type SuggestedEmailRecord = {
  id: string;
  from_email?: string | null;
  from_name?: string | null;
  received_at?: string | null;
  source_inbox?: string | null;
  snippet?: string | null;
  status?: string | null;
  subject?: string | null;
};

function getSourceLabel(source?: string | null) {
  if (source === "projects") {
    return "projects@";
  }

  if (source === "quotes") {
    return "quotes@";
  }

  if (source === "enquiries") {
    return "enquiries@";
  }

  return "Inbox";
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default async function ProfilePage() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  const email = data.user?.email;

  if (error || !email) {
    redirect("/sign-in?next=/profile");
  }

  const profile = getStaffProfileByEmail(email) ?? buildFallbackProfile(email);
  const firstName = profile.name.split(" ")[0] || profile.name;
  const mentionMatch = `%${firstName}%`;
  const { data: suggestedEmailData } = await supabase
    .from("inbound_emails")
    .select("id, source_inbox, from_email, from_name, subject, snippet, received_at, status")
    .or(
      `from_name.ilike.${mentionMatch},subject.ilike.${mentionMatch},snippet.ilike.${mentionMatch},body.ilike.${mentionMatch},notes.ilike.${mentionMatch}`,
    )
    .order("received_at", { ascending: false })
    .limit(5);
  const suggestedEmails = (suggestedEmailData ?? []) as SuggestedEmailRecord[];

  return (
    <div className="grid gap-8">
      <section className="crm-detail-hero overflow-hidden">
        <div className="grid gap-6 p-6 md:grid-cols-[minmax(0,1fr)_260px] md:p-8">
          <div className="relative z-10 grid content-center gap-5">
            <div>
              <h1 className="crm-page-title">{profile.name}</h1>
              <p className="crm-muted mt-3 text-lg font-bold">{profile.email}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="crm-status-pill">{profile.status}</span>
              <span className="crm-status-pill crm-status-pill-yellow">{profile.signIn}</span>
              <span className="crm-status-pill crm-status-pill-orange">{profile.access}</span>
            </div>

            <form action={signOut}>
              <button className="crm-button" type="submit">
                Sign out
              </button>
            </form>
          </div>

          <div className="crm-profile-portrait">
            {profile.imageSrc ? (
              <Image
                alt={`${profile.name} profile illustration`}
                className="crm-profile-image"
                fill
                priority
                sizes="260px"
                src={profile.imageSrc}
              />
            ) : (
              <div className="crm-profile-initials" aria-label={`${profile.name} profile initials`}>
                {getInitials(profile.name)}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="crm-card p-6">
          <h2 className="crm-section-title">Profile details</h2>
          <div className="crm-info-grid mt-5">
            <div className="crm-info-row">
              <p className="crm-info-label">Name</p>
              <p className="crm-info-value">{profile.name}</p>
            </div>
            <div className="crm-info-row">
              <p className="crm-info-label">Email</p>
              <p className="crm-info-value">{profile.email}</p>
            </div>
            <div className="crm-info-row">
              <p className="crm-info-label">Status</p>
              <p className="crm-info-value">{profile.status}</p>
            </div>
            <div className="crm-info-row">
              <p className="crm-info-label">Sign-in</p>
              <p className="crm-info-value">{profile.signIn}</p>
            </div>
            <div className="crm-info-row">
              <p className="crm-info-label">Access</p>
              <p className="crm-info-value">{profile.access}</p>
            </div>
          </div>
        </div>

        <div className="crm-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-soft)] p-5">
            <h2 className="crm-section-title">Recent email mentions</h2>
            <span className="crm-status-pill">{suggestedEmails.length}</span>
          </div>

          <div className="grid divide-y divide-[var(--border-soft)]">
            {suggestedEmails.map((emailRecord) => (
              <Link
                className="grid gap-2 p-5 hover:bg-[#f8fafb]"
                href={`/inbox/message/${emailRecord.id}`}
                key={emailRecord.id}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="crm-status-pill">{getSourceLabel(emailRecord.source_inbox)}</span>
                  <span className="crm-muted font-bold">{formatDate(emailRecord.received_at)}</span>
                </div>
                <p className="font-black underline">{emailRecord.subject || "No subject"}</p>
                <p className="crm-muted font-bold">
                  {emailRecord.from_name || emailRecord.from_email || "Unknown sender"}
                </p>
                {emailRecord.snippet && (
                  <p className="crm-muted line-clamp-2">{emailRecord.snippet}</p>
                )}
              </Link>
            ))}

            {!suggestedEmails.length && (
              <p className="crm-muted p-5 font-bold">
                No recent inbox items mention {firstName} yet.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
