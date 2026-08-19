import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const LOVABLE_AIG_RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

export function createLovableAiGatewayRunIdFetch(initialRunId?: string) {
  let runId = initialRunId?.trim() || undefined;
  let resolveRunId: (value: string | undefined) => void = () => {};
  let runIdResolved = false;
  const runIdReady = new Promise<string | undefined>((resolve) => {
    resolveRunId = resolve;
  });

  const publishRunId = (value?: string) => {
    const nextRunId = value?.trim() || undefined;
    if (!runId && nextRunId) {
      runId = nextRunId;
    }
    if (!runIdResolved) {
      runIdResolved = true;
      resolveRunId(runId);
    }
  };
  if (runId) publishRunId(runId);

  return {
    fetch: (async (input, init) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(LOVABLE_AIG_RUN_ID_HEADER)) {
        headers.set(LOVABLE_AIG_RUN_ID_HEADER, runId);
      }
      try {
        const response = await fetch(input, { ...init, headers });
        publishRunId(response.headers.get(LOVABLE_AIG_RUN_ID_HEADER) ?? undefined);
        return response;
      } catch (error) {
        publishRunId(undefined);
        throw error;
      }
    }) as typeof fetch,
    getRunId: () => runId,
    waitForRunId: () => (runId ? Promise.resolve(runId) : runIdReady),
  };
}

export function createLovableAiGatewayProvider(lovableApiKey: string, initialRunId?: string) {
  const runIdFetch = createLovableAiGatewayRunIdFetch(initialRunId);

  const provider = createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
    fetch: runIdFetch.fetch,
  });

  return Object.assign(provider, {
    getRunId: runIdFetch.getRunId,
    waitForRunId: runIdFetch.waitForRunId,
  });
}

export function getLovableAiGatewayRunId(request: Request) {
  return request.headers.get(LOVABLE_AIG_RUN_ID_HEADER)?.trim() || undefined;
}

export function getLovableAiGatewayResponseHeaders(
  providerHeaders: HeadersInit | undefined,
  init?: HeadersInit,
) {
  const headers = new Headers(init);
  const exposedHeaders = new Set(
    (headers.get("Access-Control-Expose-Headers") ?? "")
      .split(",")
      .map((header) => header.trim())
      .filter(Boolean),
  );

  new Headers(providerHeaders).forEach((value, name) => {
    if (name.toLowerCase().startsWith("x-lovable-aig-")) {
      headers.set(name, value);
      exposedHeaders.add(name);
    }
  });

  headers.forEach((_, name) => {
    if (name.toLowerCase().startsWith("x-lovable-aig-")) {
      exposedHeaders.add(name);
    }
  });

  if (exposedHeaders.size > 0) {
    headers.set("Access-Control-Expose-Headers", Array.from(exposedHeaders).join(", "));
  }

  return headers;
}

export async function withLovableAiGatewayRunIdHeader(
  response: Response,
  gateway: {
    getRunId: () => string | undefined;
    waitForRunId: () => Promise<string | undefined>;
  },
  init?: HeadersInit,
) {
  if (!response.body) {
    const runId = gateway.getRunId();
    const headers = getLovableAiGatewayResponseHeaders(undefined, response.headers);
    new Headers(init).forEach((value, name) => headers.set(name, value));
    if (runId) headers.set(LOVABLE_AIG_RUN_ID_HEADER, runId);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: getLovableAiGatewayResponseHeaders(undefined, headers),
    });
  }

  const reader = response.body.getReader();
  const firstChunk = reader.read();
  const runId = await gateway.waitForRunId();
  const headers = getLovableAiGatewayResponseHeaders(undefined, response.headers);
  new Headers(init).forEach((value, name) => headers.set(name, value));
  if (runId) headers.set(LOVABLE_AIG_RUN_ID_HEADER, runId);

  const body = new ReadableStream({
    async start(controller) {
      try {
        const first = await firstChunk;
        if (first.done) {
          controller.close();
          return;
        }
        controller.enqueue(first.value);
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          controller.enqueue(chunk.value);
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
    cancel(reason?: unknown) {
      return reader.cancel(reason);
    },
  });

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: getLovableAiGatewayResponseHeaders(undefined, headers),
  });
}

import { createGoogleGenerativeAI } from "@ai-sdk/google";

let geminiKeyIndex = 0;

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

