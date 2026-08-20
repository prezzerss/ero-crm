"use client";

import Script from "next/script";
import {
  emptyTrelloCardLink,
  normaliseTrelloCardLink,
  trelloLinkDataKey,
  type TrelloCard,
  type TrelloIframe,
} from "./trello-types";

function openPopup(t: TrelloIframe, title: string, url: string, height = 360) {
  return t.popup({ height, title, url });
}

function buildRegisterProjectUrl(origin: string, link: ReturnType<typeof normaliseTrelloCardLink>, card: TrelloCard) {
  const params = new URLSearchParams({
    companyId: link.companyId,
    jobNumber: link.jobNumber,
    jobType: link.jobType,
    title: card.name ?? link.jobNumber,
    trelloCardId: card.id ?? card.shortLink ?? "",
    trelloCardUrl: card.url ?? "",
  });

  return `${origin}/projects/new?${params}`;
}

function initialisePowerUp() {
  if (!window.TrelloPowerUp || window.__eroCrmPowerUpInitialised) {
    return;
  }

  window.__eroCrmPowerUpInitialised = true;
  const origin = window.location.origin;
  const icon = `${origin}/trello-crm-icon.svg`;

  window.TrelloPowerUp.initialize({
    "card-buttons": async (t) => {
      const [storedLink, card] = await Promise.all([
        t.get("card", "shared", trelloLinkDataKey, emptyTrelloCardLink),
        t.card("id", "name", "url", "shortLink"),
      ]);
      const link = normaliseTrelloCardLink(storedLink);
      const buttons: Array<Record<string, unknown>> = [
        {
          callback: (buttonContext: TrelloIframe) =>
            openPopup(buttonContext, link.companyId ? "Edit CRM link" : "Link to CRM", `${origin}/trello/power-up/link`, 420),
          condition: "edit",
          icon,
          text: link.companyId ? "Edit CRM link" : "Link to CRM",
        },
      ];

      if (!link.companyId) {
        return buttons;
      }

      buttons.push({
        condition: "signedIn",
        icon,
        target: "ero-crm-preferences",
        text: "Client preferences",
        url: `${origin}/companies/${encodeURIComponent(link.companyId)}#preferences`,
      });

      if (link.jobType) {
        const relatedQuery = new URLSearchParams({
          excludeJobNumber: link.jobNumber,
          jobType: link.jobType,
        });
        buttons.push({
          condition: "signedIn",
          icon,
          target: "ero-crm-related-projects",
          text: "Similar jobs",
          url: `${origin}/companies/${encodeURIComponent(link.companyId)}/projects?${relatedQuery}`,
        });
      }

      if (link.jobNumber && link.jobType && card.url) {
        buttons.push({
          condition: "edit",
          icon,
          target: "ero-crm-register-project",
          text: "Register in CRM",
          url: buildRegisterProjectUrl(origin, link, card),
        });
      }

      buttons.push({
        callback: (buttonContext: TrelloIframe) =>
          openPopup(buttonContext, "Reference jobs", `${origin}/trello/power-up/reference-jobs`, 260),
        condition: "edit",
        icon,
        text: "Reference jobs",
      });

      return buttons;
    },
    "card-badges": async (t) => {
      const link = normaliseTrelloCardLink(
        await t.get("card", "shared", trelloLinkDataKey, emptyTrelloCardLink),
      );

      if (!link.companyId) {
        return [];
      }

      return [
        {
          color: "sky",
          icon,
          text: link.jobNumber ? `CRM ${link.jobNumber}` : "CRM linked",
        },
      ];
    },
    "card-detail-badges": async (t) => {
      const link = normaliseTrelloCardLink(
        await t.get("card", "shared", trelloLinkDataKey, emptyTrelloCardLink),
      );

      if (!link.companyId) {
        return [];
      }

      const badges: Array<Record<string, unknown>> = [
        {
          callback: (badgeContext: TrelloIframe) =>
            openPopup(badgeContext, "Edit CRM link", `${origin}/trello/power-up/link`, 420),
          color: "sky",
          text: link.jobNumber || "Linked",
          title: "CRM job",
        },
      ];

      if (link.jobType) {
        badges.push({ text: link.jobType, title: "Job type" });
      }

      if (link.referenceJobs) {
        badges.push({
          callback: (badgeContext: TrelloIframe) =>
            openPopup(badgeContext, "Reference jobs", `${origin}/trello/power-up/reference-jobs`, 260),
          text: link.referenceJobs,
          title: "Reference jobs",
        });
      }

      return badges;
    },
  });
}

export function PowerUpConnector() {
  return (
    <main className="trello-power-up-frame p-5">
      <p className="font-bold">Easy Read Online CRM Power-Up connector</p>
      <Script
        onLoad={initialisePowerUp}
        src="https://p.trellocdn.com/power-up.min.js"
        strategy="afterInteractive"
      />
    </main>
  );
}
