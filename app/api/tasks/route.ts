import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CreateTaskSchema } from "@/lib/validate";
import { rateLimit } from "@/lib/rateLimit";
import { TASK_INCLUDE } from "@/lib/taskInclude";

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 1000;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const date = searchParams.get("date");
  const source = searchParams.get("source");
  const projectId = searchParams.get("projectId");
  const parentId = searchParams.get("parentId");
  const completedDate = searchParams.get("completedDate");
  const completedFrom = searchParams.get("completedFrom");
  const completedTo = searchParams.get("completedTo");
  const q = searchParams.get("q");
  const cursor = searchParams.get("cursor");
  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") ?? "", 10) || DEFAULT_LIMIT, 1),
    MAX_LIMIT
  );

  const where: Record<string, unknown> = { userId: session.user.id };
  if (status) where.status = status;
  if (date) {
    const dayStart = new Date(date + "T00:00:00.000Z");
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    where.scheduledDate = { gte: dayStart, lt: dayEnd };
  }
  if (source) where.source = source;
  if (projectId) where.projectId = projectId;
  if (parentId) where.parentId = parentId;
  if (completedDate) {
    const dayStart = new Date(completedDate + "T00:00:00.000Z");
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    where.completedAt = { gte: dayStart, lt: dayEnd };
  }
  if (completedFrom || completedTo) {
    const range: Record<string, Date> = {};
    if (completedFrom) range.gte = new Date(completedFrom + "T00:00:00.000Z");
    if (completedTo) range.lt = new Date(completedTo + "T00:00:00.000Z");
    where.completedAt = range;
  }
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
    ];
  }

  const tasks = await prisma.task.findMany({
    where,
    include: TASK_INCLUDE,
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }, { id: "asc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  // Cursor pagination: response body stays a plain array for backward
  // compatibility; the next cursor travels in a header.
  const hasMore = tasks.length > limit;
  const page = hasMore ? tasks.slice(0, limit) : tasks;
  const headers: Record<string, string> = {};
  if (hasMore) headers["X-Next-Cursor"] = page[page.length - 1].id;

  return NextResponse.json(page, { headers });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimit(`user:${session.user.id}`, "api");
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const parsed = CreateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { projectId, parentId, ...data } = parsed.data;

  // Ownership checks for relations
  if (projectId) {
    const project = await prisma.project.findFirst({ where: { id: projectId, userId: session.user.id } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (parentId) {
    const parent = await prisma.task.findFirst({ where: { id: parentId, userId: session.user.id } });
    if (!parent) return NextResponse.json({ error: "Parent task not found" }, { status: 404 });
    if (parent.parentId) {
      return NextResponse.json({ error: "Subtasks cannot be nested more than one level" }, { status: 400 });
    }
  }

  const task = await prisma.task.create({
    data: {
      ...data,
      projectId: projectId ?? undefined,
      parentId: parentId ?? undefined,
      userId: session.user.id,
      scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : undefined,
      status: data.scheduledDate ? "SCHEDULED" : "INBOX",
    },
    include: TASK_INCLUDE,
  });

  return NextResponse.json(task, { status: 201 });
}
