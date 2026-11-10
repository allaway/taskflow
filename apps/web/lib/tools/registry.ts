/**
 * The tool registry: everything an AI can do in TaskFlow, defined once.
 *
 * The MCP endpoint (/api/mcp) serves this list to external tools such as
 * Claude Code, and the in-app assistant runs the same list through the agent
 * loop — so whatever you can do from one, you can do from the other.
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import { projectDay } from "@/lib/projection";
import {
  ServiceError,
  createTask,
  dayRange,
  deleteTask,
  getTask,
  listTasks,
  updateTask,
} from "@/lib/services/tasks";
import {
  createAgentThread,
  getThread,
  listThreads,
  postAgentUpdate,
} from "@/lib/services/threads";
import { ingestCatchUp, listCatchUp, triageCatchUp } from "@/lib/services/catchup";
import { getDayPlan, saveDayPlan, toLocalHHMM } from "@/lib/services/planner";

export interface ToolContext {
  userId: string;
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run(ctx: ToolContext, rawArgs: unknown): Promise<unknown>;
}

export function defineTool<S extends z.ZodType>(
  name: string,
  description: string,
  schema: S,
  handler: (ctx: ToolContext, args: z.infer<S>) => Promise<unknown>
): Tool {
  const inputSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  delete inputSchema.$schema;
  return {
    name,
    description,
    inputSchema,
    async run(ctx, rawArgs) {
      const parsed = schema.safeParse(rawArgs ?? {});
      if (!parsed.success) {
        throw new ServiceError(`Invalid arguments: ${z.prettifyError(parsed.error)}`);
      }
      return handler(ctx, parsed.data);
    },
  };
}

const status = z.enum(["INBOX", "SCHEDULED", "COMPLETED", "CANCELLED"]);
const priority = z.enum(["LOW", "MEDIUM", "HIGH"]);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "must be HH:MM (24h)");
const duration = z.number().int().min(5).max(480);
const threadStatus = z.enum(["ACTIVE", "WAITING", "DONE"]);
const id = z.string().min(1);

const scheduledDate = z
  .string()
  .describe("YYYY-MM-DD (preferred) or an ISO 8601 datetime");
const parallel = z
  .boolean()
  .describe(
    "True if the task is worked on alongside other tasks (e.g. while an agent runs). Parallel tasks with overlapping times share one block of the day."
  );

export const TOOLS: Tool[] = [
  // ── Tasks ───────────────────────────────────────────────────────────────────
  defineTool(
    "list_tasks",
    "List tasks. Filter by status, scheduled date, source, or a text search over title, description and notes.",
    z.object({
      status: status.optional(),
      date: day.optional().describe("Scheduled date, YYYY-MM-DD"),
      source: z.enum(["MANUAL", "API", "RECURRING"]).optional(),
      q: z.string().optional().describe("Case-insensitive text search"),
    }),
    (ctx, args) => listTasks(ctx.userId, args)
  ),
  defineTool("get_task", "Get full details of one task, including its agent threads.", z.object({ id }), async (ctx, args) => {
    const task = await getTask(ctx.userId, args.id);
    const threads = await listThreads(ctx.userId, { taskId: task.id });
    return {
      ...task,
      threads: threads.map((t) => ({
        id: t.id, title: t.title, provider: t.provider, status: t.status, url: t.url, summary: t.summary,
      })),
    };
  }),
  defineTool(
    "create_task",
    "Create a task. With a scheduledDate it goes on that day; without one it goes to the inbox.",
    z.object({
      title: z.string().min(1).max(500),
      description: z.string().max(5000).optional(),
      notes: z.string().max(10000).optional(),
      priority: priority.optional(),
      scheduledDate: scheduledDate.optional(),
      startTime: time.optional(),
      duration: duration.optional().describe("Estimate in minutes"),
      parallel: parallel.optional(),
    }),
    (ctx, args) => createTask(ctx.userId, args, "API", { rejectPast: true })
  ),
  defineTool(
    "update_task",
    "Update a task: title, notes, status, priority, schedule, estimate, or whether it runs in parallel. To schedule a task set scheduledDate and status SCHEDULED; to send it back to the inbox set status INBOX and scheduledDate null.",
    z.object({
      id,
      title: z.string().min(1).max(500).optional(),
      description: z.string().max(5000).nullable().optional(),
      notes: z.string().max(10000).nullable().optional(),
      status: status.optional(),
      priority: priority.optional(),
      scheduledDate: scheduledDate.nullable().optional(),
      startTime: time.nullable().optional(),
      duration: duration.nullable().optional(),
      parallel: parallel.optional(),
      agentQueued: z.boolean().optional().describe("Whether the task is queued for an AI agent"),
    }),
    (ctx, { id: taskId, ...patch }) => {
      // An empty string has always meant "clear" for callers of this tool.
      if (patch.scheduledDate === "") patch.scheduledDate = null;
      if (patch.scheduledDate === null && patch.startTime === undefined) patch.startTime = null;
      return updateTask(ctx.userId, taskId, patch, { rejectPast: true });
    }
  ),
  defineTool("complete_task", "Mark a task as completed.", z.object({ id }), (ctx, args) =>
    updateTask(ctx.userId, args.id, { status: "COMPLETED", agentQueued: false })
  ),
  defineTool("delete_task", "Delete a task permanently.", z.object({ id }), async (ctx, args) => {
    await deleteTask(ctx.userId, args.id);
    return { success: true };
  }),

  // ── The day ─────────────────────────────────────────────────────────────────
  defineTool(
    "get_day",
    "Everything about one day: the stated intent, tasks on the day, calendar events, and how much wall-clock time the plan takes once parallel work is clustered. Call this before changing a day's plan.",
    z.object({
      date: day,
      timezone: z.string().optional().describe("IANA timezone for calendar event times; defaults to UTC"),
    }),
    async (ctx, args) => {
      const range = dayRange(args.date);
      const [plan, tasks, events, user] = await Promise.all([
        getDayPlan(ctx.userId, args.date),
        listTasks(ctx.userId, { date: args.date }),
        prisma.cachedCalendarEvent.findMany({
          where: { userId: ctx.userId, start: { lt: range.lt }, end: { gt: range.gte } },
          orderBy: { start: "asc" },
        }),
        prisma.user.findUnique({ where: { id: ctx.userId }, select: { dailyBudgetHours: true } }),
      ]);
      const open = tasks.filter((t) => t.status === "SCHEDULED");
      const projection = projectDay(open);
      const tz = args.timezone ?? "UTC";
      return {
        date: args.date,
        intent: plan?.intent ?? null,
        planSummary: plan?.summary ?? null,
        budgetMinutes: (user?.dailyBudgetHours ?? 8) * 60,
        plannedWallClockMinutes: projection.wallMinutes,
        plannedEffortMinutes: projection.effortMinutes,
        tasks: tasks.map((t) => ({
          id: t.id, title: t.title, status: t.status, priority: t.priority,
          startTime: t.startTime, duration: t.duration, parallel: t.parallel,
        })),
        events: events.map((e) => ({
          title: e.title,
          allDay: e.allDay,
          start: e.allDay ? null : toLocalHHMM(e.start, tz),
          end: e.allDay ? null : toLocalHHMM(e.end, tz),
        })),
      };
    }
  ),
  defineTool(
    "set_day_intent",
    "Record what the user says matters for a given day. Shown at the top of their day and used by planning.",
    z.object({ date: day, intent: z.string().max(2000) }),
    (ctx, args) => saveDayPlan(ctx.userId, args.date, { intent: args.intent })
  ),

  // ── Agent delegation ────────────────────────────────────────────────────────
  defineTool(
    "get_agent_tasks",
    "Get tasks that have been queued for an AI agent to work on. Call this to find tasks assigned to you.",
    z.object({}),
    (ctx) => listTasks(ctx.userId, { agentQueued: true })
  ),
  defineTool(
    "claim_agent_task",
    "Claim a queued agent task so other agents won't also pick it up. Opens a thread under the task and returns its threadId; report progress there with post_thread_update.",
    z.object({
      id: id.describe("Task ID to claim"),
      provider: z.string().max(40).optional().describe('Where you are running, e.g. "claude-code", "codex", "gemini"'),
      url: z.string().url().optional().describe("Link the user can open to reach this session"),
    }),
    async (ctx, args) => {
      const task = await getTask(ctx.userId, args.id);
      if (!task.agentQueued) throw new ServiceError("Task is not queued for an agent");
      const updated = await updateTask(ctx.userId, task.id, { agentQueued: false });
      const thread = await createAgentThread(ctx.userId, {
        taskId: task.id,
        provider: args.provider ?? "other",
        url: args.url,
      });
      return { ...updated, threadId: thread.id };
    }
  ),
  defineTool(
    "list_threads",
    "List agent threads: delegated work in progress, grouped under tasks. Filter by task or status (ACTIVE = agent working, WAITING = needs the user, DONE).",
    z.object({ taskId: id.optional(), status: threadStatus.optional() }),
    async (ctx, args) =>
      (await listThreads(ctx.userId, args)).map((t) => ({
        id: t.id, title: t.title, provider: t.provider, status: t.status, url: t.url,
        summary: t.summary, taskId: t.taskId, taskTitle: t.task?.title ?? null,
        lastActivityAt: t.lastActivityAt, messageCount: t._count.messages,
      }))
  ),
  defineTool(
    "get_thread",
    "Read a thread's messages, including any replies the user has written to you from TaskFlow.",
    z.object({ id }),
    async (ctx, args) => {
      const t = await getThread(ctx.userId, args.id);
      return {
        id: t.id, title: t.title, provider: t.provider, status: t.status, url: t.url, summary: t.summary,
        task: t.task,
        messages: t.messages.slice(-50).map((m) => ({ role: m.role, content: m.content, at: m.createdAt })),
      };
    }
  ),
  defineTool(
    "link_thread",
    "Attach a thread of work in another tool (a Claude, Codex or Gemini conversation, a Claude Code session…) to a task, so it shows up under that task.",
    z.object({
      taskId: id,
      title: z.string().max(300).optional(),
      provider: z.string().max(40).describe('e.g. "claude", "claude-code", "codex", "gemini"'),
      url: z.string().url().optional(),
    }),
    (ctx, args) => createAgentThread(ctx.userId, args)
  ),
  defineTool(
    "post_thread_update",
    "Report progress into an agent thread. Set status WAITING when you are blocked on the user (say exactly what you need) or DONE when the work is finished; both notify the user in Catch-up.",
    z.object({
      threadId: id,
      content: z.string().min(1).max(20000).describe("Markdown update"),
      status: threadStatus.optional(),
      summary: z.string().max(500).optional().describe("One line on where the work stands"),
    }),
    (ctx, { threadId, ...update }) => postAgentUpdate(ctx.userId, threadId, update)
  ),

  // ── Catch-up ────────────────────────────────────────────────────────────────
  defineTool(
    "list_catchup",
    "List the user's catch-up inbox: things that happened in other tools and still need triage, most relevant first.",
    z.object({ status: z.enum(["NEW", "TASKED", "ARCHIVED"]).optional() }),
    (ctx, args) => listCatchUp(ctx.userId, args.status ?? "NEW")
  ),
  defineTool(
    "add_catchup_item",
    "Add something to the user's catch-up inbox for them to triage later (an email worth a look, a mention, a finished job). Use create_task instead if it is already clearly a task.",
    z.object({
      source: z.string().min(1).max(50).describe('Where it came from, e.g. "email", "slack", "github"'),
      title: z.string().min(1).max(500),
      body: z.string().max(20000).optional(),
      url: z.string().url().optional(),
      author: z.string().max(200).optional(),
      externalId: z.string().max(255).optional().describe("Stable id for deduplication"),
    }),
    async (ctx, args) => (await ingestCatchUp(ctx.userId, [args]))[0]
  ),
  defineTool(
    "triage_catchup_item",
    'Triage a catch-up item: "task" turns it into an inbox task, "archive" dismisses it, "restore" brings it back.',
    z.object({ id, action: z.enum(["task", "archive", "restore"]) }),
    (ctx, args) => triageCatchUp(ctx.userId, args.id, args.action)
  ),
];

/**
 * Tools the in-app assistant does not get. It reads content written by other
 * people (catch-up items, thread messages, task notes), so anything it does
 * must be undoable: it can cancel a task but not permanently delete one.
 * External MCP clients keep the full list and apply their own approval prompts.
 */
