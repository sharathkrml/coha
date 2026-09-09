import { createOpenAI } from "@ai-sdk/openai"
import type { LanguageModel } from "ai"

// Two OpenAI-compatible APIs, tried in order (AIBridge has priority):
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
// NOTE: OpenCode Go's /responses endpoint currently returns 500 server-side;
// its /chat/completions works, so we use .chat() for both providers.
export const AIBRIDGE_BASE_URL = "https://aibridge-api.com/v1"
export const AIBRIDGE_DEFAULT_MODEL = "deepseek-v4-flash"

export const OPENGO_BASE_URL = "https://opencode.ai/zen/go/v1"
export const OPENGO_MODEL_ID = "glm-5.3-flash"

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

  if (process.env.OPENCODE_API_KEY) {
    providers.push(
      chat("opencode-go", OPENGO_BASE_URL, process.env.OPENCODE_API_KEY, OPENGO_MODEL_ID, {
        // Go asks clients to identify themselves + send a stable session id
        // for routing / prompt caching. Required: without it the API 400s.
        // See https://opencode.ai/docs/go/#where-can-i-use-it
        "User-Agent": "coha/1.0",
        "X-Title": "coha",
        "x-opencode-session": SESSION_ID,
      }),
    )
  }

  return providers
}
