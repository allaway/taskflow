/**
 * MCP HTTP endpoint — implements the MCP streamable-HTTP transport (JSON-RPC 2.0).
 * Claude Code connects to this URL with:
 *   { "type": "http", "url": "https://…/api/mcp", "headers": { "Authorization": "Bearer tf_…" } }
 */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/tokens";
import { getOrigin } from "@/lib/request-origin";

// ── Auth ──────────────────────────────────────────────────────────────────────

async function getUserId(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get("authorization") ?? "";
  const raw = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!raw) return null;
  const hash = hashToken(raw);
  const record = await prisma.apiToken.findUnique({
    where: { tokenHash: hash },
    select: { userId: true },
  });
  if (!record) return null;
  prisma.apiToken
    .update({ where: { tokenHash: hash }, data: { lastUsedAt: new Date() } })
    .catch(() => {});
  return record.userId;
}

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "list_tasks",
    description: "List tasks from TaskFlow. Filter by status, date, or source.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["INBOX", "SCHEDULED", "COMPLETED", "CANCELLED"] },
        date: { type: "string", description: "YYYY-MM-DD" },
        source: { type: "string", enum: ["MANUAL", "API", "RECURRING"] },
      },
    },
  },
  {
    name: "get_task",
    description: "Get full details of a specific task by ID.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "create_task",
    description: "Create a new task in TaskFlow.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        notes: { type: "string" },
        priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
        scheduledDate: { type: "string", description: "ISO 8601 datetime" },
        startTime: { type: "string", description: "HH:MM" },
        duration: { type: "number", description: "minutes" },
      },
      required: ["title"],
    },
  },
  {
    name: "update_task",
    description: "Update an existing task — status, priority, notes, schedule, etc.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        notes: { type: "string" },
        status: { type: "string", enum: ["INBOX", "SCHEDULED", "COMPLETED", "CANCELLED"] },
        priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
        scheduledDate: { type: "string" },
        startTime: { type: "string" },
        duration: { type: "number" },
        agentQueued: { type: "boolean", description: "Whether the task is queued for an AI agent" },
      },
      required: ["id"],
    },
  },
  {
    name: "complete_task",
    description: "Mark a task as completed.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "delete_task",
    description: "Delete a task permanently.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "get_agent_tasks",
    description: "Get tasks that have been queued for an AI agent to work on. Call this to find tasks assigned to you.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "claim_agent_task",
    description: "Claim a queued agent task so you can work on it. This dequeues the task so other agents won't also pick it up.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Task ID to claim" } },
      required: ["id"],
    },
  },
];

// ── Tool execution ────────────────────────────────────────────────────────────

function assertNotPast(dateStr: unknown, field = "scheduledDate") {
  if (!dateStr) return;
  const d = new Date(String(dateStr));
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (d < today) throw new Error(`${field} cannot be in the past`);
}

