import { NextRequest, NextResponse } from "next/server";
import { syncAllInboxes } from "@/lib/inbox-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getExpectedSecrets() {
  return [process.env.CRON_SECRET, process.env.INBOX_SYNC_SECRET].filter(
    (secret): secret is string => Boolean(secret),
  );
}

function isAuthorised(request: NextRequest) {
  const expectedSecrets = getExpectedSecrets();

  if (!expectedSecrets.length) {
    throw new Error("Missing CRON_SECRET or INBOX_SYNC_SECRET.");
  }

  const authorisationHeader = request.headers.get("authorization");

  return expectedSecrets.some((secret) => authorisationHeader === `Bearer ${secret}`);
}

async function handleSync(request: NextRequest) {
  try {
    if (!isAuthorised(request)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorised.",
        },
        {
          status: 401,
        },
      );
    }

    const results = await syncAllInboxes();
    const hasErrors = results.some((result) => Boolean(result.error));

    return NextResponse.json(
      {
        ok: !hasErrors,
        results,
      },
      {
        status: hasErrors ? 207 : 200,
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown sync error.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function GET(request: NextRequest) {
  return handleSync(request);
}

export async function POST(request: NextRequest) {
  return handleSync(request);
}
