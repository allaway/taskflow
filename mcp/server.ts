import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API_URL = (process.env.TASKFLOW_API_URL ?? "").replace(/\/$/, "");
const TOKEN = process.env.TASKFLOW_TOKEN ?? "";

if (!API_URL || !TOKEN) {
  process.stderr.write("ERROR: TASKFLOW_API_URL and TASKFLOW_TOKEN env vars are required\n");
  process.exit(1);
}

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

const server = new Server(
  { name: "taskflow", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_tasks",
      description: "List tasks from TaskFlow. Filter by status, date, or source.",
      inputSchema: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["INBOX", "SCHEDULED", "COMPLETED", "CANCELLED"],
            description: "Filter by task status",
          },
          date: {
            type: "string",
            description: "Filter by scheduled date (YYYY-MM-DD)",
          },
          source: {
            type: "string",
            enum: ["MANUAL", "API", "RECURRING"],
            description: "Filter by task source",
          },
        },
      },
    },
    {
      name: "get_task",
      description: "Get full details of a specific task by ID.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Task ID" },
        },
        required: ["id"],
      },
    },
    {
      name: "create_task",
      description: "Create a new task in TaskFlow.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Task title (required)" },
          description: { type: "string", description: "Markdown description" },
          notes: { type: "string", description: "Additional notes" },
          priority: {
            type: "string",
            enum: ["LOW", "MEDIUM", "HIGH"],
            description: "Task priority (default MEDIUM)",
          },
          scheduledDate: {
            type: "string",
            description: "ISO 8601 datetime to schedule the task",
          },
          startTime: { type: "string", description: "Start time HH:MM" },
          duration: { type: "number", description: "Duration in minutes" },
        },
        required: ["title"],
      },
    },
    {
      name: "update_task",
      description: "Update an existing task — change status, priority, notes, schedule, etc.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Task ID" },
          title: { type: "string" },
          description: { type: "string" },
          notes: { type: "string" },
          status: {
            type: "string",
            enum: ["INBOX", "SCHEDULED", "COMPLETED", "CANCELLED"],
          },
          priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
          scheduledDate: { type: "string", description: "ISO 8601 datetime, or null to unschedule" },
          startTime: { type: "string" },
          duration: { type: "number" },
        },
        required: ["id"],
      },
    },
    {
      name: "complete_task",
      description: "Mark a task as completed.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Task ID" },
        },
        required: ["id"],
      },
    },
    {
      name: "delete_task",
      description: "Delete a task permanently.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Task ID" },
        },
        required: ["id"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    let result: unknown;

    if (name === "list_tasks") {
      const params = new URLSearchParams();
      if (args.status) params.set("status", String(args.status));
      if (args.date) params.set("date", String(args.date));
      if (args.source) params.set("source", String(args.source));
      const query = params.toString() ? `?${params}` : "";
      result = await api("GET", `/api/tasks${query}`);

    } else if (name === "get_task") {
      result = await api("GET", `/api/tasks/${args.id}`);

    } else if (name === "create_task") {
      result = await api("POST", "/api/tasks", args);

    } else if (name === "update_task") {
      const { id, ...updates } = args as { id: string; [k: string]: unknown };
      result = await api("PATCH", `/api/tasks/${id}`, updates);

    } else if (name === "complete_task") {
      result = await api("PATCH", `/api/tasks/${args.id}`, { status: "COMPLETED" });

    } else if (name === "delete_task") {
      await api("DELETE", `/api/tasks/${args.id}`);
      result = { success: true };

    } else {
      throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