function createRotatingGeminiFetch(keys: string[]) {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    let attempts = 0;
    const maxAttempts = keys.length;

    while (attempts < maxAttempts) {
      const activeKey = keys[geminiKeyIndex % keys.length];
      const headers = new Headers(init?.headers);
      headers.set("x-goog-api-key", activeKey);

      let targetUrl = typeof input === "string" ? input : input.toString();
      if (!targetUrl.includes("key=")) {
        const separator = targetUrl.includes("?") ? "&" : "?";
        targetUrl = `${targetUrl}${separator}key=${encodeURIComponent(activeKey)}`;
      }

      try {
        const response = await fetch(targetUrl, { ...init, headers });

        if (response.status === 429 || response.status === 403) {
          const text = await response
            .clone()
            .text()
            .catch(() => "");
          if (
            response.status === 429 ||
            text.includes("RESOURCE_EXHAUSTED") ||
            text.includes("quota")
          ) {
            console.warn(
              `[Gemini Key Rotator] Key ${geminiKeyIndex + 1}/${keys.length} rate limited (429). Rotating to key ${((geminiKeyIndex + 1) % keys.length) + 1}...`,
            );
            geminiKeyIndex = (geminiKeyIndex + 1) % keys.length;
            attempts++;
            continue;
          }
        }

        geminiKeyIndex = (geminiKeyIndex + 1) % keys.length;
        return response;
      } catch (error) {
        attempts++;
        geminiKeyIndex = (geminiKeyIndex + 1) % keys.length;
        if (attempts >= maxAttempts) throw error;
      }
    }

    const activeKey = keys[geminiKeyIndex % keys.length];
    const headers = new Headers(init?.headers);
    headers.set("x-goog-api-key", activeKey);
    let targetUrl = typeof input === "string" ? input : input.toString();
    if (!targetUrl.includes("key=")) {
      const separator = targetUrl.includes("?") ? "&" : "?";
      targetUrl = `${targetUrl}${separator}key=${encodeURIComponent(activeKey)}`;
    }
    return fetch(targetUrl, { ...init, headers });
  };
}

export function getAiModel(request?: Request, initialRunId?: string) {
  const geminiKeys = parseGeminiKeys();

  // Priority #1: Official Native Google Gemini SDK (@ai-sdk/google) with Multi-Key Rotation & 429 Failover
  if (geminiKeys.length > 0) {
    const googleProvider = createGoogleGenerativeAI({
      apiKey: geminiKeys[0],
      fetch: createRotatingGeminiFetch(geminiKeys),
    });
    const modelName = process.env["GEMINI_MODEL"] || "gemini-3.6-flash";
    return {
      model: googleProvider(modelName),
      type: "gemini" as const,
      activeKeysCount: geminiKeys.length,
    };
  }

  const lovableKey = process.env["LOVABLE_API_KEY"];
  const openaiKey = process.env["OPENAI_API_KEY"];
  const ollamaUrl = process.env["OLLAMA_BASE_URL"];
  const ollamaModel = process.env["OLLAMA_MODEL"] || "qwen2.5:7b";
  const useLocal = process.env["USE_LOCAL_MODEL"] === "true";

  if (lovableKey) {
    const runId = request ? getLovableAiGatewayRunId(request) : initialRunId;
    const gateway = createLovableAiGatewayProvider(lovableKey, runId);
    return {
      model: gateway("google/gemini-3.7-flash"),
      gateway,
      type: "lovable" as const,
    };
  }

  if (openaiKey) {
    const provider = createOpenAICompatible({
      name: "openai",
      baseURL: process.env["OPENAI_BASE_URL"] || "https://api.openai.com/v1",
      headers: { Authorization: `Bearer ${openaiKey}` },
    });
    return {
      model: provider(process.env["OPENAI_MODEL"] || "gpt-4o-mini"),
      type: "openai" as const,
    };
  }

  if (useLocal || ollamaUrl) {
    const baseURL = ollamaUrl
      ? ollamaUrl.endsWith("/v1")
        ? ollamaUrl
        : `${ollamaUrl.replace(/\/$/, "")}/v1`
      : "http://localhost:11434/v1";
    const provider = createOpenAICompatible({
      name: "ollama",
      baseURL,
    });
    return {
      model: provider(ollamaModel),
      type: "ollama" as const,
    };
  }

  return null;
}