async function callTool(
  name: string,
  args: Record<string, unknown>,
  userId: string
): Promise<unknown> {
  if (name === "list_tasks") {
    const where: Record<string, unknown> = { userId };
    if (args.status) where.status = args.status;
    if (args.source) where.source = args.source;
    if (args.date) {
      const dayStart = new Date(String(args.date) + "T00:00:00.000Z");
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      where.scheduledDate = { gte: dayStart, lt: dayEnd };
    }
    return prisma.task.findMany({ where, orderBy: [{ priority: "desc" }, { createdAt: "asc" }] });
  }

  if (name === "get_task") {
    const task = await prisma.task.findFirst({ where: { id: String(args.id), userId } });
    if (!task) throw new Error("Task not found");
    return task;
  }

  if (name === "create_task") {
    if (!args.title) throw new Error("title is required");
    assertNotPast(args.scheduledDate);
    return prisma.task.create({
      data: {
        title: String(args.title),
        description: args.description ? String(args.description) : undefined,
        notes: args.notes ? String(args.notes) : undefined,
        priority: (args.priority as "LOW" | "MEDIUM" | "HIGH") ?? "MEDIUM",
        scheduledDate: args.scheduledDate ? new Date(String(args.scheduledDate)) : undefined,
        startTime: args.startTime ? String(args.startTime) : undefined,
        duration: args.duration ? Number(args.duration) : undefined,
        status: args.scheduledDate ? "SCHEDULED" : "INBOX",
        source: "API",
        userId,
      },
    });
  }

  if (name === "update_task") {
    const existing = await prisma.task.findFirst({ where: { id: String(args.id), userId } });
    if (!existing) throw new Error("Task not found");
    assertNotPast(args.scheduledDate);
    // Explicit allowlist — never let callers overwrite userId, source, completedAt, etc.
    const data: Record<string, unknown> = {};
    if (args.title !== undefined) data.title = String(args.title);
    if (args.description !== undefined) data.description = args.description ? String(args.description) : null;
    if (args.notes !== undefined) data.notes = args.notes ? String(args.notes) : null;
    if (args.priority !== undefined) data.priority = args.priority;
    if (args.status !== undefined) data.status = args.status;
    if (args.startTime !== undefined) data.startTime = args.startTime ? String(args.startTime) : null;
    if (args.duration !== undefined) data.duration = args.duration ? Number(args.duration) : null;
    if (args.agentQueued !== undefined) data.agentQueued = Boolean(args.agentQueued);
    if ("scheduledDate" in args) {
      data.scheduledDate = args.scheduledDate ? new Date(String(args.scheduledDate)) : null;
    }
    return prisma.task.update({ where: { id: String(args.id) }, data });
  }

  if (name === "complete_task") {
    const existing = await prisma.task.findFirst({ where: { id: String(args.id), userId } });
    if (!existing) throw new Error("Task not found");
    return prisma.task.update({
      where: { id: String(args.id) },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  }

  if (name === "delete_task") {
    const existing = await prisma.task.findFirst({ where: { id: String(args.id), userId } });
    if (!existing) throw new Error("Task not found");
    await prisma.task.delete({ where: { id: String(args.id) } });
    return { success: true };
  }

  if (name === "get_agent_tasks") {
    return prisma.task.findMany({
      where: { userId, agentQueued: true },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });
  }

  if (name === "claim_agent_task") {
    const existing = await prisma.task.findFirst({ where: { id: String(args.id), userId } });
    if (!existing) throw new Error("Task not found");
    if (!existing.agentQueued) throw new Error("Task is not queued for an agent");
    return prisma.task.update({
      where: { id: String(args.id) },
      data: { agentQueued: false },
    });
  }

  throw new Error(`Unknown tool: ${name}`);
}

// ── JSON-RPC handler ──────────────────────────────────────────────────────────

type RpcMessage = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

async function handleMessage(msg: RpcMessage, userId: string) {
  const { id, method, params = {} } = msg;
  const isNotification = id === undefined;

  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "taskflow", version: "1.0.0" },
      },
    };
  }

  if (method === "notifications/initialized" || isNotification) {
    return null; // notifications get no response
  }

  if (method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
  }

  if (method === "tools/call") {
    const toolName = params.name as string;
    const toolArgs = (params.arguments ?? {}) as Record<string, unknown>;
    try {
      const result = await callTool(toolName, toolArgs, userId);
      return {
        jsonrpc: "2.0",
        id,
        result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] },
      };
    } catch (err) {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        },
      };
    }
  }

  // Unknown method
  return {
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  };
}

// ── Route handlers ────────────────────────────────────────────────────────────

function unauthorized(req: NextRequest) {
  const origin = getOrigin(req);
  return NextResponse.json(
    { error: "Unauthorized" },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
      },
    }
  );
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized(req);

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Support both single messages and batches
  if (Array.isArray(body)) {
    const responses = await Promise.all(
      body.map((msg: RpcMessage) => handleMessage(msg, userId))
    );
    const filtered = responses.filter(Boolean);
    if (filtered.length === 0) return new NextResponse(null, { status: 202 });
    return NextResponse.json(filtered);
  }

  const response = await handleMessage(body as RpcMessage, userId);
  if (response === null) return new NextResponse(null, { status: 202 });
  return NextResponse.json(response);
}

// GET is required by the streamable HTTP spec (even if we don't support SSE streaming)
export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized(req);
  return NextResponse.json({ error: "SSE streaming not supported; use POST" }, { status: 405 });
}
