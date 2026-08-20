"use client";

import Script from "next/script";
import { useState } from "react";
import {
  emptyTrelloCardLink,
  normaliseTrelloCardLink,
  trelloLinkDataKey,
  type TrelloIframe,
} from "./trello-types";

export function LinkCardForm() {
  const [trello, setTrello] = useState<TrelloIframe | null>(null);
  const [companyId, setCompanyId] = useState("");
  const [jobNumber, setJobNumber] = useState("");
  const [jobType, setJobType] = useState("");
  const [referenceJobs, setReferenceJobs] = useState("");
  const [error, setError] = useState("");

  async function initialiseIframe() {
    if (!window.TrelloPowerUp) {
      return;
    }

    const iframe = window.TrelloPowerUp.iframe();
    const link = normaliseTrelloCardLink(
      await iframe.get("card", "shared", trelloLinkDataKey, emptyTrelloCardLink),
    );
    setTrello(iframe);
    setCompanyId(link.companyId);
    setJobNumber(link.jobNumber);
    setJobType(link.jobType);
    setReferenceJobs(link.referenceJobs);
    await iframe.sizeTo("#crm-link-form");
  }

  async function saveLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!trello) {
      setError("Trello has not finished loading. Try again.");
      return;
    }

    if (!companyId.trim() || !jobNumber.trim() || !jobType.trim()) {
      setError("Company ID, current job number and job type are required.");
      return;
    }

    await trello.set("card", "shared", trelloLinkDataKey, {
      companyId: companyId.trim(),
      jobNumber: jobNumber.trim(),
      jobType: jobType.trim(),
      referenceJobs: referenceJobs.trim(),
    });
    await trello.closePopup();
  }

  async function unlinkCard() {
    if (!trello) {
      return;
    }

    await trello.remove("card", "shared", trelloLinkDataKey);
    await trello.closePopup();
  }

  return (
    <main className="trello-power-up-frame p-3" id="crm-link-form">
      <form className="grid gap-3" onSubmit={saveLink}>
        <label className="grid gap-1 text-sm font-bold">
          <span>CRM company ID</span>
          <input
            autoComplete="off"
            className="crm-input"
            onChange={(event) => setCompanyId(event.target.value)}
            placeholder="Copy from the CRM client page"
            value={companyId}
          />
        </label>
        <label className="grid gap-1 text-sm font-bold">
          <span>Current job number</span>
          <input
            autoComplete="off"
            className="crm-input"
            onChange={(event) => setJobNumber(event.target.value)}
            placeholder="6123"
            value={jobNumber}
          />
        </label>
        <label className="grid gap-1 text-sm font-bold">
          <span>Job type</span>
          <input
            autoComplete="off"
            className="crm-input"
            onChange={(event) => setJobType(event.target.value)}
            placeholder="Meeting minutes"
            value={jobType}
          />
        </label>
        {error && <p className="text-sm font-bold text-red-700">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button className="crm-button crm-button-primary" type="submit">
            Save CRM link
          </button>
          {companyId && (
            <button className="crm-button" onClick={unlinkCard} type="button">
              Unlink
            </button>
          )}
        </div>
      </form>
      <Script
        onReady={() => {
          void initialiseIframe();
        }}
        src="https://p.trellocdn.com/power-up.min.js"
        strategy="afterInteractive"
      />
    </main>
  );
}
