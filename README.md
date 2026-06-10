# TaskFlow

A personal task manager with first-class AI agent delegation. Plan your day on a timeline, keep an inbox, and hand tasks to AI agents — with every agent run tracked through a session state machine, a typed activity thread, and a human review gate before anything is marked done.

## Features

### Task management
- **Today / Week** — drag-and-drop timeline planning with Google Calendar overlay and a daily work budget
- **Inbox** — capture with filters, multi-select bulk actions (schedule, complete, delete, delegate to AI)
- **Board** — kanban view (Inbox → Scheduled → Needs review → Done), drag between columns
- **Projects** — group tasks, filter the board per project
- **Subtasks** (one level), **comments**, **labels**, **recurring tasks**
- **Review** — weekly retrospective with bulk defer
- **Import/export** — JSON and CSV

### AI agent delegation
Modeled on the strongest patterns from Linear, GitHub Copilot coding agent, Jira Rovo, and Asana:

- **Agents are delegates, you keep ownership.** Delegated tasks stay in your views with a live status badge.
- **Session state machine** — `PENDING → ACTIVE → AWAITING_INPUT / NEEDS_REVIEW → COMPLETE / ERROR / STALE` (stale after 30 min of silence).
- **Typed activity thread** — thoughts, actions, questions, answers, results, and errors are persisted per session and shown on the task.
- **Human review gate** — agents never complete tasks. They `submit_result`; the task moves to *Needs review*; you accept (completes the task) or send it back with feedback.
- **Elicitation** — agents can ask a blocking question; it surfaces in the **Agents** page and on the task until you answer.
- **Watch live** — Claude Code sessions store their live session URL on the task.
- Three agent backends:
  1. **In-app agent** — server-side agentic loop streaming over SSE (Anthropic API)
  2. **Claude Code Routines** — fire a routine with task context; it reports back over MCP
  3. **Any MCP client** — queue tasks for pickup via the built-in MCP server

### Issue tracker resolution sync
Link a GitHub issue/PR or Jira issue to a task (paste the URL, or pass `link` in the webhook payload). When the task is completed — manually, in bulk, via MCP, or by accepting agent work — TaskFlow closes the GitHub issue / transitions the Jira issue to Done. Configure credentials in **Settings → Issues** (stored AES-256-GCM encrypted). Sync failures never block completion; they're recorded on the link and surfaced in the UI.

### MCP server
`/api/mcp` (streamable HTTP, OAuth + PKCE or bearer API tokens) exposes:

`list_tasks · get_task · create_task · update_task · complete_task · delete_task · get_agent_tasks · claim_agent_task · add_activity · request_input · get_session · submit_result · report_error`

`claim_agent_task` opens an agent session and returns its `sessionId`; `complete_task`/`update_task` refuse to complete a task with a live agent session — work must flow through `submit_result` and human review.

## Stack

Next.js 16 (App Router) · React 19 · Prisma + PostgreSQL · NextAuth v5 · Tailwind 4 + shadcn/ui · Anthropic SDK · Vitest + Playwright

## Getting started

```bash
cp .env.example .env   # fill in DATABASE_URL, NEXTAUTH_SECRET, FIELD_ENCRYPTION_KEY
npm install
npx prisma migrate dev
npm run dev
```

Environment variables are validated at startup (`lib/env.ts`) — the server fails fast with a list of anything missing or malformed.

## Operations

- **Health check:** `GET /api/health` returns `{status, db}` (503 when the database is unreachable) — point your deploy platform's probe at it.
- **Logging:** API routes emit structured JSON logs with request IDs (`lib/logger.ts`).
- **Rate limiting:** in-memory per-user/per-IP limits (`lib/rateLimit.ts`); swap in a Redis-backed store when running multiple instances.
- **API tokens:** optional expiry (`expiresInDays` on creation); expired tokens are rejected by MCP and webhook auth.
- **Pagination:** `GET /api/tasks` supports `limit` + `cursor`; the next cursor is returned in the `X-Next-Cursor` header.

## Testing

```bash
npm test          # unit (Vitest)
npm run test:e2e  # end-to-end (Playwright, needs Postgres)
npm run test:all  # type-check + lint + unit + e2e
```

See [DEPLOY.md](./DEPLOY.md) for Railway / AWS deployment guides.
