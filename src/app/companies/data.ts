import { supabase } from "@/lib/supabase";
import type { TagOption } from "@/app/contacts/data";

export type CompanyTagRecord = {
  company_id?: string | null;
  tag_id?: string | null;
  tags?: TagOption | TagOption[] | null;
};

export async function getCompanyTagRows(companyId: string) {
  const { data, error } = await supabase
    .from("company_tags")
    .select(`
      company_id,
      tag_id,
      tags (
        id,
        name,
        color
      )
    `)
    .eq("company_id", companyId);

  if (error) {
    return [];
  }

  return (data ?? []) as CompanyTagRecord[];
}

export async function getCompanyTagIds(companyId: string) {
  const tagRows = await getCompanyTagRows(companyId);

  return tagRows
    .map((tagRow) => tagRow.tag_id)
    .filter((tagId): tagId is string => Boolean(tagId));
}

export function getTagsFromCompanyRows(tagRows: CompanyTagRecord[]) {
  return tagRows
    .map((tagRow) => {
      if (Array.isArray(tagRow.tags)) {
        return tagRow.tags[0] ?? null;
      }

      return tagRow.tags ?? null;
    })
    .filter((tag): tag is TagOption => Boolean(tag));
}
