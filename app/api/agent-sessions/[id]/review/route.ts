import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SessionReviewSchema } from "@/lib/validate";
import { syncLinksOnComplete } from "@/lib/integrations/resolve";
import { requestLogger } from "@/lib/logger";

/**
 * POST /api/agent-sessions/[id]/review — the human review gate.
 *  - accept: session → COMPLETE, task → COMPLETED, linked issues resolved
 *  - send_back: session → ACTIVE with feedback, task returns to its lane
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const logger = requestLogger("agent-sessions/review");
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = SessionReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const agentSession = await prisma.agentSession.findFirst({
    where: { id, userId: session.user.id },
    include: { task: true },
  });
  if (!agentSession) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (agentSession.status !== "NEEDS_REVIEW") {
    return NextResponse.json({ error: "Session is not awaiting review" }, { status: 409 });
  }

  const { action, feedback } = parsed.data;

  if (action === "accept") {
    await prisma.$transaction([
      prisma.agentSession.update({
        where: { id },
        data: { status: "COMPLETE", endedAt: new Date(), reviewFeedback: feedback ?? null },
      }),
      prisma.task.update({
        where: { id: agentSession.taskId },
        data: { status: "COMPLETED", completedAt: new Date(), agentQueued: false },
      }),
    ]);

    const linkSync = await syncLinksOnComplete(agentSession.taskId, session.user.id);
    logger.info("agent result accepted", { sessionId: id, taskId: agentSession.taskId });
    return NextResponse.json({ status: "accepted", linkSync });
  }

  // send_back: reopen the task and hand the feedback to the agent
  const reopenedStatus = agentSession.task.scheduledDate ? "SCHEDULED" : "INBOX";
  const requeue = agentSession.agentType === "mcp" || agentSession.agentType === "claude-code";

  await prisma.$transaction([
    prisma.agentSession.update({
      where: { id },
      data: { status: "ACTIVE", reviewFeedback: feedback ?? null, lastActivityAt: new Date() },
    }),
    prisma.agentActivity.create({
      data: {
        sessionId: id,
        type: "ANSWER",
        toolName: "review_feedback",
        content: feedback || "The reviewer sent this work back for changes.",
      },
    }),
    prisma.task.update({
      where: { id: agentSession.taskId },
      data: { status: reopenedStatus, agentQueued: requeue },
    }),
  ]);

  logger.info("agent result sent back", { sessionId: id, taskId: agentSession.taskId });
  return NextResponse.json({ status: "sent_back" });
}
