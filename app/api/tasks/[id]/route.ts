import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UpdateTaskSchema } from "@/lib/validate";

async function getTaskForUser(taskId: string, userId: string) {
  return prisma.task.findFirst({ where: { id: taskId, userId } });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const task = await getTaskForUser(id, session.user.id);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(task);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await getTaskForUser(id, session.user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = UpdateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = { ...parsed.data } as Record<string, unknown>;
  if (parsed.data.scheduledDate !== undefined) {
    data.scheduledDate = parsed.data.scheduledDate ? new Date(parsed.data.scheduledDate) : null;
  }
  if (parsed.data.labels !== undefined) {
    data.labels = parsed.data.labels ? JSON.stringify(parsed.data.labels) : null;
  }
  if (parsed.data.status === "SCHEDULED" && !data.scheduledDate && !existing.scheduledDate) {
    return NextResponse.json({ error: "scheduledDate required when setting status to SCHEDULED" }, { status: 400 });
  }
  // Track completedAt timestamp
  if (parsed.data.status === "COMPLETED" && existing.status !== "COMPLETED") {
    data.completedAt = new Date();
  } else if (parsed.data.status && parsed.data.status !== "COMPLETED" && existing.status === "COMPLETED") {
    data.completedAt = null;
  }

  const task = await prisma.task.update({ where: { id }, data });
  return NextResponse.json(task);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await getTaskForUser(id, session.user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.task.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
