/**
 * POST /api/tasks/[id]/run-agent
 *
 * Starts an agentic loop that works on the task using the user's configured
 * AI provider. Streams Server-Sent Events (SSE) back to the client with
 * live output. The agent can write notes back to the task and mark it done.
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolveAiConfig } from "@/lib/ai";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 120; // 2 min Railway max

const MAX_ITERATIONS = 12;

// ── SSE helpers ───────────────────────────────────────────────────────────────

type AgentEvent =
  | { type: "start" }
  | { type: "text"; text: string }
  | { type: "tool_call"; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; name: string; result: string }
  | { type: "done"; taskId: string }
  | { type: "error"; message: string };

function encodeEvent(event: AgentEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

// ── Agent tools ───────────────────────────────────────────────────────────────

const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: "write_notes",
    description:
      "Write or append content to the task notes. Use this to record your work, findings, results, or implementation plans. Call this multiple times to show progress.",
    input_schema: {
      type: "object" as const,
      properties: {
        content: {
          type: "string",
          description: "Markdown content to append to the task notes",
        },
        replace: {
          type: "boolean",
          description: "If true, replace existing notes entirely. Default: append.",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "complete_task",
    description: "Mark the task as completed once the work is done.",
    input_schema: {
      type: "object" as const,
      properties: {
        summary: {
          type: "string",
          description: "A brief summary of what was accomplished",
        },
      },
      required: ["summary"],
    },
  },
  {
    name: "create_subtask",
    description: "Create a subtask or follow-up task in the task manager.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
      },
      required: ["title"],
    },
  },
];

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const limited = await rateLimit(getClientIp(req), "api");
  if (limited) return limited;

  const { id: taskId } = await params;

  const task = await prisma.task.findFirst({
    where: { id: taskId, userId: session.user.id },
  });
  if (!task) return new Response("Not found", { status: 404 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { aiProvider: true, aiApiKey: true, aiModel: true, aiSchedulingModel: true },
  });
  if (!user) return new Response("User not found", { status: 404 });

  let config;
  try {
    config = resolveAiConfig(user);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "AI not configured";
    return new Response(msg, { status: 422 });
  }

  if (config.provider !== "anthropic") {
    return new Response(
      "Agent delegation requires an Anthropic API key (OpenRouter not yet supported)",
      { status: 422 }
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: AgentEvent) => {
        try {
          controller.enqueue(encodeEvent(event));
        } catch {
          // client disconnected
        }
      };

      try {
        send({ type: "start" });

        const client = new Anthropic({ apiKey: config.apiKey });

        const systemPrompt = `You are a capable AI assistant that has been delegated a task to work on autonomously.

Your job:
1. Read the task carefully
2. Do the actual work — research, plan, write, analyse, or implement as appropriate
3. Use write_notes to record your work, progress, and results (call it multiple times for long tasks)
4. Use create_subtask if the task naturally breaks into follow-up items
5. Use complete_task when you are finished

Be thorough and produce real, useful output — not placeholders or summaries of what you would do.
Write your results directly in the notes using clear Markdown formatting.`;

        const taskContext = [
          `# Task: ${task.title}`,
          `Priority: ${task.priority}`,
          task.description ? `\n## Description\n${task.description}` : "",
          task.notes ? `\n## Existing Notes\n${task.notes}` : "",
        ]
          .filter(Boolean)
          .join("\n");

        type MessageParam = Anthropic.MessageParam;
        const messages: MessageParam[] = [
          {
            role: "user",
            content: `Please work on the following task:\n\n${taskContext}\n\nGet started and show me your work.`,
          },
        ];

        let currentNotes = task.notes ?? "";

        for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
          const response = await client.messages.create({
            model: config.model,
            max_tokens: 4096,
            system: systemPrompt,
            tools: AGENT_TOOLS,
            messages,
          });

          // Stream text content
          for (const block of response.content) {
            if (block.type === "text" && block.text.trim()) {
              send({ type: "text", text: block.text });
            }
          }

          // No tool use → agent is done thinking
          const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");
          if (toolUseBlocks.length === 0) break;

          // Add assistant turn
          messages.push({ role: "assistant", content: response.content });

          // Process each tool call
          const toolResults: Anthropic.ToolResultBlockParam[] = [];

          for (const block of toolUseBlocks) {
            if (block.type !== "tool_use") continue;

            const input = block.input as Record<string, unknown>;
            send({ type: "tool_call", name: block.name, input });

            let result = "OK";

            if (block.name === "write_notes") {
              const content = String(input.content ?? "");
              const replace = Boolean(input.replace);
              if (replace) {
                currentNotes = content;
              } else {
                currentNotes = currentNotes
                  ? `${currentNotes}\n\n${content}`
                  : content;
              }
              await prisma.task.update({
                where: { id: taskId },
                data: { notes: currentNotes },
              });
              result = "Notes updated successfully";
            }

            if (block.name === "complete_task") {
              const summary = String(input.summary ?? "Task completed");
              const completionNote = `\n\n---\n*Task completed by AI agent.*\n\n${summary}`;
              currentNotes = currentNotes
                ? `${currentNotes}${completionNote}`
                : completionNote;
              await prisma.task.update({
                where: { id: taskId },
                data: {
                  notes: currentNotes,
                  status: "COMPLETED",
                  completedAt: new Date(),
                  agentQueued: false,
                },
              });
              result = "Task marked as completed";
              send({ type: "tool_result", name: block.name, result });
              send({ type: "done", taskId });
              controller.close();
              return;
            }

            if (block.name === "create_subtask") {
              const subtaskTitle = String(input.title ?? "Subtask");
              const userId = session!.user!.id!;
              await prisma.task.create({
                data: {
                  title: subtaskTitle,
                  description: input.description ? String(input.description) : null,
                  priority: (input.priority as "LOW" | "MEDIUM" | "HIGH") ?? "MEDIUM",
                  status: "INBOX",
                  source: "API",
                  userId,
                },
              });
              result = `Subtask "${subtaskTitle}" created`;
            }

            send({ type: "tool_result", name: block.name, result });
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: result,
            });
          }

          // Add tool results back into messages
          messages.push({ role: "user", content: toolResults });

          if (response.stop_reason === "end_turn") break;
        }

        // Mark agent as no longer queued even if it didn't call complete_task
        await prisma.task.update({
          where: { id: taskId },
          data: { agentQueued: false },
        });

        send({ type: "done", taskId });
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Error ? err.message : "Agent failed",
        });
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable nginx buffering on Railway
    },
  });
}
