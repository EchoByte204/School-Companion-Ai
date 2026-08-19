import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { UIMessage } from "ai";
import { toast } from "sonner";
import {
  createThread,
  deleteThread,
  getMe,
  getThread,
  listThreads,
  renameThread,
  setPreferredLanguage,
} from "@/lib/school.functions";
import { Button } from "@/components/ui/button";
import { AssistantChat } from "@/chitti-ai/components/assistant-chat";
import { ThreadSummary } from "@/chitti-ai/components/thread-summary";
import { ChatNotifications } from "@/chitti-ai/components/chat-notifications";
import { ROLE_LABELS, type AppRole } from "@/chitti-ai/personas";
import logo from "@/assets/chitti-ai-logo.png";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  head: () => ({
    meta: [
      { title: "Assistant · CHITTI AI School Assistant" },
      {
        name: "description",
        content: "Chat or speak with CHITTI AI, your school assistant, in your preferred language.",
      },
      { property: "og:title", content: "Assistant · CHITTI AI School Assistant" },
      {
        property: "og:description",
        content: "Ask about attendance, raise a request, or talk to a teacher.",
      },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8 text-sm">Conversation not found.</div>,
  component: ChatPage,
});

function ChatPage() {
  const { threadId } = useParams({ from: "/_authenticated/chat/$threadId" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const fetchMe = useServerFn(getMe);
  const fetchThreads = useServerFn(listThreads);
  const fetchThread = useServerFn(getThread);
  const createThreadFn = useServerFn(createThread);
  const renameThreadFn = useServerFn(renameThread);
  const deleteThreadFn = useServerFn(deleteThread);
  const setLanguageFn = useServerFn(setPreferredLanguage);

  const me = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });
  const threads = useQuery({ queryKey: ["threads"], queryFn: () => fetchThreads() });
  const thread = useQuery({
    queryKey: ["thread", threadId],
    queryFn: () => fetchThread({ data: { threadId } }),
  });

  const newThread = useMutation({
    mutationFn: () => createThreadFn({ data: { language: me.data?.language ?? "en" } }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["threads"] });
      void navigate({ to: "/chat/$threadId", params: { threadId: created.id } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeThread = useMutation({
    mutationFn: (id: string) => deleteThreadFn({ data: { threadId: id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["threads"] });
      void navigate({ to: "/chat" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const changeLanguage = useMutation({
    mutationFn: (language: string) => setLanguageFn({ data: { language } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  });

  if (me.isPending || thread.isPending) {
    return <div className="p-8 text-sm text-muted-foreground">Opening your assistant…</div>;
  }
  if (me.error || thread.error || !me.data || !thread.data) {
    return (
      <div className="p-8 text-sm text-destructive">
        {me.error?.message ?? thread.error?.message ?? "Could not open this conversation."}
      </div>
    );
  }

  const role = me.data.role as AppRole;
  const language = thread.data.thread.language || me.data.language;

  return (
    <div className="flex h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card/60 md:flex">
        <Link to="/portal" className="flex items-center gap-2.5 border-b border-border px-4 py-4">
          <img
            src={logo}
            alt="CHITTI AI"
            width={32}
            height={32}
            className="size-8"
            loading="lazy"
          />
          <div className="leading-tight">
            <p className="font-display text-sm font-semibold">CHITTI AI</p>
            <p className="text-xs text-muted-foreground">{ROLE_LABELS[role]} view</p>
          </div>
        </Link>
        <div className="p-3">
          <Button className="w-full" size="sm" onClick={() => newThread.mutate()}>
            <Plus className="size-4" /> New conversation
          </Button>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {(threads.data ?? []).map((item) => (
            <div
              key={item.id}
              className={`group flex items-center gap-1 rounded-lg px-2 ${
                item.id === threadId ? "bg-surface" : "hover:bg-surface/70"
              }`}
            >
              <Link
                to="/chat/$threadId"
                params={{ threadId: item.id }}
                className="min-w-0 flex-1 truncate py-2 text-sm"
              >
                {item.title}
              </Link>
              <button
                type="button"
                aria-label={`Delete ${item.title}`}
                className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                onClick={() => removeThread.mutate(item.id)}
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </nav>
        <div className="border-t border-border p-3">
          <Button asChild size="sm" variant="outline" className="w-full">
            <Link to="/portal">Back to portal</Link>
          </Button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="flex h-screen min-w-0 flex-col">
          <ThreadSummary
            threadId={threadId}
            cachedSummary={(thread.data.thread as { summary?: string | null }).summary ?? null}
          />
          <ChatNotifications />
          <div className="min-h-0 flex-1">
            <AssistantChat
              key={threadId}
              role={role}
              fullName={me.data.fullName}
              threadId={threadId}
              initialMessages={thread.data.messages as unknown as UIMessage[]}
              language={language}
              onLanguageChange={(next) => changeLanguage.mutate(next)}
              onFirstMessage={(text) => {
                void renameThreadFn({ data: { threadId, title: text.slice(0, 60) } }).then(() =>
                  queryClient.invalidateQueries({ queryKey: ["threads"] }),
                );
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
