import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listNotifications, markNotificationsRead } from "@/lib/school.functions";

/** Unread request updates surfaced inside the conversation, as a note from the assistant. */
export function ChatNotifications() {
  const queryClient = useQueryClient();
  const fetchNotifications = useServerFn(listNotifications);
  const markRead = useServerFn(markNotificationsRead);

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchNotifications(),
    refetchInterval: 20000,
  });

  const dismiss = useMutation({
    mutationFn: (ids: string[]) => markRead({ data: { ids } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unread = (data ?? []).filter((item) => !item.read);
  if (unread.length === 0) return null;

  return (
    <div className="mx-4 mt-3 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <BellRing className="size-4 text-accent" />
        <p className="text-sm font-medium">
          A quick update for you{unread.length > 1 ? ` (${unread.length})` : ""}
        </p>
      </div>
      <ul className="mt-2 space-y-1.5 text-sm text-foreground/85">
        {unread.slice(0, 4).map((item) => (
          <li key={item.id}>
            {item.title}
            {item.body ? <span className="text-muted-foreground"> — {item.body}</span> : null}
          </li>
        ))}
      </ul>
      <Button
        size="sm"
        variant="outline"
        className="mt-3"
        disabled={dismiss.isPending}
        onClick={() => dismiss.mutate(unread.map((item) => item.id))}
      >
        Got it
      </Button>
    </div>
  );
}
