import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseKey, getSupabaseUrl } from "./supabase-auth";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabaseKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot write cookies; Route Handlers and Server Actions can.
        }
      },
    },
  });
}
