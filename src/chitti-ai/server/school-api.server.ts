/**
 * Mock School ERP service layer.
 *
 * Every function here is the ONLY way the assistant reaches school data.
 * Each one re-checks the caller's role and scope server-side, so a user cannot
 * widen their access by asking the model nicely (prompt injection) or by
 * calling the chat endpoint directly.
 */
import type { Actor } from "./auth.server";

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export type RequestStatus = "pending" | "acknowledged" | "resolved" | "rejected";

export type StudentRecord = {
  id: string;
  fullName: string;
  rollNo: string;
  className: string | null;
};

export type AttendanceSummary = {
  student: StudentRecord;
  from: string;
  to: string;
  present: number;
  absent: number;
  late: number;
  totalDays: number;
  percentage: number;
};

const DAY = 24 * 60 * 60 * 1000;

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysAgo(days: number): string {
  return new Date(Date.now() - days * DAY).toISOString().slice(0, 10);
}

type StudentRow = {
  id: string;
  full_name: string;
  roll_no: string;
  classes: { name: string; section: string } | null;
};

function toStudent(row: StudentRow): StudentRecord {
  return {
    id: row.id,
    fullName: row.full_name,
    rollNo: row.roll_no,
    className: row.classes ? `${row.classes.name}-${row.classes.section}` : null,
  };
}

const STUDENT_SELECT = "id, full_name, roll_no, classes ( name, section )";

/** Students the caller is allowed to see. RLS enforces this a second time in the DB. */
export async function listVisibleStudents(actor: Actor): Promise<StudentRecord[]> {
  const { data, error } = await actor.supabase
    .from("students")
    .select(STUDENT_SELECT)
    .order("roll_no");
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as StudentRow[]).map(toStudent);
}

export async function resolveStudent(actor: Actor, query?: string): Promise<StudentRecord> {
  const students = await listVisibleStudents(actor);
  if (students.length === 0) {
    throw new ForbiddenError("You do not have access to any student records.");
  }

  if (!query || !query.trim()) {
    if (students.length === 1) return students[0]!;
    throw new ForbiddenError(
      `Please say which student you mean. You have access to: ${students
        .map((student) => `${student.fullName} (${student.rollNo})`)
        .join(", ")}.`,
    );
  }

  const needle = query.trim().toLowerCase();
  const matches = students.filter(
    (student) =>
      student.fullName.toLowerCase().includes(needle) ||
      student.rollNo.toLowerCase() === needle ||
      student.id === query,
  );

  if (matches.length === 1) return matches[0]!;
  if (matches.length > 1) {
    throw new ForbiddenError(
      `Several students match "${query}": ${matches.map((student) => `${student.fullName} (${student.rollNo})`).join(", ")}. Ask which one.`,
    );
  }
  throw new ForbiddenError(
    `No student named "${query}" is within your access. You can see: ${students
      .map((student) => student.fullName)
      .join(", ")}.`,
  );
}

export async function getAttendanceSummary(
  actor: Actor,
  options: {
    student?: string | undefined;
    from?: string | undefined;
    to?: string | undefined;
  } = {},
): Promise<AttendanceSummary> {
  const student = await resolveStudent(actor, options.student);
  const from = options.from ?? daysAgo(30);
  const to = options.to ?? today();

  const { data, error } = await actor.supabase
    .from("attendance")
    .select("status, attendance_date")
    .eq("student_id", student.id)
    .gte("attendance_date", from)
    .lte("attendance_date", to);
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const present = rows.filter((row) => row.status === "present").length;
  const late = rows.filter((row) => row.status === "late").length;
  const absent = rows.filter((row) => row.status === "absent").length;
  const totalDays = rows.length;
  const percentage = totalDays === 0 ? 0 : Math.round(((present + late) / totalDays) * 1000) / 10;

  return { student, from, to, present, absent, late, totalDays, percentage };
}

export async function listAbsences(
  actor: Actor,
  options: {
    student?: string | undefined;
    from?: string | undefined;
    to?: string | undefined;
  } = {},
) {
  const student = await resolveStudent(actor, options.student);
  const from = options.from ?? daysAgo(30);
  const to = options.to ?? today();

  const { data, error } = await actor.supabase
    .from("attendance")
    .select("attendance_date, status, note")
    .eq("student_id", student.id)
    .in("status", ["absent", "late"])
    .gte("attendance_date", from)
    .lte("attendance_date", to)
    .order("attendance_date", { ascending: false });
  if (error) throw new Error(error.message);

  return {
    student,
    from,
    to,
    days: (data ?? []).map((row) => ({
      date: row.attendance_date,
      status: row.status,
      note: row.note,
    })),
  };
}

