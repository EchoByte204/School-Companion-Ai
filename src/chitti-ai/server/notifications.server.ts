import type { Actor } from "./auth.server";

export type NotificationItem = {
  id: string;
  kind: string;
  title: string;
  body: string;
  requestReference: string | null;
  read: boolean;
  createdAt: string;
};

export async function listNotifications(actor: Actor, limit = 25): Promise<NotificationItem[]> {
  const { data, error } = await actor.supabase
    .from("notifications")
    .select("id, kind, title, body, request_reference, read, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    requestReference: row.request_reference,
    read: row.read,
    createdAt: row.created_at,
  }));
}

export async function markNotificationsRead(actor: Actor, ids?: string[]) {
  let query = actor.supabase.from("notifications").update({ read: true }).eq("read", false);
  if (ids && ids.length > 0) query = query.in("id", ids);
  const { error } = await query;
  if (error) throw new Error(error.message);
  return { ok: true as const };
}
