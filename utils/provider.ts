import { createOpenAI } from "@ai-sdk/openai"
import type { LanguageModel } from "ai"

// Mirrors the working curl:
// POST https://aibridge-api.com/v1/chat/completions
// -H "Authorization: Bearer $AIBRIDGE_API_KEY"
// -H "Content-Type: application/json"
// -d '{"model":"deepseek-chat","messages":[...]}'
export const AIBRIDGE_BASE_URL = "https://aibridge-api.com/v1"
export const AIBRIDGE_DEFAULT_MODEL = "deepseek-v4-flash"

export function getAIBridgeApiKey(): string {
  // Bun auto-loads .env, no dotenv needed.
  const key = process.env.AIBRIDGE_API_KEY ?? ""
  if (!key) {
    console.error(
      "Missing API key. Set AIBRIDGE_API_KEY in your environment or .env file.",
    )
    process.exit(1)
  }
  return key
}

export function createAIBridgeClient(apiKey: string = getAIBridgeApiKey()) {
  // OpenAI-compatible provider rooted at .../v1 (NOT .../v1/chat/completions).
  // Calling .chat(modelId) POSTs to {baseURL}/chat/completions.
  return createOpenAI({
    baseURL: AIBRIDGE_BASE_URL,
    apiKey,
    name: "aibridge",
  })
}

// Drop-in LanguageModel for `generateText({ model })` / `streamText({ model })` in index.ts.
export function getAIBridgeModel(
  modelId: string = AIBRIDGE_DEFAULT_MODEL,
): LanguageModel {
  return createAIBridgeClient().chat(modelId)
}
