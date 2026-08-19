import { tool } from "ai";
import { z } from "zod";
import type { Actor } from "./auth.server";
import {
  createSupportRequest,
  getAttendanceSummary,
  getMyClass,
  getSchoolAnalytics,
  listAbsences,
  listSupportRequests,
  listVisibleStudents,
  markAttendance,
  updateSupportRequestStatus,
} from "./school-api.server";

const dateSchema = z
  .string()
  .describe("Date as YYYY-MM-DD")
  .nullable()
  .transform((value) => value ?? undefined);

async function guard<T>(run: () => Promise<T>) {
  try {
    return { ok: true as const, data: await run() };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Request failed" };
  }
}

/**
 * Tools are assembled per request from the caller's DB-verified role.
 * A student's model literally never receives the attendance-marking tool.
 */
export function buildTools(actor: Actor) {
  const shared = {
    get_attendance_summary: tool({
      description:
        "Attendance percentage and present/absent/late counts for a student over a date range.",
      inputSchema: z.object({
        student: z
          .string()
          .describe("Student name or roll number. Omit for the caller's own/only student.")
          .nullable()
          .transform((value) => value ?? undefined),
        from: dateSchema,
        to: dateSchema,
      }),
      execute: (input) => guard(() => getAttendanceSummary(actor, input)),
    }),
    list_absences: tool({
      description: "List the specific dates a student was absent or late.",
      inputSchema: z.object({
        student: z
          .string()
          .nullable()
          .transform((value) => value ?? undefined),
        from: dateSchema,
        to: dateSchema,
      }),
      execute: (input) => guard(() => listAbsences(actor, input)),
    }),
    list_students: tool({
      description:
        "List the students the caller is allowed to see (own record, children, or class).",
      inputSchema: z.object({}),
      execute: () => guard(() => listVisibleStudents(actor)),
    }),
    list_notifications: tool({
      description:
        "The caller's recent in-app notifications, including request status changes (submitted, acknowledged, resolved, rejected). Use this when the user asks what is new or for an update on their request.",
      inputSchema: z.object({}),
      execute: () =>
        guard(async () => {
          const { listNotifications } = await import("./notifications.server");
          return listNotifications(actor, 10);
        }),
    }),
    raise_request: tool({
      description:
        "Escalate to a human: create a support request for the class teacher or school management. Confirm the subject and message with the user first.",
      inputSchema: z.object({
        target: z.enum(["teacher", "management"]),
        subject: z.string().describe("Short summary, max 80 characters"),
        message: z.string().describe("What the human should know, in the user's own words"),
        student: z
          .string()
          .nullable()
          .transform((value) => value ?? undefined),
        contactPhone: z
          .string()
          .nullable()
          .transform((value) => value ?? undefined),
      }),
      execute: (input) => guard(() => createSupportRequest(actor, input)),
    }),
  };

  if (actor.role === "teacher") {
    return {
      ...shared,
      get_my_class: tool({
        description: "The caller's class(es) and teaching subject.",
        inputSchema: z.object({}),
        execute: () => guard(() => getMyClass(actor)),
      }),
      mark_attendance: tool({
        description:
          "Mark or correct a student's attendance for a date. Always confirm student, date and status with the teacher before calling.",
        inputSchema: z.object({
          student: z.string().describe("Student name or roll number"),
          status: z.enum(["present", "absent", "late"]),
          date: dateSchema,
          note: z
            .string()
            .nullable()
            .transform((value) => value ?? undefined),
        }),
        execute: (input) => guard(() => markAttendance(actor, input)),
      }),
      list_requests: tool({
        description: "Support requests addressed to the caller.",
        inputSchema: z.object({}),
        execute: () => guard(() => listSupportRequests(actor)),
      }),
      update_request_status: tool({
        description:
          "Update a support request's status by its reference code. Confirm with the teacher first.",
        inputSchema: z.object({
          reference: z.string().describe("Reference code, e.g. REQ-1042"),
          status: z.enum(["pending", "acknowledged", "resolved", "rejected"]),
        }),
        execute: (input) => guard(() => updateSupportRequestStatus(actor, input)),
      }),
    };
  }

  if (actor.role === "principal") {
    return {
      ...shared,
      get_my_class: tool({
        description: "All classes in the school with their assigned teacher.",
        inputSchema: z.object({}),
        execute: () => guard(() => getMyClass(actor)),
      }),
      get_school_analytics: tool({
        description:
          "School-wide attendance analytics: overall percentage, per-class ranking and pending request count.",
        inputSchema: z.object({ from: dateSchema, to: dateSchema }),
        execute: (input) => guard(() => getSchoolAnalytics(actor, input)),
      }),
      list_requests: tool({
        description: "Recent support requests raised by parents, students and teachers.",
        inputSchema: z.object({}),
        execute: () => guard(() => listSupportRequests(actor)),
      }),
      update_request_status: tool({
        description: "Update a support request's status by its reference code.",
        inputSchema: z.object({
          reference: z.string(),
          status: z.enum(["pending", "acknowledged", "resolved", "rejected"]),
        }),
        execute: (input) => guard(() => updateSupportRequestStatus(actor, input)),
      }),
      mark_attendance: tool({
        description: "Mark or correct a student's attendance for a date.",
        inputSchema: z.object({
          student: z.string(),
          status: z.enum(["present", "absent", "late"]),
          date: dateSchema,
          note: z
            .string()
            .nullable()
            .transform((value) => value ?? undefined),
        }),
        execute: (input) => guard(() => markAttendance(actor, input)),
      }),
    };
  }

  return {
    ...shared,
    list_requests: tool({
      description: "Support requests the caller has raised, with status.",
      inputSchema: z.object({}),
      execute: () => guard(() => listSupportRequests(actor)),
    }),
  };
}
