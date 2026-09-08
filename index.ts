import { generateText, isLoopFinished, streamText } from "ai"
import type { ModelMessage } from "ai"
import { createInterface } from "node:readline"
import {
  getProviders,
  AIBRIDGE_BASE_URL,
  OPENGO_BASE_URL,
} from "./utils/provider.ts"
import { bashTool } from "./utils/tools.ts"
import { formatText, StreamFormatter } from "./utils/render.ts"
import { dev } from "./utils/log.ts"

async function readStdin(): Promise<string> {
  // If stdin is a TTY there is nothing piped in.
  if (process.stdin.isTTY) return ""
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString("utf-8").trim()
}

export async function getUserPrompt(): Promise<string | undefined> {
  const args = process.argv.slice(2).filter((a) => a !== "--no-stream")
  const argPrompt = args.join(" ").trim()
  const piped = await readStdin()

  // Combine: `echo "context" | bun run index.ts "question"` -> "context\n\nquestion"
  // or just use whichever source is present.
  const combined = [piped, argPrompt].filter(Boolean).join("\n\n")
  return combined || undefined
}

// One conversation turn: sends the whole history, executes tools,
// and returns the text plus the new messages to append to history.
// Providers are tried in priority order (AIBridge first, then OpenCode Go);
// the first that succeeds wins.
export async function chatTurn(
  messages: ModelMessage[],
  opts?: { stream?: boolean },
): Promise<{ text: string; responseMessages: ModelMessage[] }> {
  const tools = { bash: bashTool }
  const shouldStream = opts?.stream ?? !process.argv.includes("--no-stream")
  const started = performance.now()

  dev.banner("chat turn")
  dev.kv("history", `${messages.length} message(s)`)
  dev.kv("mode", shouldStream ? "stream" : "generate")
  const lastUser = [...messages].reverse().find((m) => m.role === "user")
  if (lastUser) dev.kv("prompt", String(lastUser.content).slice(0, 80))

  const finish = (detail: string) =>
    dev.bannerEnd(
      "chat turn",
      `${detail} · ${Math.round(performance.now() - started)}ms`,
    )

  const providers = getProviders()
  if (providers.length === 0) {
    console.error(
      "No API key configured. Set AIBRIDGE_API_KEY (priority) and/or " +
        "OPENCODE_API_KEY in your environment or .env file.",
    )
    process.exit(1)
  }

  const formatter = new StreamFormatter()
  const errors: string[] = []

  for (const provider of providers) {
    dev.kv("provider", `${provider.name} · ${provider.modelId}`)
    try {
      if (!shouldStream) {
        const { text, responseMessages } = await generateText({
          model: provider.model,
          messages,
          tools,
          stopWhen: isLoopFinished(),
        })
        finish(`${provider.name} · generate · ${text.length} chars`)
        return { text: formatText(text), responseMessages }
      }

      const result = streamText({
        model: provider.model,
        messages,
        tools,
        stopWhen: isLoopFinished(),
      })
      let full = ""
      for await (const delta of result.textStream) {
        full += delta
        process.stdout.write(formatter.feed(delta))
      }
      // Flush the final partial line.
      process.stdout.write(formatter.end())
      // Ensure trailing newline for clean shell output.
      if (full && !full.endsWith("\n")) process.stdout.write("\n")
      const responseMessages = await result.responseMessages
      finish(
        `${provider.name} · stream · ${full.length} chars · ${responseMessages.length} msgs`,
      )
      return { text: formatText(full), responseMessages }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      // Streamed output may have already printed partial junk before failing.
      if (shouldStream)
        console.error("\n[fallback] provider failed, trying next…")
      errors.push(`${provider.name}: ${message}`)
      dev.kv("error", `${provider.name} failed: ${message.slice(0, 120)}`)
    }
  }

  throw new Error(`All providers failed:\n  ${errors.join("\n  ")}`)
}

// Backwards-compatible one-shot runner.
export async function runPrompt(
  prompt: string,
  opts?: { stream?: boolean },
): Promise<string> {
  const { text } = await chatTurn([{ role: "user", content: prompt }], opts)
  return text
}

const EXIT_COMMANDS = new Set(["/exit", "/quit", "/q"])

export async function chatLoop(): Promise<void> {
  const streaming = !process.argv.includes("--no-stream")
  const rl = createInterface({ input: process.stdin, output: process.stdout })

  console.log(
    `coha chat — priority: ${getProviders()
      .map((p) => `${p.name} (${p.modelId})`)
      .join(" → ")}\n` +
      "Type a message; /exit (or Ctrl+D) to quit. Tools: bash",
  )

  const messages: ModelMessage[] = []

  const readLine = (): Promise<string> =>
    new Promise((resolve) => {
      const finish = (value: string) => {
        rl.removeListener("line", onLine)
        rl.removeListener("SIGINT", onSigint)
        resolve(value)
      }
      const onLine = (line: string) => finish(line.trim())
      const onSigint = () => {
        process.stdout.write("\n")
        finish("/exit")
      }
      rl.once("line", onLine)
      rl.once("SIGINT", onSigint)
    })

  while (true) {
    const input = await readLine()
    if (!input) continue
    if (EXIT_COMMANDS.has(input.toLowerCase())) break

    messages.push({ role: "user", content: input })

    try {
      const { text, responseMessages } = await chatTurn(messages, {
        stream: streaming,
      })
      if (!text) console.log("(no text output)")
      messages.push(...responseMessages)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`\nError: ${message}`)
      // Drop the unanswered user turn so the history stays consistent.
      messages.pop()
    }
  }

  rl.close()
  console.log("Bye!")
}

// CLI entrypoint — skipped when imported as a module.
if (import.meta.main) {
  try {
    const oneShot = await getUserPrompt()
    if (oneShot) {
      // Piped input or CLI args -> one-shot mode (unchanged behavior).
      const streaming = !process.argv.includes("--no-stream")
      if (streaming) {
        await runPrompt(oneShot, { stream: true })
      } else {
        const text = await runPrompt(oneShot, { stream: false })
        console.log(text)
      }
    } else if (process.stdin.isTTY && process.stdout.isTTY) {
      // Interactive terminal -> continuous chat loop.
      await chatLoop()
    } else {
      console.error(
        "No prompt provided.\n\nUsage:\n" +
          '  bun run index.ts "Explain recursion in one sentence"\n' +
          '  echo "Summarize this" | bun run index.ts\n' +
          "  bun run index.ts            (interactive chat)\n" +
          '  bun run index.ts --no-stream "Your prompt"\n' +
          "  bun run index.ts --quiet     (hide dev logs)\n",
      )
      process.exit(1)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (
      message.includes("500") ||
      message.toLowerCase().includes("internal server error")
    ) {
      console.error(
        `\nHint: a provider returned a server error. AIBridge uses ` +
          `${AIBRIDGE_BASE_URL}/chat/completions and OpenCode Go uses ` +
          `${OPENGO_BASE_URL}/chat/completions (with x-opencode-session header) — ` +
          `both via .chat(). Check the provider status or your keys.`,
      )
    }
    console.error(`\nError: ${message}`)
    process.exit(1)
  }
}
