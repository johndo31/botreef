# Botreef

An open-source autonomous coding server. Deploy on a VPS, connect via SSH, Telegram, Slack, or any channel — and let AI write, test, commit, and push code for you.

Botreef turns a server into an autonomous coding agent. It wraps Claude Code CLI (or Codex) in a secure, sandboxed environment with pluggable input interfaces and full git lifecycle management.

## Features

- **Persistent bots** — Create named bots that live on your server, each with their own personality, engine config, and memory
- **Autonomous kanban** — Bots pick stories from the built-in kanban board, execute them, and move cards through columns
- **Bot memory** — Activity journal tracks what each bot has done, learned, and decided — injected into every future task as context
- **Multi-channel input** — SSH, Telegram, Slack, Discord, email, GitHub webhooks, kanban boards, REST API, Web UI
- **Autonomous coding** — AI reads your codebase, writes code, runs tests, commits, pushes, and creates PRs
- **Secure by default** — gVisor sandboxing, per-project isolation, encrypted secrets, audit logging, firewall hardening
- **Git-native workflow** — Clone repos, work on feature branches, require human approval before push
- **Pluggable architecture** — Add new input channels with ~100 lines of code via the adapter interface
- **Easy deployment** — One command to set up on any VPS with automatic TLS

## Quick Start

```bash
git clone https://github.com/johndo31/botreef.git
cd botreef
cp config.example.yaml config.yaml   # add your API key
docker compose up -d
```

Then connect:

```bash
# Via SSH
ssh -p 2222 botreef@your-server
> fix the login bug in project myapp

# Via Telegram
@botreef_bot fix the null pointer in auth.ts

# Via REST API
curl -X POST https://your-server/api/v1/tasks \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"projectId": "myapp", "instruction": "Add dark mode toggle"}'
```

## Architecture

```
  Channels                    Core                        Engine
┌──────────┐           ┌──────────────┐           ┌──────────────┐
│ SSH      │           │              │           │              │
│ Telegram │──────────▶│  Message     │           │  Sandbox     │
│ Slack    │  Inbound  │  Router      │──────────▶│  (gVisor)    │
│ Discord  │  Message  │  + Auth      │  Job      │              │
│ Email    │           │  + RBAC      │  Queue    │  Claude Code │
│ Webhooks │◀──────────│              │◀──────────│  CLI / Codex │
│ REST API │  Task     │  Git Manager │  Result   │              │
│ Web UI   │  Events   │              │           │  simple-git  │
└──────────┘           └──────────────┘           └──────────────┘
```

## Bots

Bots are first-class residents on Botreef. Each bot is a named entity with its own engine type, system prompt, concurrency settings, and activity journal. Bots autonomously poll the kanban board for stories assigned to them and execute them through the same pipeline as any channel.

```bash
# Create a bot via REST API
curl -X POST https://your-server/api/v1/bots \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "name": "frontend-dev",
    "projectId": "myapp",
    "engineType": "claude-code",
    "systemPrompt": "You are a frontend specialist. Use React and Tailwind.",
    "pollIntervalSeconds": 30,
    "maxConcurrentStories": 2
  }'

# Assign a kanban story to the bot
curl -X POST https://your-server/api/v1/projects/myapp/stories \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "columnId": "todo-column-id",
    "title": "Add dark mode toggle",
    "assignee": "bot-id",
    "assigneeType": "bot"
  }'

# The bot picks it up, executes it, commits, and moves the card to Review.

# View what the bot has been doing
curl https://your-server/api/v1/bots/bot-id/journal
```

Each bot maintains a **journal** — a log of tasks started, completed, failed, observations, decisions, and learnings. Recent journal entries are automatically injected into the instruction preamble for every future task, giving bots persistent memory across jobs without keeping containers alive.

## How It Works

1. A message arrives from any channel (SSH, Telegram, webhook, bot loop, etc.)
2. The adapter normalizes it into a standard `InboundMessage`
3. The router authenticates the user/bot, resolves the target project, and enqueues a job
4. The job processor creates an isolated sandbox container (Docker + gVisor)
5. If the job belongs to a bot, context (identity, system prompt, recent journal) is injected into the instruction
6. Claude Code CLI runs inside the sandbox against the cloned repo
7. Changes are committed to a feature branch; journal entries are written
8. Optionally: human approval required before push
9. Code is pushed, PR is created, and the user/bot is notified

## Supported Channels

| Channel | Status | How it works |
|---------|--------|-------------|
| **SSH** | Core | Interactive terminal REPL with streaming output |
| **REST API** | Core | Programmatic access, SSE streaming, callback webhooks |
| **Web UI** | Core | Dashboard with live terminal, task management, settings |
| **Telegram** | Built-in | Bot commands and natural language in DMs or groups |
| **Slack** | Built-in | Mentions, slash commands, threaded replies, Block Kit |
| **Discord** | Built-in | Slash commands, embeds, threads |
| **GitHub Webhooks** | Built-in | Triggered by issues, PR comments (`@botreef fix this`) |
| **Email** | Built-in | Send task via email, get results as reply |
| **Kanban** | Built-in | Card moves on Trello/Linear/GitHub Projects trigger tasks |
| **Custom** | Plugin | Implement the `Adapter` interface (~100 lines) |

