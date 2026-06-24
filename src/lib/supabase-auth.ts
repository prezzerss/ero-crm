export const allowedEmailDomain = "@easy-read-online.co.uk";

export function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL!;
}

export function getSupabaseKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export function isAllowedEasyReadEmail(email?: string | null) {
  return Boolean(email?.toLowerCase().endsWith(allowedEmailDomain));
}
