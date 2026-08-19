import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { AttendanceCards, RequestList, Stat } from "@/portals/shared/dashboard-parts";
import type { DashboardData } from "@/portals/shared/dashboard-types";

export function StaffDashboard({ data }: { data: DashboardData }) {
  const classes = data.classes?.classes ?? [];
  const pending = data.requests.filter((request) => request.status === "pending").length;

  return (
    <>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="My students" value={String(data.summaries.length)} />
        <Stat
          label="My classes"
          value={String(classes.length)}
          hint={classes.map((klass) => `${klass.name}-${klass.section}`).join(", ") || undefined}
        />
        <Stat label="Pending requests" value={String(pending)} />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button asChild size="sm">
          <Link to="/attendance">Mark attendance</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/requests">Open request inbox</Link>
        </Button>
      </div>

      <AttendanceCards title="My students" summaries={data.summaries} />
      <RequestList
        requests={data.requests}
        title="Requests to me"
        emptyText="No requests waiting for you right now."
      />
    </>
  );
}