const ASSISTANT_EXCLUDED = new Set(["delete_task"]);
export const ASSISTANT_TOOLS: Tool[] = TOOLS.filter((t) => !ASSISTANT_EXCLUDED.has(t.name));

export async function callTool(name: string, args: unknown, ctx: ToolContext): Promise<unknown> {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) throw new ServiceError(`Unknown tool: ${name}`, 404);
  return tool.run(ctx, args);
}

/**
 * The narrow tool set for an agent delegated a single task in-app: it can write
 * up its work, spin off follow-ups, and finish — nothing else.
 */
export function taskAgentTools(taskId: string): Tool[] {
  return [
    defineTool(
      "write_notes",
      "Write your work into the task's notes: findings, drafts, results, plans. Appends by default. Call it as you go on long tasks.",
      z.object({
        content: z.string().min(1).max(10000).describe("Markdown"),
        replace: z.boolean().optional().describe("Replace the existing notes instead of appending"),
      }),
      async (ctx, args) => {
        const task = await getTask(ctx.userId, taskId);
        const notes = args.replace || !task.notes ? args.content : `${task.notes}\n\n${args.content}`;
        await updateTask(ctx.userId, taskId, { notes: notes.slice(0, 10000) });
        return "Notes updated";
      }
    ),
    defineTool(
      "create_subtask",
      "Create a follow-up task in the user's inbox.",
      z.object({
        title: z.string().min(1).max(500),
        description: z.string().max(5000).optional(),
        priority: priority.optional(),
      }),
      async (ctx, args) => {
        const task = await createTask(ctx.userId, args, "API");
        return `Created "${task.title}"`;
      }
    ),
    defineTool(
      "complete_task",
      "Mark the task as completed once the work is genuinely done.",
      z.object({ summary: z.string().min(1).max(2000).describe("What was accomplished") }),
      async (ctx, args) => {
        const task = await getTask(ctx.userId, taskId);
        const note = `---\n*Completed by AI agent.*\n\n${args.summary}`;
        await updateTask(ctx.userId, taskId, {
          notes: (task.notes ? `${task.notes}\n\n${note}` : note).slice(0, 10000),
          status: "COMPLETED",
        });
        return "Task marked as completed";
      }
    ),
  ];
}
