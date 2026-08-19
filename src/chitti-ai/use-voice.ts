import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Downsample float PCM chunks to a 16 kHz mono 16-bit WAV file. */
function encodeWav(chunks: Float32Array[], sampleRate: number): Blob {
  const targetRate = 16000;
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  const ratio = sampleRate / targetRate;
  const outLength = Math.floor(merged.length / ratio);
  const samples = new Int16Array(outLength);
  for (let i = 0; i < outLength; i += 1) {
    const value = merged[Math.floor(i * ratio)] ?? 0;
    const clamped = Math.max(-1, Math.min(1, value));
    samples[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }

  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (position: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(position + i, text.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, targetRate, true);
  view.setUint32(28, targetRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);
  new Int16Array(buffer, 44).set(samples);

  return new Blob([buffer], { type: "audio/wav" });
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export type VoiceState = "idle" | "recording" | "transcribing" | "speaking";

export function useVoice(options: { language: string; onTranscript: (text: string) => void }) {
  const { language, onTranscript } = options;
  const [state, setState] = useState<VoiceState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const frameRef = useRef<number | null>(null);

  const cleanupRecording = useCallback(() => {
    processorRef.current?.disconnect();
    processorRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void contextRef.current?.close();
    contextRef.current = null;
  }, []);

  useEffect(
    () => () => {
      cleanupRecording();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      audioRef.current?.pause();
    },
    [cleanupRecording],
  );

  const startRecording = useCallback(async () => {
    setError(null);

    type SpeechRecognitionConstructor = new () => {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onresult: (event: { results?: Array<Array<{ transcript?: string }>> }) => void;
      onerror: () => void;
      onend: () => void;
      start: () => void;
    };

    const SpeechRecognition =
      typeof window !== "undefined"
        ? (
            window as unknown as {
              SpeechRecognition?: SpeechRecognitionConstructor;
              webkitSpeechRecognition?: SpeechRecognitionConstructor;
            }
          ).SpeechRecognition ||
          (
            window as unknown as {
              SpeechRecognition?: SpeechRecognitionConstructor;
              webkitSpeechRecognition?: SpeechRecognitionConstructor;
            }
          ).webkitSpeechRecognition
        : null;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = language || "en-US";
        recognition.onresult = (event) => {
          const text = event.results?.[0]?.[0]?.transcript;
          if (text) onTranscript(text);
          setState("idle");
        };
        recognition.onerror = () => {
          setState("idle");
        };
        recognition.onend = () => {
          setState("idle");
        };
        recognition.start();
        setState("recording");
        return;
      } catch {
        // Fall through to AudioContext mic recording
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const context = new AudioContext();
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      chunksRef.current = [];

      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        chunksRef.current.push(new Float32Array(input));
        let peak = 0;
        for (let i = 0; i < input.length; i += 32) peak = Math.max(peak, Math.abs(input[i] ?? 0));
        setLevel(peak);
      };

      source.connect(processor);
      processor.connect(context.destination);

      streamRef.current = stream;
      contextRef.current = context;
      processorRef.current = processor;
      setState("recording");
    } catch {
      setError("I couldn't reach your microphone. Please allow mic access and try again.");
      setState("idle");
    }
  }, [language, onTranscript]);

  const stopRecording = useCallback(async () => {
    const context = contextRef.current;
    const chunks = chunksRef.current;
    const sampleRate = context?.sampleRate ?? 48000;
    cleanupRecording();
    setLevel(0);

    if (chunks.length === 0) {
      setState("idle");
      return;
    }

    const blob = encodeWav(chunks, sampleRate);
    if (blob.size < 4000) {
      setState("idle");
      setError("That recording was too short — please try again.");
      return;
    }

    setState("transcribing");
    try {
      const form = new FormData();
      form.append("audio", blob, "recording.wav");
      form.append("language", language);
      const response = await fetch("/api/voice/transcribe", {
        method: "POST",
        headers: await authHeader(),
        body: form,
      });
      if (response.ok) {
        const result = (await response.json()) as { text?: string };
        const text = (result.text ?? "").trim();
        if (text) {
          onTranscript(text);
          setState("idle");
          return;
        }
      }
    } catch {
      // Fall through to error
    }

    setState("idle");
    setError(
      "Could not process audio cloud transcription. Please type your question or use a browser with speech recognition.",
    );
  }, [cleanupRecording, language, onTranscript]);

  const speakIdRef = useRef(0);

  const stopSpeaking = useCallback(() => {
    speakIdRef.current += 1;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    setLevel(0);
    setState("idle");
  }, []);

  /** Speaks text instantly in the target language with 0ms latency. */
  const speak = useCallback(
    async (text: string) => {
      stopSpeaking();
      const currentSpeakId = speakIdRef.current;
      setError(null);

      const cleanText = text.replace(/[*_#`~]/g, "").trim();
      if (!cleanText) return;

      const langMap: Record<string, string> = {
        en: "en-IN",
        hi: "hi-IN",
        ta: "ta-IN",
        te: "te-IN",
        mr: "mr-IN",
        bn: "bn-IN",
        gu: "gu-IN",
        pa: "pa-IN",
        kn: "kn-IN",
        ml: "ml-IN",
        ur: "ur-IN",
      };

      const targetLang = langMap[language] || language || "en-IN";
      const primaryLangCode = targetLang.split("-")[0] || "en";

      // Instant Local Speech Synthesis (zero latency across all 11 languages)
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(cleanText);
          utterance.lang = targetLang;
          utterance.rate = 1.0;
          utterance.pitch = 1.0;

          const voices = window.speechSynthesis.getVoices();
          if (voices.length > 0) {
            const match =
              voices.find((v) => v.lang.toLowerCase() === targetLang.toLowerCase()) ||
              voices.find((v) => v.lang.toLowerCase().startsWith(primaryLangCode)) ||
              voices.find((v) => v.lang.toLowerCase().includes(primaryLangCode)) ||
              voices.find((v) => v.lang.includes("IN"));
            if (match) utterance.voice = match;
          }

          utterance.onstart = () => {
            if (speakIdRef.current === currentSpeakId) setState("speaking");
          };

          utterance.onend = () => {
            if (speakIdRef.current === currentSpeakId) setState("idle");
          };

          utterance.onerror = () => {
            if (speakIdRef.current === currentSpeakId) setState("idle");
          };

          window.speechSynthesis.speak(utterance);
          return;
        } catch {
          // Fall back to server TTS fetch
        }
      }

      // Cloud TTS Fallback with language context
      try {
        const response = await fetch("/api/voice/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(await authHeader()) },
          body: JSON.stringify({ text: cleanText, language }),
        });

        if (speakIdRef.current !== currentSpeakId) return;

        if (response.ok) {
          const blob = await response.blob();
          if (speakIdRef.current !== currentSpeakId) return;

          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audioRef.current = audio;

          audio.onended = () => {
            URL.revokeObjectURL(url);
            if (speakIdRef.current === currentSpeakId) setState("idle");
          };

          setState("speaking");
          await audio.play();
          return;
        }
      } catch {
        // ignore error
      }

      if (speakIdRef.current === currentSpeakId) setState("idle");
    },
    [language, stopSpeaking],
  );

  return { state, level, error, startRecording, stopRecording, speak, stopSpeaking, setError };
}
