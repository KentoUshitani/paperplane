import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(
  url &&
    anonKey &&
    !url.includes("YOUR_PROJECT_REF") &&
    !anonKey.includes("YOUR_SUPABASE_ANON_KEY"),
);

/**
 * PKCE + localStorage — required for reliable Google login on mobile Safari.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        flowType: "pkce",
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
        storageKey: "paperplane-auth",
      },
    })
  : null;

/** Clean app URL for OAuth return (no hash / oauth query junk). */
export function getAuthRedirectUrl(): string {
  const { origin, pathname } = window.location;
  const path = pathname.endsWith("/") ? pathname : pathname || "/";
  return `${origin}${path === "" ? "/" : path}`;
}
