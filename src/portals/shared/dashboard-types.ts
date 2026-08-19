import type { getDashboard } from "@/lib/school.functions";

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;
export type AttendanceSummaryItem = DashboardData["summaries"][number];
export type RequestItem = DashboardData["requests"][number];
