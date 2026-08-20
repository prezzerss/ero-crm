import "server-only";

import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

function matchesSecret(candidate: string, expected: string) {
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);

  return (
    candidateBuffer.length === expectedBuffer.length &&
    timingSafeEqual(candidateBuffer, expectedBuffer)
  );
}

export function isIntegrationAuthorised(request: NextRequest) {
  const expectedSecret = process.env.CRM_INTEGRATION_SECRET;

  if (!expectedSecret) {
    throw new Error("Missing CRM_INTEGRATION_SECRET.");
  }

  const authorisationHeader = request.headers.get("authorization");

  if (!authorisationHeader?.startsWith("Bearer ")) {
    return false;
  }

  return matchesSecret(authorisationHeader.slice("Bearer ".length), expectedSecret);
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
