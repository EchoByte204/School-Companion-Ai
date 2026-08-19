import { Badge } from "@/components/ui/badge";
import type { AttendanceSummaryItem, RequestItem } from "./dashboard-types";

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string | undefined;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl font-semibold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function AttendanceCards({
  title,
  summaries,
}: {
  title: string;
  summaries: AttendanceSummaryItem[];
}) {
  if (summaries.length === 0) return null;
  return (
    <section className="mt-6">
      <h2 className="font-display text-base font-semibold">{title}</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {summaries.map((summary) => (
          <article key={summary.student.id} className="rounded-xl border border-border bg-card p-4">
            <p className="font-medium">{summary.student.fullName}</p>
            <p className="text-xs text-muted-foreground">
              {summary.student.rollNo}
              {summary.student.className ? ` · ${summary.student.className}` : ""}
            </p>
            <p className="mt-3 font-display text-2xl font-semibold">{summary.percentage}%</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface">
              <span
                className="block h-full rounded-full bg-accent"
                style={{ width: `${summary.percentage}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {summary.present} present · {summary.late} late · {summary.absent} absent
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function statusVariant(status: string) {
  if (status === "resolved") return "outline" as const;
  if (status === "rejected") return "destructive" as const;
  if (status === "acknowledged") return "default" as const;
  return "secondary" as const;
}

export function RequestList({
  requests,
  emptyText,
  title = "Requests",
}: {
  requests: RequestItem[];
  emptyText: string;
  title?: string;
}) {
  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-base font-semibold">{title}</h2>
      {requests.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="mt-3 divide-y divide-border text-sm">
          {requests.map((request) => (
            <li key={request.reference_code} className="flex flex-wrap items-center gap-2 py-2.5">
              <span className="font-medium">{request.subject}</span>
              <Badge variant={statusVariant(request.status)}>{request.status}</Badge>
              <span className="text-xs text-muted-foreground">
                {request.reference_code} · to {request.target}
                {request.studentName ? ` · ${request.studentName}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
