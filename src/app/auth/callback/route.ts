import { NextResponse } from "next/server";
import { isAllowedEasyReadEmail } from "@/lib/supabase-auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";

function normaliseNextPath(next: string | null) {
  if (!next?.startsWith("/") || next.startsWith("//")) {
    return "/";
  }

  return next;
}

function buildSignInRedirect(origin: string, error: string, nextPath: string, detail?: string) {
  const redirectUrl = new URL("/sign-in", origin);

  redirectUrl.searchParams.set("error", error);
  redirectUrl.searchParams.set("next", nextPath);

  if (detail) {
    redirectUrl.searchParams.set("detail", detail);
  }

  return redirectUrl;
}

function getProviderErrorReason(description: string | null) {
  if (description?.includes("AADSTS50194")) {
    return {
      error: "tenant",
      detail: "Set the Azure Tenant URL in Supabase Auth, or make the Azure app multi-tenant.",
    };
  }

  return {
    error: "auth",
    detail: description ?? undefined,
  };
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = normaliseNextPath(requestUrl.searchParams.get("next"));
  const origin = requestUrl.origin;
  const providerError = requestUrl.searchParams.get("error");
  const providerErrorDescription = requestUrl.searchParams.get("error_description");

  if (providerError) {
    const reason = getProviderErrorReason(providerErrorDescription);

    return NextResponse.redirect(
      buildSignInRedirect(origin, reason.error, nextPath, reason.detail),
    );
  }

  if (!code) {
    return NextResponse.redirect(buildSignInRedirect(origin, "auth", nextPath));
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      buildSignInRedirect(origin, "exchange", nextPath, error.message),
    );
  }

  const { data: userResult, error: userError } = await supabase.auth.getUser();
  const email = userResult.user?.email;

  if (userError || typeof email !== "string") {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      buildSignInRedirect(origin, "auth", nextPath, userError?.message),
    );
  }

  if (!isAllowedEasyReadEmail(email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(buildSignInRedirect(origin, "domain", nextPath));
  }

  return NextResponse.redirect(`${origin}${nextPath}`);
}
