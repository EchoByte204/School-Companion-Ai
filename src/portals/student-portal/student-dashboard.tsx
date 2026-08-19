import { AttendanceCards, RequestList, Stat } from "@/portals/shared/dashboard-parts";
import type { DashboardData } from "@/portals/shared/dashboard-types";

export function StudentDashboard({ data }: { data: DashboardData }) {
  const mine = data.summaries[0];
  return (
    <>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat
          label="My attendance"
          value={mine ? `${mine.percentage}%` : "—"}
          hint="Last 30 days"
        />
        <Stat label="Days absent" value={mine ? String(mine.absent) : "—"} hint="Last 30 days" />
        <Stat
          label="Open requests"
          value={String(data.requests.filter((request) => request.status !== "resolved").length)}
        />
      </div>
      <AttendanceCards title="My attendance record" summaries={data.summaries} />
      <RequestList
        requests={data.requests}
        title="My requests"
        emptyText="No requests yet. Ask the assistant to connect you with your teacher and it will appear here."
      />
    </>
  );
}
