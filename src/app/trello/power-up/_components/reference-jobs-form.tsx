"use client";

import Script from "next/script";
import { useState } from "react";
import { normaliseJobNumberList } from "@/lib/trello";
import {
  emptyTrelloCardLink,
  normaliseTrelloCardLink,
  trelloLinkDataKey,
  type TrelloIframe,
} from "./trello-types";

export function ReferenceJobsForm() {
  const [trello, setTrello] = useState<TrelloIframe | null>(null);
  const [linkData, setLinkData] = useState(emptyTrelloCardLink);

  async function initialiseIframe() {
    if (!window.TrelloPowerUp) {
      return;
    }

    const iframe = window.TrelloPowerUp.iframe();
    const link = normaliseTrelloCardLink(
      await iframe.get("card", "shared", trelloLinkDataKey, emptyTrelloCardLink),
    );
    setTrello(iframe);
    setLinkData(link);
    await iframe.sizeTo("#reference-jobs-form");
  }

  async function saveReferenceJobs(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!trello) {
      return;
    }

    await trello.set("card", "shared", trelloLinkDataKey, {
      ...linkData,
      referenceJobs: normaliseJobNumberList(linkData.referenceJobs),
    });
    await trello.closePopup();
  }

  return (
    <main className="trello-power-up-frame p-3" id="reference-jobs-form">
      <form className="grid gap-3" onSubmit={saveReferenceJobs}>
        <label className="grid gap-1 text-sm font-bold">
          <span>Reference jobs</span>
          <textarea
            className="crm-input min-h-24"
            onChange={(event) =>
              setLinkData((currentLink) => ({
                ...currentLink,
                referenceJobs: event.target.value,
              }))
            }
            placeholder="6242, 6170, 6034"
            value={linkData.referenceJobs}
          />
        </label>
        <p className="crm-muted text-sm">
          Paste the job numbers copied from Similar jobs. They are kept separate from the current job number.
        </p>
        <button className="crm-button crm-button-primary" type="submit">
          Save reference jobs
        </button>
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
