import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sweepStaleSessions } from "@/lib/agentSessions";

/**
 * GET /api/agent-sessions?status=AWAITING_INPUT&status=NEEDS_REVIEW
 * Lists the user's agent sessions, most recent first. Used by the sidebar
 * "agent attention" indicator and the task detail thread.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await sweepStaleSessions(session.user.id);

  const { searchParams } = new URL(req.url);
  const statuses = searchParams.getAll("status");
  const taskId = searchParams.get("taskId");

  const where: Record<string, unknown> = { userId: session.user.id };
  if (statuses.length > 0) where.status = { in: statuses };
  if (taskId) where.taskId = taskId;

  const sessions = await prisma.agentSession.findMany({
    where,
    include: {
      task: { select: { id: true, title: true, status: true } },
      activities: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { startedAt: "desc" },
    take: 100,
  });

  return NextResponse.json(sessions);
}
