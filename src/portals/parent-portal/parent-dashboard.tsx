import { AttendanceCards, RequestList, Stat } from "@/portals/shared/dashboard-parts";
import type { DashboardData } from "@/portals/shared/dashboard-types";

export function ParentDashboard({ data }: { data: DashboardData }) {
  const average =
    data.summaries.length === 0
      ? 0
      : Math.round(
          (data.summaries.reduce((total, summary) => total + summary.percentage, 0) /
            data.summaries.length) *
            10,
        ) / 10;

  return (
    <>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Children" value={String(data.summaries.length)} />
        <Stat label="Average attendance" value={`${average}%`} hint="Last 30 days" />
        <Stat
          label="Open requests"
          value={String(data.requests.filter((request) => request.status !== "resolved").length)}
        />
      </div>
      <AttendanceCards title="My children" summaries={data.summaries} />
      <RequestList
        requests={data.requests}
        title="My requests"
        emptyText="No requests yet. Ask the assistant to arrange a call with the class teacher or school management."
      />
    </>
  );
}
