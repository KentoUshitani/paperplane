import type { User } from "@supabase/supabase-js";
import {
  getAuthRedirectUrl,
  isSupabaseConfigured,
  supabase,
} from "./supabase";

/** One leaderboard row = one play record (same name may appear many times). */
export type ScoreRow = {
  id?: number;
  user_id: string;
  display_name: string;
  depth: number;
  stage: number;
  created_at?: string;
};

export function getDisplayName(user: User): string {
  const meta = user.user_metadata ?? {};
  const fromMeta =
    (typeof meta.display_name === "string" && meta.display_name) ||
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    "";
  if (fromMeta.trim()) return fromMeta.trim().slice(0, 24);
  const email = user.email ?? "";
  const local = email.split("@")[0] ?? "";
  return (local || "PILOT").slice(0, 24);
}

function mapLegacyScore(row: {
  user_id: string;
  display_name: string;
  best_depth: number;
  best_stage: number;
  updated_at: string;
}): ScoreRow {
  return {
    user_id: row.user_id,
    display_name: row.display_name,
    depth: row.best_depth,
    stage: row.best_stage,
    created_at: row.updated_at,
  };
}

/** Finish PKCE redirect on mobile (code in query string). */
export async function completeAuthRedirect(): Promise<boolean> {
  if (!supabase) return false;

  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const errorDesc =
    url.searchParams.get("error_description") || url.searchParams.get("error");

  if (errorDesc) {
    cleanAuthParamsFromUrl();
    throw new Error(decodeURIComponent(errorDesc.replace(/\+/g, " ")));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    cleanAuthParamsFromUrl();
    if (error) throw error;
    return true;
  }

  if (url.hash.includes("access_token")) {
    const { error } = await supabase.auth.getSession();
    cleanAuthParamsFromUrl();
    if (error) throw error;
    return true;
  }

  return false;
}

function cleanAuthParamsFromUrl(): void {
  window.history.replaceState({}, document.title, getAuthRedirectUrl());
}

/** Top N by depth (record), not unique by name. */
export async function fetchLeaderboard(limit = 10): Promise<ScoreRow[]> {
  if (!supabase) return [];

  const primary = await supabase
    .from("score_records")
    .select("id, user_id, display_name, depth, stage, created_at")
    .order("depth", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);

  if (!primary.error) {
    return (primary.data ?? []) as ScoreRow[];
  }

  const legacy = await supabase
    .from("scores")
    .select("user_id, display_name, best_depth, best_stage, updated_at")
    .order("best_depth", { ascending: false })
    .order("updated_at", { ascending: true })
    .limit(limit);

  if (legacy.error) throw primary.error;
  return (legacy.data ?? []).map(mapLegacyScore);
}

/** Insert this run (RPC first, then direct insert fallback). */
export async function submitScoreRecord(
  depth: number,
  stage: number,
  displayName: string,
): Promise<ScoreRow | null> {
  if (!supabase) return null;

  const d = Math.max(0, Math.floor(depth));
  const s = Math.max(1, Math.min(10, Math.floor(stage)));
  if (d < 1 || d > 730) return null;

  const name = (displayName.trim() || "PILOT").slice(0, 24);

  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const user = sessionData.session?.user;
  if (!user) throw new Error("Not authenticated");

  const rpc = await supabase.rpc("submit_score_record", {
    p_depth: d,
    p_stage: s,
    p_display_name: name,
  });

  if (!rpc.error) {
    const row = rpc.data as ScoreRow | ScoreRow[] | null;
    if (Array.isArray(row)) return row[0] ?? null;
    return row;
  }

  const inserted = await supabase
    .from("score_records")
    .insert({
      user_id: user.id,
      display_name: name,
      depth: d,
      stage: s,
    })
    .select("id, user_id, display_name, depth, stage, created_at")
    .single();

  if (!inserted.error) return inserted.data as ScoreRow;

  const legacy = await supabase.rpc("submit_best_score", {
    p_depth: d,
    p_stage: s,
    p_display_name: name,
  });
  if (legacy.error) {
    throw rpc.error;
  }
  const legacyRow = legacy.data as {
    user_id: string;
    display_name: string;
    best_depth: number;
    best_stage: number;
    updated_at: string;
  } | null;
  return legacyRow ? mapLegacyScore(legacyRow) : null;
}

export async function signInWithEmail(email: string, password: string) {
  if (!supabase) throw new Error("Supabase is not configured");
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string,
) {
  if (!supabase) throw new Error("Supabase is not configured");
  const redirectTo = getAuthRedirectUrl();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName.slice(0, 24) },
      emailRedirectTo: redirectTo,
    },
  });
  if (error) throw error;
  return data;
}

/**
 * Google OAuth — explicit full-page redirect (works on mobile Safari/Chrome).
 */
export async function signInWithGoogle() {
  if (!supabase) throw new Error("Supabase is not configured");
  const redirectTo = getAuthRedirectUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: {
        prompt: "select_account",
      },
    },
  });
  if (error) throw error;
  if (!data.url) throw new Error("Google 認証 URL を取得できませんでした");
  window.location.assign(data.url);
  return data;
}

export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSessionUser(): Promise<User | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.user ?? null;
}

export { getAuthRedirectUrl, isSupabaseConfigured, supabase };
