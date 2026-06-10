import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BulkTaskActionSchema } from "@/lib/validate";
import { rateLimit } from "@/lib/rateLimit";
import { syncLinksOnComplete } from "@/lib/integrations/resolve";

/**
 * POST /api/tasks/bulk — apply one action to many tasks at once.
 * Actions: complete, delete, schedule, inbox, set_priority, set_project, delegate.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const limited = await rateLimit(`user:${userId}`, "api");
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const parsed = BulkTaskActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { ids, action, scheduledDate, priority, projectId } = parsed.data;

  // Only operate on tasks the user owns
  const owned = await prisma.task.findMany({
    where: { id: { in: ids }, userId },
    select: { id: true },
  });
  const ownedIds = owned.map((t) => t.id);
  if (ownedIds.length === 0) {
    return NextResponse.json({ error: "No matching tasks" }, { status: 404 });
  }

  if (action === "delete") {
    await prisma.task.deleteMany({ where: { id: { in: ownedIds } } });
    return NextResponse.json({ affected: ownedIds.length });
  }

  if (action === "complete") {
    await prisma.task.updateMany({
      where: { id: { in: ownedIds } },
      data: { status: "COMPLETED", completedAt: new Date(), agentQueued: false },
    });
    // Resolution sync for each completed task (sequential; bounded by max 200 ids)
    for (const taskId of ownedIds) {
      await syncLinksOnComplete(taskId, userId);
    }
    return NextResponse.json({ affected: ownedIds.length });
  }

  if (action === "schedule") {
    if (!scheduledDate) {
      return NextResponse.json({ error: "scheduledDate required for schedule action" }, { status: 400 });
    }
    await prisma.task.updateMany({
      where: { id: { in: ownedIds } },
      data: { status: "SCHEDULED", scheduledDate: new Date(scheduledDate) },
    });
    return NextResponse.json({ affected: ownedIds.length });
  }

  if (action === "inbox") {
    await prisma.task.updateMany({
      where: { id: { in: ownedIds } },
      data: { status: "INBOX", scheduledDate: null, startTime: null },
    });
    return NextResponse.json({ affected: ownedIds.length });
  }

  if (action === "set_priority") {
    if (!priority) {
      return NextResponse.json({ error: "priority required for set_priority action" }, { status: 400 });
    }
    await prisma.task.updateMany({
      where: { id: { in: ownedIds } },
      data: { priority },
    });
    return NextResponse.json({ affected: ownedIds.length });
  }

  if (action === "set_project") {
    if (projectId) {
      const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
      if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    await prisma.task.updateMany({
      where: { id: { in: ownedIds } },
      data: { projectId: projectId ?? null },
    });
    return NextResponse.json({ affected: ownedIds.length });
  }

  // delegate: queue every selected task for agent pickup via MCP
  await prisma.task.updateMany({
    where: { id: { in: ownedIds } },
    data: { agentQueued: true, assignedAgent: "mcp" },
  });
  return NextResponse.json({ affected: ownedIds.length });
}