export async function getMyClass(actor: Actor) {
  if (actor.role !== "teacher" && actor.role !== "principal") {
    throw new ForbiddenError("Only teachers and school management can view class rosters.");
  }

  const { data: teacher } = await actor.supabase
    .from("teachers")
    .select("id, full_name, subject")
    .eq("user_id", actor.userId)
    .maybeSingle();

  const classQuery = actor.supabase.from("classes").select("id, name, section, teacher_id");
  const { data: classes, error } = teacher
    ? await (actor.role === "principal" ? classQuery : classQuery.eq("teacher_id", teacher.id))
    : await classQuery;
  if (error) throw new Error(error.message);

  return { teacher, classes: classes ?? [] };
}

export async function markAttendance(
  actor: Actor,
  input: {
    student: string;
    status: "present" | "absent" | "late";
    date?: string | undefined;
    note?: string | undefined;
  },
) {
  if (actor.role !== "teacher" && actor.role !== "principal") {
    throw new ForbiddenError("Only teachers can mark attendance.");
  }

  const student = await resolveStudent(actor, input.student);
  const attendanceDate = input.date ?? today();

  const { error } = await actor.supabase.from("attendance").upsert(
    {
      student_id: student.id,
      attendance_date: attendanceDate,
      status: input.status,
      note: input.note ?? null,
      marked_by: actor.userId,
    },
    { onConflict: "student_id,attendance_date" },
  );
  if (error) throw new ForbiddenError(error.message);

  return { student, date: attendanceDate, status: input.status, note: input.note ?? null };
}

export async function getSchoolAnalytics(
  actor: Actor,
  options: { from?: string | undefined; to?: string | undefined } = {},
) {
  if (actor.role !== "principal") {
    throw new ForbiddenError("School-wide analytics are available to school management only.");
  }
  const from = options.from ?? daysAgo(30);
  const to = options.to ?? today();

  const [{ data: classes }, { data: students }, { data: attendance }, { data: requests }] =
    await Promise.all([
      actor.supabase.from("classes").select("id, name, section"),
      actor.supabase.from("students").select("id, class_id"),
      actor.supabase
        .from("attendance")
        .select("student_id, status")
        .gte("attendance_date", from)
        .lte("attendance_date", to),
      actor.supabase.from("support_requests").select("status"),
    ]);

  const classOfStudent = new Map((students ?? []).map((row) => [row.id, row.class_id]));
  const buckets = new Map<string, { present: number; total: number }>();
  let present = 0;
  let total = 0;

  for (const row of attendance ?? []) {
    const classId = classOfStudent.get(row.student_id) ?? "unknown";
    const bucket = buckets.get(classId) ?? { present: 0, total: 0 };
    const counted = row.status === "present" || row.status === "late" ? 1 : 0;
    bucket.present += counted;
    bucket.total += 1;
    buckets.set(classId, bucket);
    present += counted;
    total += 1;
  }

  const perClass = (classes ?? []).map((klass) => {
    const bucket = buckets.get(klass.id) ?? { present: 0, total: 0 };
    return {
      className: `${klass.name}-${klass.section}`,
      percentage: bucket.total === 0 ? 0 : Math.round((bucket.present / bucket.total) * 1000) / 10,
      records: bucket.total,
    };
  });

  return {
    from,
    to,
    studentCount: (students ?? []).length,
    classCount: (classes ?? []).length,
    overallPercentage: total === 0 ? 0 : Math.round((present / total) * 1000) / 10,
    perClass: perClass.sort((a, b) => a.percentage - b.percentage),
    pendingRequests: (requests ?? []).filter((row) => row.status === "pending").length,
  };
}

export async function createSupportRequest(
  actor: Actor,
  input: {
    target: "teacher" | "management";
    subject: string;
    message: string;
    student?: string | undefined;
    contactPhone?: string | undefined;
  },
) {
  let studentId: string | null = null;
  let teacherId: string | null = null;

  if (actor.role === "student" || actor.role === "parent") {
    const student = await resolveStudent(actor, input.student);
    studentId = student.id;

    if (input.target === "teacher") {
      const { data } = await actor.supabase
        .from("students")
        .select("classes ( teacher_id )")
        .eq("id", student.id)
        .maybeSingle();
      const klass = (data as { classes: { teacher_id: string | null } | null } | null)?.classes;
      teacherId = klass?.teacher_id ?? null;
    }
  }

  const { data, error } = await actor.supabase
    .from("support_requests")
    .insert({
      requester_id: actor.userId,
      requester_role: actor.role,
      target: input.target,
      subject: input.subject,
      message: input.message,
      student_id: studentId,
      teacher_id: teacherId,
      contact_phone: input.contactPhone ?? null,
    })
    .select("reference_code, subject, target, status, created_at")
    .single();
  if (error) throw new ForbiddenError(error.message);

  return data;
}

