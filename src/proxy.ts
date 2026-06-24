import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseKey, getSupabaseUrl, isAllowedEasyReadEmail } from "@/lib/supabase-auth";

function isPublicPath(pathname: string) {
  return (
    pathname === "/sign-in" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  );
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

if (pathname === "/api/inbox/sync") {
  return NextResponse.next();
}
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  if (isPublicPath(request.nextUrl.pathname)) {
    return response;
  }

  const supabase = createServerClient(
    getSupabaseUrl(),
    getSupabaseKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));

          response = NextResponse.next({
            request: {
              headers: requestHeaders,
            },
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { data, error } = await supabase.auth.getClaims();
  const email = data?.claims?.email;

  if (error || typeof email !== "string" || !isAllowedEasyReadEmail(email)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/sign-in";
    redirectUrl.search = "";
    redirectUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);

    if (email && !isAllowedEasyReadEmail(email)) {
      redirectUrl.searchParams.set("error", "domain");
    }

    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
