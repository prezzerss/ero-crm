"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { UpdateCompanyClientTypeResult } from "@/app/companies/actions";

type InlineClientTypeSelectProps = {
  action: (nextClientType: string) => Promise<UpdateCompanyClientTypeResult>;
  clientName: string;
  options: string[];
  value?: string | null;
};

export function InlineClientTypeSelect({
  action,
  clientName,
  options,
  value,
}: InlineClientTypeSelectProps) {
  const router = useRouter();
  const initialValue = value ?? "";
  const [selectedValue, setSelectedValue] = useState(initialValue);
  const [feedback, setFeedback] = useState("");
  const [isPending, startTransition] = useTransition();
  const selectOptions =
    initialValue && !options.includes(initialValue)
      ? [initialValue, ...options]
      : options;

  function saveClientType(nextValue: string) {
    const previousValue = selectedValue;
    setSelectedValue(nextValue);
    setFeedback("");

    startTransition(async () => {
      try {
        const result = await action(nextValue);

        if (!result.ok) {
          setSelectedValue(previousValue);
          setFeedback(result.error);
          return;
        }

        setFeedback("Saved");
        router.refresh();
      } catch {
        setSelectedValue(previousValue);
        setFeedback("Could not save");
      }
    });
  }

  return (
    <div className="grid min-w-52 gap-1">
      <select
        aria-label={`Client type for ${clientName}`}
        className="crm-input"
        disabled={isPending}
        onChange={(event) => saveClientType(event.target.value)}
        value={selectedValue}
      >
        <option value="">No client type</option>
        {selectOptions.map((clientType) => (
          <option key={clientType} value={clientType}>
            {clientType}
          </option>
        ))}
      </select>

      <span
        aria-live="polite"
        className={`min-h-4 text-xs font-bold ${
          feedback && feedback !== "Saved" ? "text-red-600" : "crm-muted"
        }`}
      >
        {isPending ? "Saving..." : feedback}
      </span>
    </div>
  );
}
