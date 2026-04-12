import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CreateTaskSchema } from "@/lib/validate";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const date = searchParams.get("date");
  const source = searchParams.get("source");
  const completedDate = searchParams.get("completedDate");

  const where: Record<string, unknown> = { userId: session.user.id };
  if (status) where.status = status;
  if (date) {
    const dayStart = new Date(date + "T00:00:00.000Z");
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    where.scheduledDate = { gte: dayStart, lt: dayEnd };
  }
  if (source) where.source = source;
  if (completedDate) {
    const dayStart = new Date(completedDate + "T00:00:00.000Z");
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    where.completedAt = { gte: dayStart, lt: dayEnd };
  }

  const tasks = await prisma.task.findMany({
    where,
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimit(getClientIp(req), "api");
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const parsed = CreateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const task = await prisma.task.create({
    data: {
      ...parsed.data,
      userId: session.user.id,
      scheduledDate: parsed.data.scheduledDate ? new Date(parsed.data.scheduledDate) : undefined,
      status: parsed.data.scheduledDate ? "SCHEDULED" : "INBOX",
    },
  });

  return NextResponse.json(task, { status: 201 });
}
