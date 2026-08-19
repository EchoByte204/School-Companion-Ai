import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { NotebookPen, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { summarizeThread } from "@/lib/school.functions";

export function ThreadSummary({
  threadId,
  cachedSummary,
}: {
  threadId: string;
  cachedSummary: string | null;
}) {
  const queryClient = useQueryClient();
  const summarize = useServerFn(summarizeThread);
  const [summary, setSummary] = useState<string | null>(cachedSummary);
  const [open, setOpen] = useState(Boolean(cachedSummary));

  const mutate = useMutation({
    mutationFn: (force: boolean) => summarize({ data: { threadId, force } }),
    onSuccess: async (result) => {
      setSummary(result.summary);
      setOpen(true);
      await queryClient.invalidateQueries({ queryKey: ["threads"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="border-b border-border bg-card/60 px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={mutate.isPending}
          onClick={() => {
            if (summary && open) {
              setOpen(false);
              return;
            }
            if (summary && !open) {
              setOpen(true);
              return;
            }
            mutate.mutate(false);
          }}
        >
          <NotebookPen className="size-4" />
          {mutate.isPending
            ? "Summarising…"
            : summary && open
              ? "Hide summary"
              : "Conversation summary"}
        </Button>
        {summary ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={mutate.isPending}
            onClick={() => mutate.mutate(true)}
            aria-label="Refresh summary"
          >
            <RefreshCw className="size-4" /> Refresh
          </Button>
        ) : null}
      </div>
      {open && summary ? (
        <p className="mt-2 whitespace-pre-line rounded-xl bg-surface p-3 text-sm text-foreground/85">
          {summary}
        </p>
      ) : null}
    </div>
  );
}
