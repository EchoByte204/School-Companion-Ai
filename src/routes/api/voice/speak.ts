import { createFileRoute } from "@tanstack/react-router";
import { getActor, UnauthorizedError } from "@/chitti-ai/server/auth.server";

function parseGeminiKeys(): string[] {
  const rawKeys = process.env["GEMINI_API_KEYS"] || process.env["GEMINI_API_KEY"] || "";
  const list = rawKeys
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  for (let i = 1; i <= 10; i++) {
    const key = process.env[`GEMINI_API_KEY_${i}`];
    if (key?.trim()) list.push(key.trim());
  }

  return Array.from(new Set(list));
}

let geminiTtsKeyIndex = 0;

function pcmToWav(pcmBuffer: Buffer, sampleRate = 24000, numChannels = 1, bitDepth = 16): Buffer {
  const headerLength = 44;
  const dataLength = pcmBuffer.length;
  const wavBuffer = Buffer.alloc(headerLength + dataLength);

  wavBuffer.write("RIFF", 0);
  wavBuffer.writeUInt32LE(36 + dataLength, 4);
  wavBuffer.write("WAVE", 8);
  wavBuffer.write("fmt ", 12);
  wavBuffer.writeUInt32LE(16, 16);
  wavBuffer.writeUInt16LE(1, 20);
  wavBuffer.writeUInt16LE(numChannels, 22);
  wavBuffer.writeUInt32LE(sampleRate, 24);
  wavBuffer.writeUInt32LE(sampleRate * numChannels * (bitDepth / 8), 28);
  wavBuffer.writeUInt16LE(numChannels * (bitDepth / 8), 32);
  wavBuffer.writeUInt16LE(bitDepth, 34);
  wavBuffer.write("data", 36);
  wavBuffer.writeUInt32LE(dataLength, 40);

  pcmBuffer.copy(wavBuffer, 44);
  return wavBuffer;
}

export const Route = createFileRoute("/api/voice/speak")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const geminiKeys = parseGeminiKeys();
        const cloudKey = process.env["LOVABLE_API_KEY"] || process.env["OPENAI_API_KEY"];

        try {
          await getActor(request);
        } catch (error) {
          if (error instanceof UnauthorizedError)
            return new Response(error.message, { status: 401 });
          throw error;
        }

        const body = (await request.json()) as { text?: unknown; language?: unknown };
        const text = typeof body.text === "string" ? body.text.trim().slice(0, 1500) : "";
        const language =
          typeof body.language === "string" ? body.language.trim().toLowerCase() : "en";

        if (!text) return new Response("No text to speak", { status: 400 });

        const languagePrompts: Record<string, string> = {
          hi: "Speak fluently in natural Hindi.",
          ta: "Speak fluently in natural Tamil.",
          te: "Speak fluently in natural Telugu.",
          mr: "Speak fluently in natural Marathi.",
          bn: "Speak fluently in natural Bengali.",
          gu: "Speak fluently in natural Gujarati.",
          pa: "Speak fluently in natural Punjabi.",
          kn: "Speak fluently in natural Kannada.",
          ml: "Speak fluently in natural Malayalam.",
          ur: "Speak fluently in natural Urdu.",
          en: "Speak fluently in clear Indian English.",
        };

        const languageInstruction = languagePrompts[language] ?? "Speak clearly.";
        const fullPrompt = `${languageInstruction}\n${text}`;

        // Priority 1: Google Gemini 3.1 Flash TTS with Multi-Key Rotation
        if (geminiKeys.length > 0) {
          let attempts = 0;
          const maxAttempts = geminiKeys.length;

          while (attempts < maxAttempts) {
            const activeKey = geminiKeys[geminiTtsKeyIndex % geminiKeys.length];
            const ttsModel = process.env["GEMINI_TTS_MODEL"] || "gemini-3.1-flash-tts-preview";

            try {
              const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${ttsModel}:generateContent?key=${activeKey}`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    contents: [{ parts: [{ text: fullPrompt }] }],
                    generationConfig: {
                      responseModalities: ["AUDIO"],
                      speechConfig: {
                        voiceConfig: {
                          prebuiltVoiceConfig: {
                            voiceName: process.env["GEMINI_TTS_VOICE"] || "Puck",
                          },
                        },
                      },
                    },
                  }),
                },
              );

              if (!res.ok) {
                geminiTtsKeyIndex = (geminiTtsKeyIndex + 1) % geminiKeys.length;
                attempts++;
                continue;
              }

              const data = (await res.json()) as {
                candidates?: Array<{
                  content?: { parts?: Array<{ inlineData?: { data?: string } }> };
                }>;
              };
              const candidate = data.candidates?.[0];
              const audioPart = candidate?.content?.parts?.find((p) => p.inlineData);

              if (audioPart?.inlineData?.data) {
                const rawPcm = Buffer.from(audioPart.inlineData.data, "base64");
                const wav = pcmToWav(rawPcm, 24000, 1, 16);
                geminiTtsKeyIndex = (geminiTtsKeyIndex + 1) % geminiKeys.length;
                return new Response(wav, {
                  headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" },
                });
              }

              geminiTtsKeyIndex = (geminiTtsKeyIndex + 1) % geminiKeys.length;
              attempts++;
            } catch {
              geminiTtsKeyIndex = (geminiTtsKeyIndex + 1) % geminiKeys.length;
              attempts++;
            }
          }
        }

        // Priority 2: OpenAI / Lovable TTS fallback
        if (cloudKey) {
          const endpoint = process.env["LOVABLE_API_KEY"]
            ? "https://ai.gateway.lovable.dev/v1/audio/speech"
            : "https://api.openai.com/v1/audio/speech";

          const model = process.env["LOVABLE_API_KEY"] ? "openai/gpt-4o-mini-tts" : "tts-1";

          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${cloudKey}`,
            },
            body: JSON.stringify({
              model,
              voice: "alloy",
              input: text,
              response_format: "mp3",
            }),
          });

          if (response.ok) {
            return new Response(response.body, {
              headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
            });
          }
        }

        // Fallback to browser SpeechSynthesis
        return new Response(JSON.stringify({ fallback: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
