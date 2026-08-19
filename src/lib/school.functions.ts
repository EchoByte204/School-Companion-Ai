import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const threadIdSchema = z.object({ threadId: z.string().uuid() });

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getActorFromContext } = await import("@/chitti-ai/server/auth.server");
    const actor = await getActorFromContext(context.supabase, context.userId);
    return {
      userId: actor.userId,
      email: actor.email,
      fullName: actor.fullName,
      role: actor.role,
      language: actor.language,
    };
  });

export const setPreferredLanguage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ language: z.string().min(2).max(5) }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ preferred_language: data.language })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("chat_threads")
      .select("id, title, language, updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ title: z.string().max(120).optional(), language: z.string().max(5).optional() })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: thread, error } = await context.supabase
      .from("chat_threads")
      .insert({
        user_id: context.userId,
        title: data.title ?? "New conversation",
        language: data.language ?? "en",
      })
      .select("id, title, language, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return thread;
  });

export const renameThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    threadIdSchema.extend({ title: z.string().min(1).max(120) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("chat_threads")
      .update({ title: data.title })
      .eq("id", data.threadId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => threadIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("chat_threads")
      .delete()
      .eq("id", data.threadId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getThread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => threadIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: thread, error: threadError } = await context.supabase
      .from("chat_threads")
      .select("id, title, language, updated_at, summary")
      .eq("id", data.threadId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (threadError) throw new Error(threadError.message);
    if (!thread) throw new Error("Conversation not found");

    const { data: rows, error } = await context.supabase
      .from("chat_messages")
      .select("id, role, parts, created_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const messages = (rows ?? []).map((row) => ({
      id: row.id,
      role: row.role,
      parts: (row.parts ?? []) as Array<Record<string, string>>,
    }));

    return { thread, messages };
  });

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getActorFromContext } = await import("@/chitti-ai/server/auth.server");
    const api = await import("@/chitti-ai/server/school-api.server");
    const actor = await getActorFromContext(context.supabase, context.userId);

    const students = await api.listVisibleStudents(actor);
    const summaries = await Promise.all(
      students.slice(0, 12).map(async (student) => {
        try {
          return await api.getAttendanceSummary(actor, { student: student.id });
        } catch {
          return null;
        }
      }),
    );

    const requests = await api.listSupportRequests(actor);

    let analytics: Awaited<ReturnType<typeof api.getSchoolAnalytics>> | null = null;
    if (actor.role === "principal") {
      analytics = await api.getSchoolAnalytics(actor);
    }

    let classes: Awaited<ReturnType<typeof api.getMyClass>> | null = null;
    if (actor.role === "teacher" || actor.role === "principal") {
      classes = await api.getMyClass(actor);
    }

    return {
      role: actor.role,
      fullName: actor.fullName,
      summaries: summaries.filter((summary) => summary !== null),
      requests,
      analytics,
      classes,
    };
  });

export const listRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getActorFromContext } = await import("@/chitti-ai/server/auth.server");
    const api = await import("@/chitti-ai/server/school-api.server");
    const actor = await getActorFromContext(context.supabase, context.userId);
    return { role: actor.role, requests: await api.listSupportRequests(actor) };
  });

export const updateRequestStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        reference: z.string().min(3).max(40),
        status: z.enum(["pending", "acknowledged", "resolved", "rejected"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { getActorFromContext } = await import("@/chitti-ai/server/auth.server");
    const api = await import("@/chitti-ai/server/school-api.server");
    const actor = await getActorFromContext(context.supabase, context.userId);
    return api.updateSupportRequestStatus(actor, data);
  });

export const getRoster = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        classId: z.string().uuid().optional(),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { getActorFromContext } = await import("@/chitti-ai/server/auth.server");
    const api = await import("@/chitti-ai/server/school-api.server");
    const actor = await getActorFromContext(context.supabase, context.userId);
    return api.getClassRoster(actor, data);
  });

export const markAttendanceEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        studentId: z.string().uuid(),
        rollNo: z.string().min(1).max(40),
        status: z.enum(["present", "absent", "late"]),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        note: z.string().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { getActorFromContext } = await import("@/chitti-ai/server/auth.server");
    const api = await import("@/chitti-ai/server/school-api.server");
    const actor = await getActorFromContext(context.supabase, context.userId);
    return api.markAttendanceVerified(actor, data);
  });

export const getAttendanceReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ days: z.number().int().min(7).max(90).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { getActorFromContext } = await import("@/chitti-ai/server/auth.server");
    const analytics = await import("@/chitti-ai/server/analytics.server");
    const actor = await getActorFromContext(context.supabase, context.userId);
    return analytics.getAttendanceReport(actor, data);
  });

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getActorFromContext } = await import("@/chitti-ai/server/auth.server");
    const notifications = await import("@/chitti-ai/server/notifications.server");
    const actor = await getActorFromContext(context.supabase, context.userId);
    return notifications.listNotifications(actor);
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { getActorFromContext } = await import("@/chitti-ai/server/auth.server");
    const notifications = await import("@/chitti-ai/server/notifications.server");
    const actor = await getActorFromContext(context.supabase, context.userId);
    return notifications.markNotificationsRead(actor, data.ids);
  });

export const summarizeThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    threadIdSchema.extend({ force: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { getActorFromContext } = await import("@/chitti-ai/server/auth.server");
    const summary = await import("@/chitti-ai/server/summary.server");
    const actor = await getActorFromContext(context.supabase, context.userId);
    return summary.summarizeThread(actor, data.threadId, data.force ?? false);
  });
