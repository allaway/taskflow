import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const task = await prisma.task.findFirst({ where: { id, userId: session.user.id } });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { n8nOutboundUrl: true },
  });

  if (!user?.n8nOutboundUrl) {
    return NextResponse.json({ error: "N8N outbound URL not configured. Add it in Settings → N8N." }, { status: 422 });
  }

  const outboundUrl = decrypt(user.n8nOutboundUrl);

  const res = await fetch(outboundUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      taskId: task.id,
      title: task.title,
      description: task.description,
      notes: task.notes,
      priority: task.priority,
      status: task.status,
      scheduledDate: task.scheduledDate,
      startTime: task.startTime,
      duration: task.duration,
    }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: `N8N returned ${res.status}` }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