Built on [OpenClaw](https://github.com/openclaw/openclaw)'s channel layer for battle-tested messaging adapters.

## Security

Botreef assumes AI-executed code is untrusted. Defense in depth:

- **gVisor (runsc)** — Userspace kernel intercepts all syscalls. Kernel exploits don't escape.
- **Container isolation** — Each project gets its own Docker container with resource limits
- **Network default-deny** — Sandbox containers have no internet access by default; allowlisted outbound only
- **Read-only rootfs** — Only `/workspace`, `/tmp`, and `/home` are writable inside sandboxes
- **Encrypted secrets** — API keys and tokens encrypted at rest, injected via env vars, never on disk in sandboxes
- **Unified auth** — Single identity system across all channels with per-project RBAC
- **Audit log** — Every action logged as structured JSON, streamable to external service
- **Firewall** — Only ports 22, 80, 443 exposed. Everything else firewalled via nftables
- **Auto-TLS** — Caddy handles Let's Encrypt certificates automatically
- **fail2ban** — Brute-force protection on all interfaces

## Tech Stack

| Component | Choice | Why |
|-----------|--------|-----|
| Language | TypeScript / Node.js 22 | Same ecosystem as Claude Code; best bot library support |
| Web Framework | Fastify 5 | Fast, plugin system, native WebSocket |
| Database | SQLite (better-sqlite3 + Drizzle ORM) | Zero-config, single file, perfect for single-server |
| Task Queue | BullMQ + Valkey | Progress tracking, retry, concurrency control |
| Sandbox | Docker + gVisor (runsc) | Userspace kernel isolation |
| Reverse Proxy | Caddy | Auto-TLS, zero-config HTTPS |
| AI Engine | Claude Code CLI / Codex CLI | Wrapped as subprocess, user brings own API key |
| Git | simple-git | Clone, branch, commit, push, PR creation |
| SSH Server | ssh2 | Interactive terminal access |
| Telegram | grammY | Modern Telegram bot framework |
| Slack | @slack/bolt | Official Slack SDK |
| Discord | discord.js | Dominant Discord library |
| Frontend | React 19 + Vite + Tailwind + xterm.js | Streaming terminal UI |

## System Requirements

| Tier | RAM | CPU | Disk | Cost/month |
|------|-----|-----|------|------------|
| Minimum | 2 GB | 1 vCPU | 25 GB SSD | ~$6-10 |
| Recommended | 4 GB | 2 vCPU | 50 GB SSD | ~$12-24 |
| Power user | 8 GB | 4 vCPU | 80 GB SSD | ~$24-48 |

Works on Ubuntu 22.04+, Debian 11+. Supports amd64 and arm64.

## Configuration

```yaml
# config.yaml
server:
  logLevel: info
  maxConcurrentJobs: 2

engine:
  type: claude-code
  defaultModel: claude-sonnet-4-20250514
  maxTurns: 50
  timeoutMinutes: 30

interfaces:
  ssh:
    enabled: true
    port: 2222
  telegram:
    enabled: true
    botToken: "${TELEGRAM_BOT_TOKEN}"
  slack:
    enabled: false

projects:
  my-app:
    repoUrl: git@github.com:user/my-app.git
    defaultBranch: main
    branchStrategy: feature-per-job
    autoPush: true
    autoCreatePr: true
    requireApproval: false
```

## Writing a Custom Adapter

Every adapter implements the same interface:

```typescript
interface Adapter {
  init(config: AdapterConfig, deps: AdapterDependencies): Promise<void>;
  start(): Promise<void>;
  stop(timeoutMs: number): Promise<void>;
  healthCheck(): Promise<HealthStatus>;
  sendEvent(event: TaskEvent): Promise<void>;
}
```

1. Set up your transport in `start()` (webhook, socket, polling)
2. Translate inbound messages to `InboundMessage` and call `deps.submitMessage()`
3. Implement `sendEvent()` to translate `TaskEvent` back to your channel's format
4. Export the plugin descriptor

See `src/adapters/` for examples.

## Running Locally

Botreef runs fine on a local machine for development. You need:

- **Node.js 22+** and npm
- **Docker** (for sandbox containers)
- **Valkey or Redis** (for the job queue) — or just `docker compose up valkey`

```bash
git clone https://github.com/johndo31/botreef.git
cd botreef
npm install
cp config.example.yaml config.yaml   # edit with your API key
npm run dev
```

Notes:
- gVisor (`runsc`) is Linux-only — on macOS/Windows, sandboxes use standard Docker isolation (`runc`), which is fine for local use
- Sandbox containers have network disabled by default (`networkEnabled: false`)
- SQLite database is a single file (`./botreef.db`), no setup needed
- All messaging adapters (Telegram, Slack, etc.) are disabled by default — only REST, Web UI, and SSH start

## Development

```bash
npm run dev        # Start in dev mode with hot reload
npm test           # Run tests
npm run lint       # Lint
```

## License

[MIT](LICENSE)
