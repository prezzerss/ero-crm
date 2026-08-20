"use client";

import { useState } from "react";

type CopyTextButtonProps = {
  label?: string;
  text: string;
};

export function CopyTextButton({ label = "Copy", text }: CopyTextButtonProps) {
  const [copied, setCopied] = useState(false);

  async function copyText() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button className="crm-button" onClick={copyText} type="button">
      {copied ? "Copied" : label}
    </button>
  );
}
