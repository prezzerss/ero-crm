export type TrelloCardLink = {
  companyId: string;
  jobNumber: string;
  jobType: string;
  referenceJobs: string;
};

export function getTrelloCardKey(cardUrl: string, explicitKey?: string | null) {
  const cleanedKey = explicitKey?.trim();

  if (cleanedKey) {
    return cleanedKey;
  }

  try {
    const url = new URL(cardUrl);
    const match = url.pathname.match(/^\/c\/([^/]+)/);

    return match?.[1] ?? "";
  } catch {
    return "";
  }
}

export function isTrelloCardUrl(value: string) {
  try {
    const url = new URL(value);

    return url.protocol === "https:" && url.hostname === "trello.com" && /^\/c\/[^/]+/.test(url.pathname);
  } catch {
    return false;
  }
}

export function normaliseJobNumberList(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\s,;]+/)
        .map((jobNumber) => jobNumber.trim())
        .filter(Boolean),
    ),
  ).join(", ");
}
