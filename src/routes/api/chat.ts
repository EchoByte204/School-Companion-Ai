import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import {
  getAiModel,
  getLovableAiGatewayResponseHeaders,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "@/lib/ai-gateway.server";
import { getActor, UnauthorizedError } from "@/chitti-ai/server/auth.server";
import { buildTools } from "@/chitti-ai/server/tools.server";
import { buildSystemPrompt } from "@/chitti-ai/server/prompt.server";

type ChatRequestBody = {
  messages?: unknown;
  threadId?: unknown;
  language?: unknown;
};

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ai = getAiModel(request);
        if (!ai) {
          return new Response(
            "AI is not configured. Please set LOVABLE_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY, or OLLAMA_BASE_URL in your .env file.",
            { status: 500 },
          );
        }

        let actor;
        try {
          actor = await getActor(request);
        } catch (error) {
          if (error instanceof UnauthorizedError) {
            return new Response(error.message, { status: 401 });
          }
          throw error;
        }

        const body = (await request.json()) as ChatRequestBody;
        const messages = body.messages;
        const threadId = typeof body.threadId === "string" ? body.threadId : null;
        const language = typeof body.language === "string" ? body.language : actor.language;

        if (!Array.isArray(messages) || messages.length === 0) {
          return new Response("Messages are required", { status: 400 });
        }
        if (!threadId) return new Response("threadId is required", { status: 400 });

        const { data: thread } = await actor.supabase
          .from("chat_threads")
          .select("id, user_id")
          .eq("id", threadId)
          .maybeSingle();
        if (!thread || thread.user_id !== actor.userId) {
          return new Response("Thread not found", { status: 404 });
        }

        const uiMessages = messages as UIMessage[];
        const lastMessage = uiMessages[uiMessages.length - 1];

        if (lastMessage?.role === "user") {
          const { error: insertError } = await actor.supabase.from("chat_messages").insert({
            thread_id: threadId,
            user_id: actor.userId,
            role: "user",
            parts: lastMessage.parts as unknown as never,
            client_message_id: lastMessage.id ?? null,
          });
          if (insertError) console.error("Failed to persist user message", insertError.message);
          await actor.supabase
            .from("chat_threads")
            .update({ updated_at: new Date().toISOString(), language })
            .eq("id", threadId);
        }

        const result = streamText({
          model: ai.model,
          system: buildSystemPrompt(actor, language),
          messages: await convertToModelMessages(uiMessages),
          tools: buildTools(actor),
          stopWhen: stepCountIs(50),
          onError: ({ error }) => {
            console.error("CHITTI AI stream error", error);
          },
        });

        const initialRunId = getLovableAiGatewayRunId(request);

        const response = result.toUIMessageStreamResponse({
          originalMessages: uiMessages,
          onFinish: async ({ responseMessage }) => {
            const { error } = await actor.supabase.from("chat_messages").insert({
              thread_id: threadId,
              user_id: actor.userId,
              role: "assistant",
              parts: responseMessage.parts as unknown as never,
              client_message_id: responseMessage.id ?? null,
            });
            if (error) console.error("Failed to persist assistant message", error.message);
          },
          headers: getLovableAiGatewayResponseHeaders(undefined, {
            ...(initialRunId ? { "X-Lovable-AIG-Run-ID": initialRunId } : {}),
          }),
        });

        if (ai.type === "lovable" && ai.gateway) {
          return withLovableAiGatewayRunIdHeader(response, ai.gateway);
        }

        return response;
      },
    },
  },
});
