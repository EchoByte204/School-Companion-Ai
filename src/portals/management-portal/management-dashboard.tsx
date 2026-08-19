import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { RequestList, Stat } from "@/portals/shared/dashboard-parts";
import type { DashboardData } from "@/portals/shared/dashboard-types";
import { AttendanceAnalytics } from "./attendance-analytics";

export function ManagementDashboard({ data }: { data: DashboardData }) {
  const analytics = data.analytics;

  return (
    <>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat
          label="Overall attendance"
          value={analytics ? `${analytics.overallPercentage}%` : "—"}
          hint="Last 30 days"
        />
        <Stat label="Students" value={analytics ? String(analytics.studentCount) : "—"} />
        <Stat
          label="Pending requests"
          value={analytics ? String(analytics.pendingRequests) : "—"}
        />
      </div>

      {analytics ? (
        <div className="mt-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display text-base font-semibold">Attendance by class</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {analytics.perClass.map((klass) => (
              <li key={klass.className} className="flex items-center gap-3">
                <span className="w-16 font-medium">{klass.className}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
                  <span
                    className="block h-full rounded-full bg-accent"
                    style={{ width: `${klass.percentage}%` }}
                  />
                </span>
                <span className="w-14 text-right tabular-nums text-muted-foreground">
                  {klass.percentage}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <AttendanceAnalytics />

      <div className="mt-6 flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          <Link to="/requests">Open request inbox</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/attendance">Attendance register</Link>
        </Button>
      </div>

      <RequestList
        requests={data.requests}
        title="Escalations to management"
        emptyText="No escalations right now."
      />
    </>
  );
}
