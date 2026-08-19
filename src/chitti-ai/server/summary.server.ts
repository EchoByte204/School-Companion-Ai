import { generateText } from "ai";
import { getAiModel } from "@/lib/ai-gateway.server";
import type { Actor } from "./auth.server";

type MessagePart = { type?: string; text?: string; toolName?: string; state?: string };

function transcriptOf(rows: Array<{ role: string; parts: unknown }>) {
  return rows
    .map((row) => {
      const parts = (row.parts ?? []) as MessagePart[];
      const text = parts
        .map((part) => {
          if (part.type === "text" && part.text) return part.text;
          if (part.type?.startsWith("tool-")) return `[used ${part.type.replace("tool-", "")}]`;
          return "";
        })
        .filter(Boolean)
        .join(" ");
      return text ? `${row.role === "user" ? "User" : "Assistant"}: ${text}` : "";
    })
    .filter(Boolean)
    .join("\n")
    .slice(0, 12000);
}

/** Generates (and caches on the thread) a short recap of what was discussed and done. */
export async function summarizeThread(actor: Actor, threadId: string, force = false) {
  const { data: thread, error: threadError } = await actor.supabase
    .from("chat_threads")
    .select("id, title, summary, summary_updated_at, updated_at")
    .eq("id", threadId)
    .eq("user_id", actor.userId)
    .maybeSingle();
  if (threadError) throw new Error(threadError.message);
  if (!thread) throw new Error("Conversation not found");

  const isFresh =
    !force &&
    thread.summary &&
    thread.summary_updated_at &&
    new Date(thread.summary_updated_at).getTime() >= new Date(thread.updated_at).getTime();
  if (isFresh) {
    return {
      summary: thread.summary as string,
      updatedAt: thread.summary_updated_at as string,
      cached: true,
    };
  }

  const { data: rows, error } = await actor.supabase
    .from("chat_messages")
    .select("role, parts")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const transcript = transcriptOf(rows ?? []);
  if (!transcript) {
    return {
      summary: "Nothing has been discussed in this conversation yet.",
      updatedAt: new Date().toISOString(),
      cached: false,
    };
  }

  const ai = getAiModel();
  if (!ai) throw new Error("AI is not configured");

  const { text } = await generateText({
    model: ai.model,
    system:
      "You write short internal recaps of school helpdesk conversations. Reply with two labelled sections and nothing else:\n" +
      "Discussed: one or two sentences.\n" +
      "Actions taken: a short dash list of concrete actions (attendance marked, request raised with reference code, status changed). Write 'None yet.' if there were none.\n" +
      "Never invent facts that are not in the transcript.",
    prompt: `Conversation title: ${thread.title}\n\n${transcript}`,
  });

  const summary = text.trim();
  const updatedAt = new Date().toISOString();
  const { error: saveError } = await actor.supabase
    .from("chat_threads")
    .update({ summary, summary_updated_at: updatedAt })
    .eq("id", threadId)
    .eq("user_id", actor.userId);
  if (saveError) console.error("Failed to save thread summary", saveError.message);

  return { summary, updatedAt, cached: false };
}
