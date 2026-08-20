export const contactTypeOptions = [
  { value: "general", label: "General" },
  { value: "quoting", label: "Quoting" },
  { value: "invoicing", label: "Invoicing" },
] as const;

export type ContactType = (typeof contactTypeOptions)[number]["value"];

export function isContactType(value?: string | null): value is ContactType {
  return contactTypeOptions.some((option) => option.value === value);
}

export function normaliseContactType(value?: string | null): ContactType {
  return isContactType(value) ? value : "general";
}

export function formatContactType(value?: string | null) {
  return contactTypeOptions.find((option) => option.value === value)?.label ?? "General";
}
