import { createFileRoute, redirect } from "@tanstack/react-router";
import { createThread, listThreads } from "@/lib/school.functions";

export const Route = createFileRoute("/_authenticated/chat/")({
  loader: async () => {
    const threads = await listThreads();
    const thread = threads[0] ?? (await createThread({ data: {} }));
    throw redirect({ to: "/chat/$threadId", params: { threadId: thread.id } });
  },
  component: () => null,
});
