# coha (Coding Harness) 🧠⚡

ok so basically this is an **AI coding agent you run from your terminal** like a total menace 😤
it is called **Coha** = **Co**ding **Ha**rness - we out here turning ur terminal into a lil coding sidekick fr fr 🔥

## what does it even do 👀

it is a **command-line AI coding assistant** built with Bun. it talks to an LLM through OpenAI-compatible **providers**, gives it a **bash tool** and an agentic **tool loop**, so it can act as a real coding agent - inspecting files, running builds/tests, checking git status, all that real dev shii 💪. replies **stream live** and get rendered from Markdown straight into ur terminal (headers, code fences, lists, bold, inline code) 🎨.

### providers 🚏 (auto-failover, priority order)
two OpenAI-compatible APIs are configured and tried in order - **the first that succeeds wins**:

| provider | base URL | model | key |
|---|---|---|---|
| **Ollama** (primary, local) | http://localhost:11434/v1 | gemma4:e4b (`OLLAMA_MODEL` to override) | none |
| **AIBridge** | https://aibridge-api.com/v1 | deepseek-v4-flash | AIBRIDGE_API_KEY |
| **OpenCode Go** (fallback) | https://opencode.ai/zen/go/v1 | glm-5.3-flash | OPENCODE_API_KEY |

> OpenCode Go also wants a stable session id sent as the `x-opencode-session` header (for routing / prompt caching). Set `OPENCODE_SESSION_ID` or it auto-generates one per run.

### 1. one-shot mode 🎯
just ask it a question and get ur answer and dip:

- `bun run index.ts "explain recursion in one sentence"`

or feed it some context via stdin:

- `echo "summarize this" | bun run index.ts`

or do both at once (context + question):

- `echo "summarize this" | bun run index.ts "in one sentence"`

### 2. interactive chat mode 💬
no args + a real terminal = u go straight into an endless chat with the AI. it keeps the whole convo **in memory for the session** (including the tool runs) so the AI stays in context ✨:

- `bun run index.ts`

- it prints which providers are active and their priority when it starts
- type `/exit`, `/quit`, or `/q` - or hit **Ctrl+D / Ctrl+C** - to peace out
- empty lines are ignored; history lives in the session only (not saved between runs... yet)

### flags ⚙️
- `--no-stream` — turn off live streaming (works in **both** one-shot and chat mode)
- `--quiet` — hide the dev-log banners (same as `COHA_DEBUG=0`)

## install it bestie 🚀

bun install

needs [Bun](https://bun.com) (lockfile: `bun.lock`). deps are the AI SDK (`ai`, `@ai-sdk/openai`).

## run it rq 🏃

bun run index.ts "your prompt here"
echo "summarize this" | bun run index.ts
bun run index.ts --no-stream "your prompt here"   # no live streaming
bun run index.ts --quiet "your prompt here"       # no dev logs

## config n stuff 🔑

the magic happens in `.env`:

AIBRIDGE_API_KEY=your-key-here     # required - primary provider
OPENCODE_API_KEY=your-key-here     # optional - enables the fallback provider
OPENCODE_SESSION_ID=stable-id      # optional - stable session for OpenCode Go
COHA_DEBUG=0                       # optional - dev logs off by default

it auto-loads `.env` (Bun just Does That™, no dotenv needed, we are living in 3025 gng) 💅

if no key is set at all, it prints a hint and bails (exit 1). if a provider 500s or fails, it falls back to the next one and collects the errors for the final message.

## repo layout 🗂️

- `index.ts` - CLI entrypoint (one-shot + chat loop, provider failover, streaming, tool loop)
- `utils/provider.ts` - AIBridge + OpenCode Go clients + model setup (priority order)
- `utils/tools.ts` - the bash tool (runs via `Bun.$`, truncates output at 20k chars)
- `utils/render.ts` - Markdown to terminal pretty-printing (works live on streams)
- `utils/log.ts` - dev-log banners (dim lines to stderr; off with `--quiet` / `COHA_DEBUG=0`)

## the vibes 🎨

built on [Bun](https://bun.com) - the fast all-in-one JS runtime - created via bun init. no express, no server frameworks, no cap (well, `node:readline` handles the chat input - that is it). the agent loop is driven by the AI SDK isLoopFinished, so the model can keep calling bash until it decides the job is done. honestly Bun is just built different 💯

---

*coha: ur terminal personal coding bestie* 🤝