import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SessionAnswerSchema } from "@/lib/validate";
import { answerQuestion } from "@/lib/agentSessions";

/**
 * POST /api/agent-sessions/[id]/answer — answer an agent's blocking question.
 * The session returns to ACTIVE; the agent picks the answer up via MCP
 * (get_session) or, for in-app sessions, on the next run-agent resume.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = SessionAnswerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const agentSession = await prisma.agentSession.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!agentSession) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (agentSession.status !== "AWAITING_INPUT") {
    return NextResponse.json({ error: "Session has no pending question" }, { status: 409 });
  }

  await answerQuestion(id, parsed.data.answer);
  return NextResponse.json({ status: "answered" });
}
