import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const agentSession = await prisma.agentSession.findFirst({
    where: { id, userId: session.user.id },
    include: {
      task: { select: { id: true, title: true, status: true } },
      activities: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!agentSession) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(agentSession);
}
