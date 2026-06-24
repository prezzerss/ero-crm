import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseKey, getSupabaseUrl } from "./supabase-auth";

export function createBrowserSupabaseClient() {
  return createBrowserClient(getSupabaseUrl(), getSupabaseKey());
}
