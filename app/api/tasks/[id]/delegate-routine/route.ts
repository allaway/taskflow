/**
 * POST /api/tasks/[id]/delegate-routine
 *
 * Fires the user's configured Claude Code Routine with the task as context.
 * The routine is expected to use the TaskFlow MCP tools to read and update the task.
 *
 * Returns: { sessionUrl } — the claude.ai session URL to open live.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { rateLimit } from "@/lib/rateLimit";
import { createAgentSession } from "@/lib/agentSessions";

const ROUTINE_FIRE_URL = "https://api.anthropic.com/v1/claude_code/routines";
const ANTHROPIC_BETA = "experimental-cc-routine-2026-04-01";
const ANTHROPIC_VERSION = "2023-06-01";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`user:${session.user.id}`, "api");
  if (limited) return limited;

  const { id: taskId } = await params;

  const [task, user] = await Promise.all([
    prisma.task.findFirst({ where: { id: taskId, userId: session.user.id } }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { claudeCodeRoutineId: true, claudeCodeRoutineToken: true },
    }),
  ]);

  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  if (!user?.claudeCodeRoutineId || !user?.claudeCodeRoutineToken) {
    return NextResponse.json({ error: "No Claude Code Routine configured" }, { status: 422 });
  }

  let token: string;
  try {
    token = decrypt(user.claudeCodeRoutineToken);
  } catch {
    return NextResponse.json({ error: "Failed to decrypt routine token" }, { status: 500 });
  }

  // Create the agent session up front so the routine can report into it
  // via the MCP tools (add_activity, request_input, submit_result).
  const agentSession = await createAgentSession({
    taskId: task.id,
    userId: session.user.id,
    agentType: "claude-code",
    agentName: user.claudeCodeRoutineId,
    status: "PENDING",
  });

  // Build the context payload — passed as `text` to the routine
  const taskContext = JSON.stringify({
    taskId: task.id,
    agentSessionId: agentSession.id,
    title: task.title,
    priority: task.priority,
    description: task.description ?? null,
    notes: task.notes ?? null,
    mcpUrl: `${process.env.NEXTAUTH_URL ?? "https://taskflow-production-585d.up.railway.app"}/api/mcp`,
    instructions:
      "Use the TaskFlow MCP tools to report progress: add_activity for actions, request_input if blocked, and submit_result when done. Do not complete the task directly — it must go through human review.",
  });

  const routineUrl = `${ROUTINE_FIRE_URL}/${user.claudeCodeRoutineId}/fire`;

  let routineRes: Response;
  try {
    routineRes = await fetch(routineUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "anthropic-beta": ANTHROPIC_BETA,
        "anthropic-version": ANTHROPIC_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: taskContext }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    await prisma.agentSession.update({
      where: { id: agentSession.id },
      data: { status: "ERROR", error: `Failed to reach Claude: ${msg}`, endedAt: new Date() },
    });
    return NextResponse.json({ error: `Failed to reach Claude: ${msg}` }, { status: 502 });
  }

  if (!routineRes.ok) {
    // Do not forward the raw upstream body — it may contain internal API details
    const status = routineRes.status;
    const msg = status === 401 ? "Invalid routine token" :
                status === 404 ? "Routine not found" :
                status === 422 ? "Routine rejected the request" :
                "Failed to fire routine";
    await prisma.agentSession.update({
      where: { id: agentSession.id },
      data: { status: "ERROR", error: msg, endedAt: new Date() },
    });
    return NextResponse.json({ error: msg }, { status });
  }

  const data = await routineRes.json() as {
    type: string;
    claude_code_session_id: string;
    claude_code_session_url: string;
  };

  // Record the live-session URL and mark the task as delegated
  await Promise.all([
    prisma.agentSession.update({
      where: { id: agentSession.id },
      data: {
        sessionUrl: data.claude_code_session_url,
        externalSessionId: data.claude_code_session_id,
      },
    }),
    prisma.task.update({
      where: { id: taskId },
      data: { agentQueued: true, assignedAgent: "claude-code" },
    }),
  ]);

  return NextResponse.json({
    sessionUrl: data.claude_code_session_url,
    sessionId: data.claude_code_session_id,
    agentSessionId: agentSession.id,
  });
}
