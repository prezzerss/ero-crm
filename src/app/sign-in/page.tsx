import Image from "next/image";
import { SignInButtons } from "./sign-in-buttons";

type SignInPageProps = {
  searchParams: Promise<{
    detail?: string;
    error?: string;
    next?: string;
  }>;
};

function getErrorMessage(error?: string, detail?: string) {
  if (error === "domain") {
    return "Use an @easy-read-online.co.uk email address to access the CRM.";
  }

  if (error === "tenant") {
    return (
      "Microsoft is rejecting this Azure app because Supabase is using the common tenant. " +
      "In Supabase Auth > Providers > Azure, set the Azure Tenant URL to your Easy Read Online tenant."
    );
  }

  if (error === "exchange") {
    return detail
      ? `Supabase could not finish the session: ${detail}`
      : "Supabase could not finish the session. Please check the redirect URL settings.";
  }

  if (error === "auth") {
    return detail ? `Sign-in could not be completed: ${detail}` : "Sign-in could not be completed. Please try again.";
  }

  return "";
}

function normaliseNextPath(next?: string) {
  if (!next?.startsWith("/") || next.startsWith("//")) {
    return "/";
  }

  return next;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const nextPath = normaliseNextPath(params.next);
  const errorMessage = getErrorMessage(params.error, params.detail);

  return (
    <main className="crm-auth-page">
      <section className="crm-auth-shell">
        <div className="crm-auth-copy">
          <div className="crm-auth-shapes" aria-hidden="true">
            <span className="crm-auth-square" />
            <span className="crm-auth-circle" />
            <span className="crm-auth-triangle" />
          </div>

          <div className="crm-auth-logo">
            <Image
              alt="Easy Read Online logo"
              height={963}
              priority
              src="/er_logo.jpg"
              style={{ height: "auto" }}
              width={669}
            />
          </div>

          <div>
            <p className="crm-eyebrow">Private CRM</p>
            <h1 className="crm-page-title mt-2">Sign in</h1>
          </div>

          <SignInButtons nextPath={nextPath} />

          {errorMessage && (
            <p className="rounded-[var(--radius)] border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
              {errorMessage}
            </p>
          )}
        </div>

        <div className="crm-auth-image-panel">
          <Image
            alt="Easy Read Online artwork"
            className="crm-auth-image"
            fill
            priority
            sizes="(max-width: 900px) 100vw, 48vw"
            src="/pres-cold.png"
          />
        </div>
      </section>
    </main>
  );
}
