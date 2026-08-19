import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { listNotifications, markNotificationsRead } from "@/lib/school.functions";

export function NotificationBell() {
  const queryClient = useQueryClient();
  const fetchNotifications = useServerFn(listNotifications);
  const markRead = useServerFn(markNotificationsRead);

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchNotifications(),
    refetchInterval: 20000,
  });

  const mutate = useMutation({
    mutationFn: () => markRead({ data: {} }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const items = data ?? [];
  const unread = items.filter((item) => !item.read).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="relative" aria-label="Notifications">
          <Bell className="size-4" />
          {unread > 0 ? (
            <span className="absolute -right-1 -top-1 grid size-4.5 min-w-4.5 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground">
              {unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={mutate.isPending}
              onClick={() => mutate.mutate()}
            >
              Mark all read
            </Button>
          ) : null}
        </div>
        <ul className="max-h-80 divide-y divide-border overflow-y-auto">
          {items.length === 0 ? (
            <li className="px-4 py-6 text-sm text-muted-foreground">
              Nothing yet. Request updates will show up here.
            </li>
          ) : (
            items.map((item) => (
              <li key={item.id} className={item.read ? "px-4 py-3" : "bg-surface px-4 py-3"}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{item.title}</p>
                  {item.read ? null : <Badge variant="secondary">new</Badge>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{item.body}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
