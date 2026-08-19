import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import WebSocket from "ws";

if (typeof window === "undefined" && typeof globalThis.WebSocket === "undefined") {
  globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;
}
import type { AppRole } from "../personas";
import { isLanguageCode, type LanguageCode } from "../languages";

export type Actor = {
  userId: string;
  email: string;
  fullName: string;
  role: AppRole;
  language: LanguageCode;
  supabase: SupabaseClient<Database>;
};

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

function createUserClient(token: string): SupabaseClient<Database> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Backend is not configured");

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set("apikey", key);
        headers.set("Authorization", `Bearer ${token}`);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

/**
 * Resolves the caller's identity and role from the request bearer token.
 * The role ALWAYS comes from the database, never from anything the user sent
 * in a message or request body — this is the application-layer authorization
 * boundary the assistant's tools rely on.
 */
export async function getActor(request: Request): Promise<Actor> {
  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) throw new UnauthorizedError("Missing session token");

  const supabase = createUserClient(token);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) throw new UnauthorizedError("Invalid session");

  const userId = userData.user.id;

  const [{ data: roleRows }, { data: profile }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase
      .from("profiles")
      .select("full_name, email, preferred_language")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  const roles = (roleRows ?? []).map((row) => row.role as AppRole);
  const role: AppRole =
    roles.find((candidate) => candidate === "principal") ??
    roles.find((candidate) => candidate === "teacher") ??
    roles.find((candidate) => candidate === "parent") ??
    roles.find((candidate) => candidate === "student") ??
    "student";

  const language = profile?.preferred_language ?? "en";

  return {
    userId,
    email: profile?.email ?? userData.user.email ?? "",
    fullName: profile?.full_name || (userData.user.email ?? "there").split("@")[0]!,
    role,
    language: isLanguageCode(language) ? language : "en",
    supabase,
  };
}

/** Same identity resolution, for `createServerFn` handlers using requireSupabaseAuth. */
export async function getActorFromContext(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Actor> {
  const [{ data: roleRows }, { data: profile }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase
      .from("profiles")
      .select("full_name, email, preferred_language")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  const roles = (roleRows ?? []).map((row) => row.role as AppRole);
  const role: AppRole =
    roles.find((candidate) => candidate === "principal") ??
    roles.find((candidate) => candidate === "teacher") ??
    roles.find((candidate) => candidate === "parent") ??
    roles.find((candidate) => candidate === "student") ??
    "student";
  const language = profile?.preferred_language ?? "en";

  return {
    userId,
    email: profile?.email ?? "",
    fullName: profile?.full_name || "there",
    role,
    language: isLanguageCode(language) ? language : "en",
    supabase,
  };
}
