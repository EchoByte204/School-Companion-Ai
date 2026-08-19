import { createFileRoute } from "@tanstack/react-router";
import { getActor, UnauthorizedError } from "@/chitti-ai/server/auth.server";

const MAX_BYTES = 8 * 1024 * 1024;

export const Route = createFileRoute("/api/voice/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const whisperBaseUrl = process.env["WHISPER_BASE_URL"] || process.env["LOCAL_WHISPER_URL"];
        const key =
          process.env["LOVABLE_API_KEY"] ||
          process.env["OPENAI_API_KEY"] ||
          process.env["WHISPER_API_KEY"] ||
          "local";

        if (!whisperBaseUrl && !process.env["LOVABLE_API_KEY"] && !process.env["OPENAI_API_KEY"]) {
          return new Response("Voice service not configured", { status: 503 });
        }

        try {
          await getActor(request);
        } catch (error) {
          if (error instanceof UnauthorizedError)
            return new Response(error.message, { status: 401 });
          throw error;
        }

        const form = await request.formData();
        const audio = form.get("audio");
        const language = form.get("language");
        if (!(audio instanceof File) || audio.size === 0) {
          return new Response("No audio received", { status: 400 });
        }
        if (audio.size > MAX_BYTES) {
          return new Response("Recording is too long", { status: 413 });
        }

        let endpoint = "https://api.openai.com/v1/audio/transcriptions";
        let modelName = process.env["WHISPER_MODEL"] || "whisper-1";

        if (whisperBaseUrl) {
          const cleanBase = whisperBaseUrl.replace(/\/$/, "");
          endpoint = cleanBase.endsWith("/audio/transcriptions")
            ? cleanBase
            : cleanBase.endsWith("/v1")
              ? `${cleanBase}/audio/transcriptions`
              : `${cleanBase}/v1/audio/transcriptions`;
        } else if (process.env["LOVABLE_API_KEY"]) {
          endpoint = "https://ai.gateway.lovable.dev/v1/audio/transcriptions";
          modelName = "openai/gpt-4o-transcribe";
        }

        const upstream = new FormData();
        upstream.append("model", modelName);
        upstream.append("file", audio, "recording.wav");
        if (typeof language === "string" && /^[a-z]{2}$/.test(language)) {
          upstream.append("language", language);
        }

        const headers: Record<string, string> = {};
        if (key && key !== "local") {
          headers["Authorization"] = `Bearer ${key}`;
        }

        const response = await fetch(endpoint, {
          method: "POST",
          headers,
          body: upstream,
        });

        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          console.error("Transcription failed", response.status, detail);
          return new Response(detail || "Transcription failed", { status: response.status });
        }

        const result = (await response.json()) as { text?: string };
        return Response.json({ text: result.text ?? "" });
      },
    },
  },
});
