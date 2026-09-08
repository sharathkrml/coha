import { $ } from "bun"
import { tool } from "ai"
import { z } from "zod"
import { dev } from "./log.ts"

const MAX_OUTPUT_CHARS = 20_000

function truncate(text: string): string {
  if (text.length <= MAX_OUTPUT_CHARS) return text
  return (
    text.slice(0, MAX_OUTPUT_CHARS) +
    `\n... [truncated ${text.length - MAX_OUTPUT_CHARS} chars]`
  )
}

export const bashTool = tool({
  description:
    "Run a shell command on the terminal via Bun.$ and return its output. " +
    "Use for listing files, reading files, running builds/tests, git status, etc. " +
    "Avoid interactive or long-running commands.",
  inputSchema: z.object({
    command: z.string().describe("The shell command to run, e.g. 'ls -la'"),
    cwd: z
      .string()
      .optional()
      .describe("Working directory to run the command in"),
  }),
  execute: async ({ command, cwd }: { command: string; cwd?: string }) => {
    const trimmed = command.trim()
    if (!trimmed) return "Error: empty command"

    const started = performance.now()
    dev.banner("bash tool")
    dev.kv("cwd", cwd ?? process.cwd())
    dev.line(`$ ${trimmed}`)

    let shell = $`${{ raw: trimmed }}`.nothrow().quiet()
    if (cwd) shell = shell.cwd(cwd)

    const result = await shell
    const stdout = truncate(result.stdout.toString())
    const stderr = truncate(result.stderr.toString())
    const ms = Math.round(performance.now() - started)
    dev.bannerEnd("bash tool", `exit ${result.exitCode} · ${ms}ms`)

    return `exitCode: ${result.exitCode}\nstdout:\n${stdout || "(empty)"}\nstderr:\n${stderr || "(empty)"}`
  },
})

export const tools = {
  bash: bashTool,
}
