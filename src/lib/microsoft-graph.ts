import "server-only";

export type GraphEmailAddress = {
  address?: string | null;
  name?: string | null;
};

export type GraphRecipient = {
  emailAddress?: GraphEmailAddress | null;
};

export type GraphMessage = {
  id: string;
  internetMessageId?: string | null;
  conversationId?: string | null;
  subject?: string | null;
  bodyPreview?: string | null;
  body?: {
    content?: string | null;
    contentType?: string | null;
  } | null;
  from?: {
    emailAddress?: GraphEmailAddress | null;
  } | null;
  sender?: {
    emailAddress?: GraphEmailAddress | null;
  } | null;
  receivedDateTime?: string | null;
  toRecipients?: GraphRecipient[] | null;
  ccRecipients?: GraphRecipient[] | null;
};

type GraphListResponse<T> = {
  value?: T[];
  "@odata.nextLink"?: string;
};

type TokenCache = {
  accessToken: string;
  expiresAt: number;
};

let tokenCache: TokenCache | null = null;

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

async function getGraphAccessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.accessToken;
  }

  const tenantId = getRequiredEnv("MICROSOFT_TENANT_ID");

  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: getRequiredEnv("MICROSOFT_GRAPH_CLIENT_ID"),
        client_secret: getRequiredEnv("MICROSOFT_GRAPH_CLIENT_SECRET"),
        grant_type: "client_credentials",
        scope: "https://graph.microsoft.com/.default",
      }),
      cache: "no-store",
    },
  );

  const json = await response.json();

  if (!response.ok) {
    throw new Error(
      `Microsoft token request failed: ${json.error_description ?? json.error ?? response.statusText}`,
    );
  }

  tokenCache = {
    accessToken: json.access_token,
    expiresAt: Date.now() + Number(json.expires_in ?? 3600) * 1000,
  };

  return tokenCache.accessToken;
}

async function graphGet<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'outlook.body-content-type="text", IdType="ImmutableId"',
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Microsoft Graph request failed (${response.status}): ${body}`);
  }

  return (await response.json()) as T;
}

function buildMessagesUrl(mailboxAddress: string, sinceIso: string) {
  const url = new URL(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
      mailboxAddress,
    )}/mailFolders/inbox/messages`,
  );

  url.searchParams.set("$top", "50");
  url.searchParams.set("$orderby", "receivedDateTime desc");
  url.searchParams.set("$filter", `receivedDateTime ge ${sinceIso}`);
  url.searchParams.set(
    "$select",
    [
      "id",
      "internetMessageId",
      "conversationId",
      "subject",
      "bodyPreview",
      "body",
      "from",
      "sender",
      "receivedDateTime",
      "toRecipients",
      "ccRecipients",
    ].join(","),
  );

  return url.toString();
}

export async function listRecentInboxMessages(
  mailboxAddress: string,
  sinceIso: string,
): Promise<GraphMessage[]> {
  const accessToken = await getGraphAccessToken();
  const maxPages = Number(process.env.MICROSOFT_GRAPH_MAX_PAGES ?? "4");
  const messages: GraphMessage[] = [];

  let page = 0;
  let nextUrl: string | undefined = buildMessagesUrl(mailboxAddress, sinceIso);

  while (nextUrl && page < maxPages) {
    const pageResponse: GraphListResponse<GraphMessage> =
      await graphGet<GraphListResponse<GraphMessage>>(nextUrl, accessToken);

    messages.push(...(pageResponse.value ?? []));

    nextUrl = pageResponse["@odata.nextLink"];
    page += 1;
  }

  return messages;
}