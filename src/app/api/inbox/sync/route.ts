import { NextRequest, NextResponse } from "next/server";
import { syncAllInboxes } from "@/lib/inbox-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getExpectedSecret() {
  return process.env.CRON_SECRET ?? process.env.INBOX_SYNC_SECRET;
}

function isAuthorised(request: NextRequest) {
  const expectedSecret = getExpectedSecret();

  if (!expectedSecret) {
    throw new Error("Missing CRON_SECRET or INBOX_SYNC_SECRET.");
  }

  return request.headers.get("authorization") === `Bearer ${expectedSecret}`;
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