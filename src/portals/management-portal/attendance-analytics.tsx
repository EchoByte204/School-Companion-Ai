import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileDown } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
} from "recharts";
import { getAttendanceReport } from "@/lib/school.functions";
import { Button } from "@/components/ui/button";
import { exportAttendanceReportPdf } from "./attendance-report-pdf";

const RANGES = [
  { days: 14, label: "14 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
] as const;

const LINE_COLORS = [
  "var(--color-accent)",
  "var(--color-primary)",
  "var(--color-chart-3, #7c9cff)",
  "var(--color-chart-4, #f0a14a)",
];

export function AttendanceAnalytics() {
  const fetchReport = useServerFn(getAttendanceReport);
  const [days, setDays] = useState<number>(30);

  const { data, isPending, error } = useQuery({
    queryKey: ["attendance-report", days],
    queryFn: () => fetchReport({ data: { days } }),
  });

  const classSeries = useMemo(() => {
    if (!data) return { rows: [] as Array<Record<string, number | string>>, keys: [] as string[] };
    const keys = data.classTrends.map((trend) => trend.className);
    const byDate = new Map<string, Record<string, number | string>>();
    for (const trend of data.classTrends) {
      for (const point of trend.points) {
        const row = byDate.get(point.date) ?? { date: point.date.slice(5) };
        row[trend.className] = point.percentage;
        byDate.set(point.date, row);
      }
    }
    return {
      rows: [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, row]) => row),
      keys,
    };
  }, [data]);

  if (isPending) {
    return (
      <div className="mt-6 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
        Building attendance trends…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="mt-6 rounded-2xl border border-border bg-card p-5 text-sm text-destructive">
        {error?.message ?? "Could not load analytics."}
      </div>
    );
  }

  const lowest = data.students.slice(0, 10).map((student) => ({
    name: `${student.fullName.split(" ")[0]} (${student.rollNo})`,
    percentage: student.percentage,
  }));

  return (
    <section className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold">Attendance trends</h2>
        <div className="flex flex-wrap items-center gap-2">
          {RANGES.map((range) => (
            <Button
              key={range.days}
              size="sm"
              variant={days === range.days ? "default" : "outline"}
              onClick={() => setDays(range.days)}
            >
              {range.label}
            </Button>
          ))}
          <Button size="sm" variant="secondary" onClick={() => exportAttendanceReportPdf(data)}>
            <FileDown className="size-4" /> Export PDF
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          School-wide daily attendance · {data.from} to {data.to}
        </p>
        <div className="mt-3 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.daily.map((point) => ({ ...point, label: point.date.slice(5) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={(value) => `${value}%`} />
              <Line
                type="monotone"
                dataKey="percentage"
                name="All classes"
                stroke="var(--color-accent)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Trend by class</p>
        <div className="mt-3 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={classSeries.rows}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={(value) => `${value}%`} />
              <Legend />
              {classSeries.keys.map((key, index) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={LINE_COLORS[index % LINE_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Students needing attention (lowest attendance)
        </p>
        <div className="mt-3 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={lowest} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => `${value}%`} />
              <Bar dataKey="percentage" name="Attendance" fill="var(--color-primary)" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
