// Markdown -> readable terminal text. Dependency-free.
// Handles fences, headers, lists, bold/italic/inline-code, rules,
// with a carry buffer so it works on streamed chunks that split tokens.

const isTTY = process.stdout.isTTY

const C = isTTY
  ? {
      bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
      underline: (s: string) => `\x1b[1;4m${s}\x1b[0m`,
      code: (s: string) => `\x1b[36m${s}\x1b[0m`,
      dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
    }
  : {
      bold: (s: string) => s,
      underline: (s: string) => s.toUpperCase(),
      code: (s: string) => s,
      dim: (s: string) => s,
    }

function transformLine(line: string, state: { inCode: boolean }): string {
  // Fences
  const fence = line.match(/^(\s*)(```+|~~~+)(\w*)\s*$/)
  if (fence) {
    if (!state.inCode) {
      state.inCode = true
      const lang = fence[3]
      return C.dim(`── code${lang ? ` (${lang})` : ""} ────────────`)
    }
    state.inCode = false
    return C.dim("────────────────────────────")
  }

  if (state.inCode) return `  ${line}`

  // Headers: ### Title -> bold underline
  const header = line.match(/^\s*#{1,6}\s+(.*)$/)
  if (header?.[1] !== undefined) return C.underline(header[1])

  // Horizontal rules
  if (/^\s*([-*_])\s*\1{2,}\s*$/.test(line)) return C.dim("─".repeat(40))

  // Blockquotes
  const quote = line.match(/^\s*>\s?(.*)$/)
  if (quote?.[1] !== undefined) return `${C.dim("│ ")}${quote[1]}`

  // Bullets -> •
  line = line.replace(/^(\s*)[-*+]\s+/, "$1• ")

  // Bold, italic, inline code (bold first so ** doesn't leave stray *)
  line = line.replace(/\*\*([^*]+)\*\*/g, (_m, s) => C.bold(s))
  line = line.replace(/\*([^*]+)\*/g, "$1")
  line = line.replace(/`([^`]+)`/g, (_m, s) => C.code(s))
  return line
}

export function formatText(text: string): string {
  const state = { inCode: false }
  return text.split("\n").map((l) => transformLine(l, state)).join("\n")
}

// Stateful formatter for streamed deltas.
export class StreamFormatter {
  private carry = ""
  private state = { inCode: false }

  feed(delta: string): string {
    this.carry += delta
    const lines = this.carry.split("\n")
    // Last element may be an incomplete line — keep it as carry.
    this.carry = lines.pop() ?? ""
    return lines.map((l) => transformLine(l, this.state)).join("\n") +
      (lines.length ? "\n" : "")
  }

  end(): string {
    const rest = this.carry
    this.carry = ""
    return transformLine(rest, this.state)
  }
}
