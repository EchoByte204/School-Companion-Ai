/**
 * Attendance trend analytics for staff and school management.
 * Reads go through the caller's RLS-scoped client, so a teacher only ever
 * gets trends for students in their own class.
 */
import type { Actor } from "./auth.server";
import { ForbiddenError, daysAgo, today } from "./school-api.server";

export type TrendPoint = { date: string; percentage: number; records: number };

export type AttendanceReport = {
  from: string;
  to: string;
  overallPercentage: number;
  studentCount: number;
  classCount: number;
  daily: TrendPoint[];
  classTrends: Array<{ className: string; points: TrendPoint[]; percentage: number }>;
  students: Array<{
    id: string;
    fullName: string;
    rollNo: string;
    className: string;
    percentage: number;
    present: number;
    late: number;
    absent: number;
  }>;
};

function pct(present: number, total: number) {
  return total === 0 ? 0 : Math.round((present / total) * 1000) / 10;
}

export async function getAttendanceReport(
  actor: Actor,
  options: { days?: number | undefined } = {},
): Promise<AttendanceReport> {
  if (actor.role !== "teacher" && actor.role !== "principal") {
    throw new ForbiddenError(
      "Attendance analytics are available to teachers and school management.",
    );
  }

  const days = Math.min(Math.max(options.days ?? 30, 7), 90);
  const from = daysAgo(days);
  const to = today();

  const [{ data: classes }, { data: students }, { data: attendance }] = await Promise.all([
    actor.supabase.from("classes").select("id, name, section"),
    actor.supabase.from("students").select("id, full_name, roll_no, class_id").order("roll_no"),
    actor.supabase
      .from("attendance")
      .select("student_id, attendance_date, status")
      .gte("attendance_date", from)
      .lte("attendance_date", to)
      .order("attendance_date"),
  ]);

  const classLabel = new Map(
    (classes ?? []).map((klass) => [klass.id, `${klass.name}-${klass.section}`] as const),
  );
  const studentRows = students ?? [];
  const studentIndex = new Map(studentRows.map((row) => [row.id, row] as const));

  const dayBuckets = new Map<string, { present: number; total: number }>();
  const classDayBuckets = new Map<string, Map<string, { present: number; total: number }>>();
  const studentBuckets = new Map<string, { present: number; late: number; absent: number }>();
  let present = 0;
  let total = 0;

  for (const row of attendance ?? []) {
    const student = studentIndex.get(row.student_id);
    if (!student) continue;
    const counted = row.status === "present" || row.status === "late" ? 1 : 0;

    const day = dayBuckets.get(row.attendance_date) ?? { present: 0, total: 0 };
    day.present += counted;
    day.total += 1;
    dayBuckets.set(row.attendance_date, day);

    const label = classLabel.get(student.class_id ?? "") ?? "Unassigned";
    const perClass = classDayBuckets.get(label) ?? new Map();
    const classDay = perClass.get(row.attendance_date) ?? { present: 0, total: 0 };
    classDay.present += counted;
    classDay.total += 1;
    perClass.set(row.attendance_date, classDay);
    classDayBuckets.set(label, perClass);

    const bucket = studentBuckets.get(student.id) ?? { present: 0, late: 0, absent: 0 };
    if (row.status === "present") bucket.present += 1;
    else if (row.status === "late") bucket.late += 1;
    else bucket.absent += 1;
    studentBuckets.set(student.id, bucket);

    present += counted;
    total += 1;
  }

  const daily = [...dayBuckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, bucket]) => ({
      date,
      percentage: pct(bucket.present, bucket.total),
      records: bucket.total,
    }));

  const classTrends = [...classDayBuckets.entries()]
    .map(([className, perClass]) => {
      const points = [...perClass.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, bucket]) => ({
          date,
          percentage: pct(bucket.present, bucket.total),
          records: bucket.total,
        }));
      const sum = points.reduce((acc, point) => acc + point.percentage * point.records, 0);
      const records = points.reduce((acc, point) => acc + point.records, 0);
      return {
        className,
        points,
        percentage: records === 0 ? 0 : Math.round((sum / records) * 10) / 10,
      };
    })
    .sort((a, b) => a.className.localeCompare(b.className));

  const studentsReport = studentRows
    .map((row) => {
      const bucket = studentBuckets.get(row.id) ?? { present: 0, late: 0, absent: 0 };
      const studentTotal = bucket.present + bucket.late + bucket.absent;
      return {
        id: row.id,
        fullName: row.full_name,
        rollNo: row.roll_no,
        className: classLabel.get(row.class_id ?? "") ?? "Unassigned",
        percentage: pct(bucket.present + bucket.late, studentTotal),
        present: bucket.present,
        late: bucket.late,
        absent: bucket.absent,
      };
    })
    .sort((a, b) => a.percentage - b.percentage);

  return {
    from,
    to,
    overallPercentage: pct(present, total),
    studentCount: studentRows.length,
    classCount: (classes ?? []).length,
    daily,
    classTrends,
    students: studentsReport,
  };
}
