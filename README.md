# coha (Coding Harness) 🧠⚡

ok so basically this is an **AI coding agent you run from your terminal** like a total menace 😤
it is called **Coha** = **Co**ding **Ha**rness - we out here turning ur terminal into a lil coding sidekick fr fr 🔥

## what does it even do 👀

it is a **command-line AI coding assistant** built with Bun that talks to an LLM (**DeepSeek Chat** via **AIBridge**) and gives it a **bash tool** so it can act as an actual coding agent - inspecting files, running builds/tests, checking git status, all that real dev shii 💪

it be vibin in like 2 modes:

### 1. one-shot mode 🎯
just ask it a question and get ur answer and dip:

-  bun run index.ts "explain recursion in one sentence"

or feed it some context via stdin:

-  echo "summarize this" | bun run index.ts

### 2. interactive chat mode 💬
no args = u go straight into an endless chat with the AI (it even saves ur convo history so it remembers ur lore ✨):

-  bun run index.ts

-  type /exit (or /quit or /q, or just Ctrl+D) to peace out
-  pass --no-stream if u do not want it talking live

## install it bestie 🚀

bun install

## run it rq 🏃

bun run index.ts "your prompt here"

## config n stuff 🔑

the magic happens in .env:

AIBRIDGE_API_KEY=your-key-here

it auto-loads .env (Bun just Does That™, no dotenv needed, we are living in 3025 gng) 💅

under the hood it hits:
-  **AIBridge API** at https://aibridge-api.com/v1 (OpenAI-compatible endpoint)
-  default model: **deepseek-chat**

## repo layout 🗂️

-  index.ts - CLI entrypoint (chats, tool-loops, streams)
-  utils/prompts.ts - the vibe check ("u a coding agent, code only")
-  utils/provider.ts - AIBridge client + model setup
-  utils/tools.ts - the bash tool (so the AI can touch ur files)

## the vibes 🎨

built on [Bun](https://bun.com) - the fast all-in-one JS runtime - created via bun init. no express, no node, no cap. Bun.serve() handles everything, Bun.$ runs ur shell commands, Bun.sql for the DBs... honestly Bun is just built different 💯

---

*coha: ur terminal personal coding bestie* 🤝
