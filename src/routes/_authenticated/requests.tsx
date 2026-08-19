import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listRequests, updateRequestStatus } from "@/lib/school.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { statusVariant } from "@/portals/shared/dashboard-parts";

const STATUSES = ["pending", "acknowledged", "resolved", "rejected"] as const;

const STATUS_LABEL: Record<(typeof STATUSES)[number], string> = {
  pending: "submitted",
  acknowledged: "reviewed",
  resolved: "approved",
  rejected: "rejected",
};

export const Route = createFileRoute("/_authenticated/requests")({
  head: () => ({
    meta: [
      { title: "Request inbox · CHITTI AI School Assistant" },
      {
        name: "description",
        content:
          "Teachers and school management handle escalated parent and student requests raised through CHITTI AI.",
      },
      { property: "og:title", content: "Request inbox · CHITTI AI School Assistant" },
      {
        property: "og:description",
        content: "Acknowledge and resolve requests escalated by the AI assistant.",
      },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8 text-sm">Inbox not found.</div>,
  component: RequestInbox,
});

function RequestInbox() {
  const queryClient = useQueryClient();
  const fetchRequests = useServerFn(listRequests);
  const setStatus = useServerFn(updateRequestStatus);

  const { data, isPending, error } = useQuery({
    queryKey: ["requests"],
    queryFn: () => fetchRequests(),
  });

  const mutate = useMutation({
    mutationFn: (input: { reference: string; status: (typeof STATUSES)[number] }) =>
      setStatus({ data: input }),
    onSuccess: async (updated) => {
      toast.success(
        `${updated.reference_code} marked ${STATUS_LABEL[updated.status as (typeof STATUSES)[number]]} — the requester has been notified.`,
      );
      await queryClient.invalidateQueries({ queryKey: ["requests"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  if (isPending) return <div className="p-8 text-sm text-muted-foreground">Loading requests…</div>;
  if (error || !data)
    return (
      <div className="p-8 text-sm text-destructive">{error?.message ?? "Failed to load."}</div>
    );

  const isStaff = data.role === "teacher" || data.role === "principal";

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/70">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-4">
          <h1 className="font-display text-lg font-semibold">Request inbox</h1>
          <Button asChild size="sm" variant="outline">
            <Link to="/portal">Back to portal</Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-8">
        {data.requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing here yet. Requests raised through the assistant land in this inbox.
          </p>
        ) : (
          <ul className="space-y-3">
            {data.requests.map((request) => (
              <li
                key={request.reference_code}
                className="rounded-2xl border border-border bg-card p-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display font-semibold">{request.subject}</span>
                  <Badge variant={statusVariant(request.status)}>
                    {STATUS_LABEL[request.status]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {request.reference_code} · from {request.requester_role} · to {request.target}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm text-foreground/85">
                  {request.message}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {request.studentName
                    ? `Student: ${request.studentName} (${request.studentRollNo ?? "—"})`
                    : "No student attached"}
                  {request.contact_phone ? ` · Phone: ${request.contact_phone}` : ""}
                  {` · ${new Date(request.created_at).toLocaleString()}`}
                </p>
                {isStaff ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {STATUSES.filter((status) => status !== request.status).map((status) => (
                      <Button
                        key={status}
                        size="sm"
                        variant={status === "resolved" ? "default" : "outline"}
                        disabled={mutate.isPending}
                        onClick={() => mutate.mutate({ reference: request.reference_code, status })}
                      >
                        Mark {STATUS_LABEL[status]}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
