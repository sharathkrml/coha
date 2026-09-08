// Dev logging, ON by default so you can see what happens on every run.
// Silence with COHA_DEBUG=0 (or --quiet flag).
// Renders banner-style lines like:
//
//   ************  bash tool  ************
//   $ pwd
//   ************  bash tool · exit 0 · 12ms  ************

const WIDTH = 72

export function isDev(): boolean {
  if (process.env.COHA_DEBUG === "0" || process.env.COHA_DEBUG === "false")
    return false
  return !process.argv.includes("--quiet")
}

const dim = (s: string) => (process.stderr.isTTY ? `\x1b[2m${s}\x1b[0m` : s)

function stars(): string {
  return "*".repeat(WIDTH)
}

function centered(title: string): string {
  const label = `  ${title}  `
  const fill = Math.max(0, WIDTH - label.length)
  const left = Math.floor(fill / 2)
  return "*".repeat(left) + label + "*".repeat(fill - left)
}

/** Blank line + full-width banner to stderr. */
export function banner(title: string): void {
  if (!isDev()) return
  process.stderr.write(`\n${dim(centered(title))}\n`)
}

/** Full-width banner with trailing metadata (e.g. timing). */
export function bannerEnd(title: string, detail?: string): void {
  if (!isDev()) return
  process.stderr.write(
    `\n${dim(centered(detail ? `${title} · ${detail}` : title))}\n`,
  )
}

/** A single key/value line under a banner. */
export function kv(key: string, value: string): void {
  if (!isDev()) return
  process.stderr.write(`${dim(`  ${key}:`)} ${value}\n`)
}

/** Raw line (indented), e.g. a shell command. */
export function line(text: string): void {
  if (!isDev()) return
  process.stderr.write(`${dim("  ")}${text}\n`)
}

export const dev = { isDev, banner, bannerEnd, kv, line }
export const DEV_RULE = () => (isDev() ? dim(stars()) : "")
