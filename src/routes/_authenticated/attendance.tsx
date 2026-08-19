import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { getRoster, markAttendanceEntry } from "@/lib/school.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Status = "present" | "absent" | "late";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({
    meta: [
      { title: "Attendance register · CHITTI AI" },
      {
        name: "description",
        content:
          "Teachers mark and correct daily attendance with a roll-number identity check and instant confirmation.",
      },
      { property: "og:title", content: "Attendance register · CHITTI AI" },
      {
        property: "og:description",
        content: "Verified daily attendance marking for CHITTI Public School teachers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8 text-sm">Register not found.</div>,
  component: AttendanceRegister,
});

const STATUS_LABEL: Record<Status, string> = {
  present: "Present",
  late: "Late",
  absent: "Absent",
};

function AttendanceRegister() {
  const queryClient = useQueryClient();
  const fetchRoster = useServerFn(getRoster);
  const saveEntry = useServerFn(markAttendanceEntry);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [classId, setClassId] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState<{
    studentId: string;
    fullName: string;
    rollNo: string;
    status: Status;
  } | null>(null);
  const [rollInput, setRollInput] = useState("");
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState<{
    name: string;
    rollNo: string;
    status: string;
    date: string;
    note: string | null;
    confirmedAt: string;
  } | null>(null);

  const { data, isPending, error } = useQuery({
    queryKey: ["roster", date, classId ?? "all"],
    queryFn: () => fetchRoster({ data: { date, ...(classId ? { classId } : {}) } }),
  });

  const mutate = useMutation({
    mutationFn: (input: {
      studentId: string;
      rollNo: string;
      status: Status;
      date: string;
      note?: string;
    }) => saveEntry({ data: input }),
    onSuccess: async (result) => {
      setReceipt({
        name: result.student.fullName,
        rollNo: result.student.rollNo,
        status: result.status,
        date: result.date,
        note: result.note,
        confirmedAt: result.confirmedAt,
      });
      toast.success(
        `Identity verified — ${result.student.fullName} (${result.student.rollNo}) marked ${result.status} for ${result.date}.`,
      );
      setPending(null);
      setRollInput("");
      setNote("");
      await queryClient.invalidateQueries({ queryKey: ["roster"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["attendance-report"] });
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  if (isPending) return <div className="p-8 text-sm text-muted-foreground">Loading register…</div>;
  if (error || !data)
    return (
      <div className="p-8 text-sm text-destructive">{error?.message ?? "Failed to load."}</div>
    );

  const rollMatches =
    pending !== null && rollInput.trim().toLowerCase() === pending.rollNo.toLowerCase();

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/70">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <h1 className="font-display text-lg font-semibold">Attendance register</h1>
          <Button asChild size="sm" variant="outline">
            <Link to="/portal">Back to portal</Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-8">
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-5">
          <div className="grid gap-1.5">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setDate(event.target.value)}
              className="w-44"
            />
          </div>
          {data.classes.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={classId ? "outline" : "default"}
                onClick={() => setClassId(undefined)}
              >
                All classes
              </Button>
              {data.classes.map((klass) => (
                <Button
                  key={klass.id}
                  size="sm"
                  variant={classId === klass.id ? "default" : "outline"}
                  onClick={() => setClassId(klass.id)}
                >
                  {klass.label}
                </Button>
              ))}
            </div>
          ) : null}
        </div>

        {receipt ? (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-border bg-surface p-4">
            <CheckCircle2 className="mt-0.5 size-5 text-accent" />
            <div className="text-sm">
              <p className="font-medium">
                Saved: {receipt.name} ({receipt.rollNo}) — {receipt.status} on {receipt.date}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Confirmed by the school records service at{" "}
                {new Date(receipt.confirmedAt).toLocaleTimeString()}
                {receipt.note ? ` · Note: ${receipt.note}` : ""}
              </p>
            </div>
          </div>
        ) : null}

        <ul className="mt-4 space-y-2">
          {data.students.map((student) => (
            <li
              key={student.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{student.fullName}</p>
                <p className="text-xs text-muted-foreground">
                  {student.rollNo}
                  {student.className ? ` · ${student.className}` : ""}
                </p>
              </div>
              {student.status ? (
                <Badge variant={student.status === "absent" ? "secondary" : "default"}>
                  {STATUS_LABEL[student.status]}
                </Badge>
              ) : (
                <Badge variant="outline">Not marked</Badge>
              )}
              <div className="flex gap-2">
                {(["present", "late", "absent"] as Status[]).map((status) => (
                  <Button
                    key={status}
                    size="sm"
                    variant={student.status === status ? "default" : "outline"}
                    onClick={() => {
                      setPending({
                        studentId: student.id,
                        fullName: student.fullName,
                        rollNo: student.rollNo,
                        status,
                      });
                      setRollInput("");
                      setNote("");
                    }}
                  >
                    {STATUS_LABEL[status]}
                  </Button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <Dialog open={pending !== null} onOpenChange={(open) => (open ? null : setPending(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-accent" /> Verify student identity
            </DialogTitle>
            <DialogDescription>
              Type the roll number of <strong>{pending?.fullName}</strong> to confirm marking them{" "}
              {pending ? STATUS_LABEL[pending.status].toLowerCase() : ""} on {date}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="roll">Roll number</Label>
              <Input
                id="roll"
                autoFocus
                value={rollInput}
                placeholder="e.g. 9C-01"
                onChange={(event) => setRollInput(event.target.value)}
              />
              {rollInput && !rollMatches ? (
                <p className="text-xs text-destructive">
                  This roll number does not match the selected student.
                </p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="note">Note (optional)</Label>
              <Input
                id="note"
                value={note}
                placeholder="Reason, e.g. medical leave"
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button
              disabled={!rollMatches || mutate.isPending}
              onClick={() => {
                if (!pending) return;
                mutate.mutate({
                  studentId: pending.studentId,
                  rollNo: rollInput.trim(),
                  status: pending.status,
                  date,
                  ...(note.trim() ? { note: note.trim() } : {}),
                });
              }}
            >
              {mutate.isPending ? "Saving…" : "Confirm and save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
