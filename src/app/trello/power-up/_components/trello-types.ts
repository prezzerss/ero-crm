import type { TrelloCardLink } from "@/lib/trello";

export type TrelloCard = {
  id?: string;
  name?: string;
  shortLink?: string;
  url?: string;
};

export type TrelloIframe = {
  card: (...fields: string[]) => Promise<TrelloCard>;
  closePopup: () => Promise<unknown> | void;
  get: (
    scope: "card",
    visibility: "shared",
    key: string,
    defaultValue?: TrelloCardLink,
  ) => Promise<TrelloCardLink | null>;
  popup: (options: {
    height?: number;
    title: string;
    url: string;
  }) => Promise<unknown> | unknown;
  remove: (scope: "card", visibility: "shared", key: string) => Promise<unknown>;
  set: (
    scope: "card",
    visibility: "shared",
    key: string,
    value: TrelloCardLink,
  ) => Promise<unknown>;
  sizeTo: (selector: string | number | HTMLElement) => Promise<unknown> | unknown;
};

export type TrelloPowerUpClient = {
  iframe: () => TrelloIframe;
  initialize: (capabilities: Record<string, (t: TrelloIframe) => unknown>) => void;
};

declare global {
  interface Window {
    TrelloPowerUp?: TrelloPowerUpClient;
    __eroCrmPowerUpInitialised?: boolean;
  }
}

export const trelloLinkDataKey = "crmLink";

export const emptyTrelloCardLink: TrelloCardLink = {
  companyId: "",
  jobNumber: "",
  jobType: "",
  referenceJobs: "",
};

export function normaliseTrelloCardLink(value?: TrelloCardLink | null): TrelloCardLink {
  return {
    companyId: value?.companyId?.trim() ?? "",
    jobNumber: value?.jobNumber?.trim() ?? "",
    jobType: value?.jobType?.trim() ?? "",
    referenceJobs: value?.referenceJobs?.trim() ?? "",
  };
}
