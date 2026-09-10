import { $ } from "bun"
import { tool } from "ai"
import { z } from "zod"
import { readFile, writeFile, mkdir } from "node:fs/promises"
import { resolve, dirname } from "node:path"
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

export const writeFileTool = tool({
  description:
    "Write (create or overwrite) a text file on disk. " +
    "Use for creating new files or replacing whole file contents. " +
    "Parent directories are created as needed.",
  inputSchema: z.object({
    path: z.string().describe("Path of the file to write"),
    content: z.string().describe("Full text content to write to the file"),
    cwd: z.string().optional().describe("Base directory the path is relative to"),
  }),
  execute: async ({
    path,
    content,
    cwd,
  }: {
    path: string
    content: string
    cwd?: string
  }) => {
    const full = cwd ? resolve(cwd, path) : resolve(path)
    const id = ++callSeq
    dev.banner(`write file tool #${id}`)
    dev.kv("path", `${full} · ${content.length} chars`)

    try {
      await mkdir(dirname(full), { recursive: true })
      await writeFile(full, content, "utf-8")
      dev.bannerEnd(`write file tool #${id}`, "ok")
      return `Wrote ${content.length} chars to ${full}`
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      dev.bannerEnd(`write file tool #${id}`, `error · ${message.slice(0, 120)}`)
      return `Error writing ${full}: ${message}`
    }
  },
})

export const editFileTool = tool({
  description:
    "Replace text in a file via exact string match. " +
    "Use for edits, refactors, bug fixes. Fails if oldString not found or not unique (unless replaceAll is true).",
  inputSchema: z.object({
    path: z.string().describe("Path of the file to edit"),
    oldString: z.string().describe("Exact text to find in the file"),
    newString: z.string().describe("Text to replace it with"),
    replaceAll: z
      .boolean()
      .optional()
      .describe("Replace every occurrence (default false)"),
    cwd: z.string().optional().describe("Base directory the path is relative to"),
  }),
  execute: async ({
    path,
    oldString,
    newString,
    replaceAll,
    cwd,
  }: {
    path: string
    oldString: string
    newString: string
    replaceAll?: boolean
    cwd?: string
  }) => {
    const full = cwd ? resolve(cwd, path) : resolve(path)
    const id = ++callSeq
    dev.banner(`edit file tool #${id}`)
    dev.kv("path", full)

    try {
      const current = await readFile(full, "utf-8")
      if (!current.includes(oldString))
        return `Error: oldString not found in ${full}`
      const matches = current.split(oldString).length - 1
      if (matches > 1 && !replaceAll)
        return `Error: oldString found ${matches} times in ${full} — provide more context or set replaceAll: true`
      const updated = replaceAll
        ? current.split(oldString).join(newString)
        : current.replace(oldString, newString)
      await writeFile(full, updated, "utf-8")
      dev.bannerEnd(`edit file tool #${id}`, `ok · ${matches} match(es)`)
      return replaceAll
        ? `Replaced ${matches} occurrence(s) in ${full}`
        : `Edited ${full}`
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      dev.bannerEnd(`edit file tool #${id}`, `error · ${message.slice(0, 120)}`)
      return `Error editing ${full}: ${message}`
    }
  },
})

export const tools = {
  bash: bashTool,
  readFile: readFileTool,
  writeFile: writeFileTool,
  editFile: editFileTool,
}
