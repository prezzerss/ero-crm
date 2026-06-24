const statusLabels: Record<string, string> = {
  active: "Active",
  archived: "Archived",
  do_not_contact: "Do not contact",
  follow_up: "Follow up",
  ignored: "Ignored",
  linked: "Linked",
  new: "New",
  paused: "Paused",
  reviewing: "Reviewing",
  subscribed: "Subscribed",
  unknown: "Unknown",
  unsubscribed: "Unsubscribed",
};

export function formatStatus(value?: string | null, fallback = "Active") {
  if (!value) {
    return fallback;
  }

  const normalisedValue = value.trim().toLowerCase();

  return (
    statusLabels[normalisedValue] ??
    normalisedValue
      .replace(/_/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase())
  );
}
