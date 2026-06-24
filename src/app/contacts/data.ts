import { supabase } from "@/lib/supabase";

export type CompanyOption = {
  id: string;
  name: string;
};

export type TagOption = {
  id: string;
  name: string;
  color?: string | null;
};

export type ContactTagRecord = {
  contact_id?: string | null;
  tag_id?: string | null;
  tags?: TagOption | TagOption[] | null;
};

export async function getCompanyOptions() {
  const { data, error } = await supabase
    .from("companies")
    .select("id, name")
    .order("name");

  if (error) {
    return [];
  }

  return (data ?? []) as CompanyOption[];
}

export async function getTagOptions() {
  const { data, error } = await supabase
    .from("tags")
    .select("id, name, color")
    .order("name");

  if (error) {
    return [];
  }

  return (data ?? []) as TagOption[];
}

export async function getContactTagRows(contactId: string) {
  const { data, error } = await supabase
    .from("contact_tags")
    .select(`
      contact_id,
      tag_id,
      tags (
        id,
        name,
        color
      )
    `)
    .eq("contact_id", contactId);

  if (error) {
    return [];
  }

  return (data ?? []) as ContactTagRecord[];
}

export async function getContactTagIds(contactId: string) {
  const tagRows = await getContactTagRows(contactId);

  return tagRows
    .map((tagRow) => tagRow.tag_id)
    .filter((tagId): tagId is string => Boolean(tagId));
}

export function getTagsFromRows(tagRows: ContactTagRecord[]) {
  return tagRows
    .map((tagRow) => {
      if (Array.isArray(tagRow.tags)) {
        return tagRow.tags[0] ?? null;
      }

      return tagRow.tags ?? null;
    })
    .filter((tag): tag is TagOption => Boolean(tag));
}