export async function listSupportRequests(actor: Actor) {
  const { data, error } = await actor.supabase
    .from("support_requests")
    .select(
      "id, reference_code, subject, message, target, status, requester_role, contact_phone, created_at, students ( full_name, roll_no )",
    )
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return (
    (data ?? []) as unknown as Array<
      Record<string, unknown> & { students: { full_name: string; roll_no: string } | null }
    >
  ).map((row) => ({
    id: row["id"] as string,
    reference_code: row["reference_code"] as string,
    subject: row["subject"] as string,
    message: row["message"] as string,
    target: row["target"] as "teacher" | "management",
    status: row["status"] as RequestStatus,
    requester_role: row["requester_role"] as string,
    contact_phone: (row["contact_phone"] as string | null) ?? null,
    created_at: row["created_at"] as string,
    studentName: row.students?.full_name ?? null,
    studentRollNo: row.students?.roll_no ?? null,
  }));
}

/** Staff-only: move a request through its lifecycle. */
export async function updateSupportRequestStatus(
  actor: Actor,
  input: { reference: string; status: RequestStatus },
) {
  if (actor.role !== "teacher" && actor.role !== "principal") {
    throw new ForbiddenError("Only teachers and school management can update request status.");
  }

  const { data, error } = await actor.supabase
    .from("support_requests")
    .update({ status: input.status, updated_at: new Date().toISOString() })
    .eq("reference_code", input.reference)
    .select("reference_code, subject, status")
    .maybeSingle();
  if (error) throw new ForbiddenError(error.message);
  if (!data) throw new ForbiddenError(`No request ${input.reference} is within your access.`);
  return data;
}

/** Teacher/principal roster with each student's status for one date. */
export async function getClassRoster(
  actor: Actor,
  options: { classId?: string | undefined; date?: string | undefined } = {},
) {
  if (actor.role !== "teacher" && actor.role !== "principal") {
    throw new ForbiddenError(
      "Only teachers and school management can open the attendance register.",
    );
  }
  const date = options.date ?? today();

  let query = actor.supabase
    .from("students")
    .select("id, full_name, roll_no, class_id, classes ( name, section )")
    .order("roll_no");
  if (options.classId) query = query.eq("class_id", options.classId);

  const [{ data: rows, error }, klasses] = await Promise.all([query, getMyClass(actor)]);
  if (error) throw new Error(error.message);

  const students = ((rows ?? []) as unknown as Array<StudentRow & { class_id: string | null }>).map(
    (row) => ({ ...toStudent(row), classId: row.class_id }),
  );

  const ids = students.map((student) => student.id);
  const marks = new Map<string, { status: "present" | "absent" | "late"; note: string | null }>();
  if (ids.length > 0) {
    const { data: attendance } = await actor.supabase
      .from("attendance")
      .select("student_id, status, note")
      .eq("attendance_date", date)
      .in("student_id", ids);
    for (const row of attendance ?? []) {
      marks.set(row.student_id, { status: row.status, note: row.note });
    }
  }

  return {
    date,
    classes: klasses.classes.map((klass) => ({
      id: klass.id,
      label: `${klass.name}-${klass.section}`,
    })),
    students: students.map((student) => ({
      ...student,
      status: marks.get(student.id)?.status ?? null,
      note: marks.get(student.id)?.note ?? null,
    })),
  };
}

/**
 * Identity check before a record-changing attendance write: the student id AND
 * the roll number typed/confirmed by the teacher must both match the same
 * student inside the teacher's own scope.
 */
export async function verifyStudentIdentity(
  actor: Actor,
  input: { studentId: string; rollNo: string },
) {
  const students = await listVisibleStudents(actor);
  const student = students.find((candidate) => candidate.id === input.studentId);
  if (!student) {
    throw new ForbiddenError("That student is not within your access.");
  }
  if (student.rollNo.toLowerCase() !== input.rollNo.trim().toLowerCase()) {
    throw new ForbiddenError(
      `Identity check failed: roll number "${input.rollNo}" does not belong to ${student.fullName}.`,
    );
  }
  return student;
}

/** Verified attendance write used by the teacher register UI. */
export async function markAttendanceVerified(
  actor: Actor,
  input: {
    studentId: string;
    rollNo: string;
    status: "present" | "absent" | "late";
    date?: string | undefined;
    note?: string | undefined;
  },
) {
  if (actor.role !== "teacher" && actor.role !== "principal") {
    throw new ForbiddenError("Only teachers can mark attendance.");
  }
  const student = await verifyStudentIdentity(actor, input);
  const attendanceDate = input.date ?? today();

  const { error } = await actor.supabase.from("attendance").upsert(
    {
      student_id: student.id,
      attendance_date: attendanceDate,
      status: input.status,
      note: input.note?.trim() ? input.note.trim() : null,
      marked_by: actor.userId,
    },
    { onConflict: "student_id,attendance_date" },
  );
  if (error) throw new ForbiddenError(error.message);

  const { data: saved } = await actor.supabase
    .from("attendance")
    .select("status, note, attendance_date, updated_at")
    .eq("student_id", student.id)
    .eq("attendance_date", attendanceDate)
    .maybeSingle();

  return {
    verified: true as const,
    student,
    date: attendanceDate,
    status: saved?.status ?? input.status,
    note: saved?.note ?? null,
    confirmedAt: saved?.updated_at ?? new Date().toISOString(),
  };
}
