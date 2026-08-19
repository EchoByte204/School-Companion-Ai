import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { LANGUAGES } from "../languages";
import { PERSONAS, type AppRole } from "../personas";
import { useVoice } from "../use-voice";
import { AiAvatar } from "./ai-avatar";
import { Mic, Square, Volume2, VolumeX } from "lucide-react";
import { SyncedMessageResponse } from "./synced-message-response";

// Synced typewriter speech response integration
const TOOL_LABELS: Record<string, string> = {
  get_attendance_summary: "Checking attendance records",
  list_absences: "Looking up absence dates",
  list_students: "Opening student records",
  get_my_class: "Opening class records",
  mark_attendance: "Updating the attendance register",
  get_school_analytics: "Compiling school analytics",
  raise_request: "Raising a request with a human",
  list_requests: "Fetching request status",
};

function textOf(message: UIMessage): string {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

type AssistantChatProps = {
  role: AppRole;
  fullName: string;
  threadId: string;
  initialMessages: UIMessage[];
  language: string;
  onLanguageChange: (language: string) => void;
  onFirstMessage?: (text: string) => void;
};

export function AssistantChat({
  role,
  fullName,
  threadId,
  initialMessages,
  language,
  onLanguageChange,
  onFirstMessage,
}: AssistantChatProps) {
  const persona = PERSONAS[role];
  const [input, setInput] = useState("");
  const [autoSpeak, setAutoSpeak] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const spokenRef = useRef<string | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { threadId, language },
        fetch: async (input, init) => {
          const { data } = await supabase.auth.getSession();
          const headers = new Headers(init?.headers);
          if (data.session?.access_token) {
            headers.set("Authorization", `Bearer ${data.session.access_token}`);
          }
          return fetch(input, { ...init, headers });
        },
      }),
    [threadId, language],
  );

  const { messages, sendMessage, status, stop, error } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onError: (chatError) => {
      toast.error(chatError.message || "The assistant is unavailable right now.");
    },
  });

  const isBusy = status === "submitted" || status === "streaming";

  const focusInput = useCallback(() => {
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  useEffect(() => {
    focusInput();
  }, [focusInput, threadId]);

  useEffect(() => {
    if (status === "ready") focusInput();
  }, [status, focusInput]);

  const submit = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isBusy) return;
      if (messages.length === 0) onFirstMessage?.(trimmed);
      void sendMessage({ text: trimmed });
      setInput("");
      focusInput();
    },
    [focusInput, isBusy, messages.length, onFirstMessage, sendMessage],
  );

  const voice = useVoice({ language, onTranscript: submit });

  useEffect(() => {
    if (voice.error) toast.error(voice.error);
  }, [voice.error]);

  const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");
  const lastAssistantText = lastAssistant ? textOf(lastAssistant) : "";

  useEffect(() => {
    if (!autoSpeak || status !== "ready" || !lastAssistantText) return;
    if (spokenRef.current === lastAssistantText) return;
    spokenRef.current = lastAssistantText;
    void voice.speak(lastAssistantText);
    // voice.speak is stable per render cycle; re-running on it would loop audio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSpeak, status, lastAssistantText]);

  const avatarState =
    voice.state === "speaking"
      ? "speaking"
      : voice.state === "recording"
        ? "listening"
        : isBusy
          ? "thinking"
          : "idle";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-border/70 bg-card/60 px-4 py-3 backdrop-blur">
        <AiAvatar
          role={role}
          level={voice.level}
          state={avatarState}
          className="size-12 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-semibold">{persona.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {persona.title} ·{" "}
            {avatarState === "speaking"
              ? "speaking"
              : avatarState === "listening"
                ? "listening"
                : avatarState === "thinking"
                  ? "thinking"
                  : "online"}
          </p>
        </div>
        <Select value={language} onValueChange={onLanguageChange}>
          <SelectTrigger className="h-9 w-[9.5rem]" aria-label="Assistant language">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((option) => (
              <SelectItem key={option.code} value={option.code}>
                {option.nativeLabel}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={autoSpeak ? "default" : "outline"}
          size="sm"
          onClick={() => {
            if (autoSpeak) voice.stopSpeaking();
            setAutoSpeak((previous) => !previous);
          }}
          aria-pressed={autoSpeak}
        >
          {autoSpeak ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          <span className="ml-1.5 hidden sm:inline">Voice reply</span>
        </Button>
      </header>

      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl gap-1">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center gap-5 py-10 text-center">
              <AiAvatar role={role} level={voice.level} state={avatarState} className="size-28" />
              <div>
                <h2 className="font-display text-xl font-semibold">
                  Namaste {fullName.split(" ")[0]}
                </h2>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                  {persona.greeting}
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {persona.suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => submit(suggestion)}
                    className="rounded-full border border-border bg-card px-3.5 py-1.5 text-sm text-foreground/80 transition-colors hover:border-accent hover:text-foreground"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((message, msgIndex) => {
            const isLatestAssistant =
              msgIndex === messages.length - 1 && message.role === "assistant";
            return (
              <Message from={message.role} key={message.id}>
                <MessageContent
                  className={cn(
                    message.role === "user" &&
                      "group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground",
                  )}
                >
                  {message.parts.map((part, index) => {
                    if (part.type === "text") {
                      return message.role === "assistant" ? (
                        <div key={index} className="relative group/msg pr-7">
                          <SyncedMessageResponse
                            text={part.text}
                            isSpeaking={voice.state === "speaking"}
                            isLatest={isLatestAssistant}
                          />
                          <Button
                            variant="secondary"
                            size="icon"
                            className="absolute -right-2 top-0 z-20 size-7 rounded-full shadow-sm border border-border bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground transition-all active:scale-95"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              void voice.speak(part.text);
                            }}
                            title="Listen to response out loud"
                            aria-label="Listen to response out loud"
                          >
                            <Volume2 className="size-3.5 text-primary" />
                          </Button>
                        </div>
                      ) : (
                        <p key={index} className="whitespace-pre-wrap">
                          {part.text}
                        </p>
                      );
                    }

                    if (part.type.startsWith("tool-") && "state" in part) {
                      const toolPart = part as {
                        type: `tool-${string}`;
                        state:
                          | "input-streaming"
                          | "input-available"
                          | "output-available"
                          | "output-error";
                        input?: unknown;
                        output?: unknown;
                        errorText?: string;
                      };
                      const toolName = toolPart.type.replace("tool-", "");
                      return (
                        <Tool defaultOpen={false} key={index}>
                          <ToolHeader
                            type={toolPart.type}
                            state={toolPart.state}
                            title={TOOL_LABELS[toolName] ?? toolName.replace(/_/g, " ")}
                          />
                          <ToolContent>
                            <ToolInput input={toolPart.input} />
                            <ToolOutput
                              output={
                                toolPart.output ? (
                                  <pre className="overflow-x-auto text-xs">
                                    {JSON.stringify(toolPart.output, null, 2)}
                                  </pre>
                                ) : undefined
                              }
                              errorText={toolPart.errorText}
                            />
                          </ToolContent>
                        </Tool>
                      );
                    }

                    return null;
                  })}
                </MessageContent>
              </Message>
            );
          })}

          {status === "submitted" ? (
            <div className="px-2 py-3">
              <Shimmer>Thinking…</Shimmer>
            </div>
          ) : null}

          {error ? (
            <p className="px-2 py-3 text-sm text-destructive">
              {error.message || "Something went wrong. Please try again."}
            </p>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-border/70 bg-card/60 px-4 py-3 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl">
          <PromptInput
            onSubmit={(_message, event) => {
              event.preventDefault();
              submit(input);
            }}
          >
            <PromptInputTextarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={
                voice.state === "recording"
                  ? "Listening… tap the mic to send"
                  : `Ask ${persona.name} anything…`
              }
              disabled={voice.state === "recording" || voice.state === "transcribing"}
            />
            <PromptInputFooter>
              <PromptInputTools>
                <Button
                  type="button"
                  variant={voice.state === "recording" ? "destructive" : "outline"}
                  size="sm"
                  onClick={() => {
                    if (voice.state === "recording") void voice.stopRecording();
                    else void voice.startRecording();
                  }}
                  disabled={voice.state === "transcribing" || isBusy}
                >
                  {voice.state === "recording" ? (
                    <Square className="size-4" />
                  ) : (
                    <Mic className="size-4" />
                  )}
                  <span className="ml-1.5">
                    {voice.state === "recording"
                      ? "Stop & send"
                      : voice.state === "transcribing"
                        ? "Transcribing…"
                        : "Speak"}
                  </span>
                </Button>
                {voice.state === "recording" ? (
                  <Badge variant="secondary" className="tabular-nums">
                    {"▁▂▃▄▅▆▇".charAt(Math.min(6, Math.round(voice.level * 12)))} recording
                  </Badge>
                ) : null}
              </PromptInputTools>
              <PromptInputSubmit
                status={status}
                disabled={!input.trim() && !isBusy}
                onStop={stop}
              />
            </PromptInputFooter>
          </PromptInput>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {persona.name} only sees what your account is allowed to see. Ask for a teacher any
            time.
          </p>
        </div>
      </div>
    </div>
  );
}
