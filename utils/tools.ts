import { $ } from "bun"
import { tool } from "ai"
import { z } from "zod"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { dev } from "./log.ts"

const MAX_OUTPUT_CHARS = 20_000

// Tool calls can run in parallel; tag each with an id so interleaved
// dev-log banners stay attributable.
let callSeq = 0

function truncate(text: string): string {
  return text.length <= MAX_OUTPUT_CHARS
    ? text
    : text.slice(0, MAX_OUTPUT_CHARS) +
        `\n... [truncated ${text.length - MAX_OUTPUT_CHARS} chars]`
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
    const id = ++callSeq
    dev.banner(`bash tool #${id}`)
    dev.kv("cwd", cwd ?? process.cwd())
    dev.line(`$ ${trimmed}`)

    const result = await (cwd
      ? $`${{ raw: trimmed }}`.nothrow().quiet().cwd(cwd)
      : $`${{ raw: trimmed }}`.nothrow().quiet())
    const stdout = truncate(result.stdout.toString())
    const stderr = truncate(result.stderr.toString())
    const ms = Math.round(performance.now() - started)
    dev.bannerEnd(`bash tool #${id}`, `exit ${result.exitCode} · ${ms}ms`)

    return `exitCode: ${result.exitCode}\nstdout:\n${stdout || "(empty)"}\nstderr:\n${stderr || "(empty)"}`
  },
})

export const readFileTool = tool({
  description:
    "Read a text file from disk and return its contents with line numbers. " +
    "Use for source files, configs, docs, etc. Output is truncated at 20k chars.",
  inputSchema: z.object({
    path: z.string().describe("Path of the file to read"),
    cwd: z.string().optional().describe("Base directory the path is relative to"),
  }),
  execute: async ({ path, cwd }: { path: string; cwd?: string }) => {
    const full = cwd ? resolve(cwd, path) : resolve(path)
    const started = performance.now()
    const id = ++callSeq
    dev.banner(`read file tool #${id}`)
    dev.kv("path", full)

    try {
      const numbered = truncate(await readFile(full, "utf-8"))
        .split("\n")
        .map((line, i) => `${i + 1}: ${line}`)
        .join("\n")
      dev.bannerEnd(
        `read file tool #${id}`,
        `${Math.round(performance.now() - started)}ms`,
      )
      return numbered
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      dev.bannerEnd(`read file tool #${id}`, `error · ${message.slice(0, 120)}`)
      return `Error reading ${full}: ${message}`
    }
  },
})

export const tools = {
  bash: bashTool,
  readFile: readFileTool,
}
