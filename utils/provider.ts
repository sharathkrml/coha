import { createOpenAI } from "@ai-sdk/openai"
import type { LanguageModel } from "ai"

// Local-first provider list, tried in order:
//
// 0. Ollama     POST http://localhost:11434/v1/chat/completions
//               {"model":"gemma4:e4b","messages":[...]}
//
// 1. AIBridge   POST https://aibridge-api.com/v1/chat/completions
//
// 1. AIBridge   POST https://aibridge-api.com/v1/chat/completions
//               -H "Authorization: Bearer $AIBRIDGE_API_KEY"
//               {"model":"deepseek-chat","messages":[...]}
//
// 2. OpenCode Go POST https://opencode.ai/zen/go/v1/chat/completions
//               -H "Authorization: Bearer $OPENCODE_API_KEY"
//               -H "x-opencode-session: <stable id>"   (required for routing)
//               {"model":"glm-5.3-flash","messages":[...]}
//
// 3. NVIDIA     POST https://integrate.api.nvidia.com/v1/chat/completions
//               -H "Authorization: Bearer $NVIDIA_API_KEY"
//               {"model":"meta/llama-3.1-405b-instruct","messages":[...]}
//
// NOTE: OpenCode Go's /responses endpoint currently returns 500 server-side;
// its /chat/completions works, so we use .chat() for both providers.
export const AIBRIDGE_BASE_URL = "https://aibridge-api.com/v1"
export const AIBRIDGE_DEFAULT_MODEL = "deepseek-v4-flash"

export const OLLAMA_BASE_URL = "http://localhost:11434/v1"
export const OLLAMA_DEFAULT_MODEL = "gemma4:e4b"

export const OPENGO_BASE_URL = "https://opencode.ai/zen/go/v1"
export const OPENGO_MODEL_ID = "glm-5.3-flash"

export const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1"
export const NVIDIA_DEFAULT_MODEL = "nemotron-3.5-lightning-30b-a3b"

export type Provider = {
  name: string
  modelId: string
  model: LanguageModel
}

// Stable per process (required for OpenCode Go routing / prompt caching).
// Override with OPENCODE_SESSION_ID.
const SESSION_ID = process.env.OPENCODE_SESSION_ID ?? `coha-${Date.now()}`

function chat(
  name: string,
  baseURL: string,
  apiKey: string,
  modelId: string,
  headers?: Record<string, string>,
): Provider {
  return {
    name,
    modelId,
    model: createOpenAI({ baseURL, apiKey, name, headers }).chat(modelId),
  }
}

export function getProviders(): Provider[] {
  const providers: Provider[] = []
  // Opencode first prio
  if (process.env.OPENCODE_API_KEY) {
    providers.push(
      chat(
        "opencode-go",
        OPENGO_BASE_URL,
        process.env.OPENCODE_API_KEY,
        OPENGO_MODEL_ID,
        {
          // Go asks clients to identify themselves + send a stable session id
          // for routing / prompt caching. Required: without it the API 400s.
          // See https://opencode.ai/docs/go/#where-can-i-use-it
          "User-Agent": "coha/1.0",
          "X-Title": "coha",
          "x-opencode-session": SESSION_ID,
        },
      ),
    )
  }
  // NVIDIA is first preference when a key is set.
  if (process.env.NVIDIA_API_KEY) {
    providers.push(
      chat(
        "nvidia",
        NVIDIA_BASE_URL,
        process.env.NVIDIA_API_KEY,
        process.env.NVIDIA_MODEL ?? NVIDIA_DEFAULT_MODEL,
      ),
    )
  }

  // Ollama is local and free — first preference without an NVIDIA key.
  // The OpenAI client requires a key; Ollama ignores it.
  providers.push(
    chat(
      "ollama",
      OLLAMA_BASE_URL,
      "ollama",
      process.env.OLLAMA_MODEL ?? OLLAMA_DEFAULT_MODEL,
    ),
  )

  if (process.env.AIBRIDGE_API_KEY) {
    providers.push(
      chat(
        "aibridge",
        AIBRIDGE_BASE_URL,
        process.env.AIBRIDGE_API_KEY,
        AIBRIDGE_DEFAULT_MODEL,
      ),
    )
  }

  return providers
}
