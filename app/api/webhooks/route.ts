import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/tokens";
import { WebhookTaskSchema } from "@/lib/validate";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const limited = await rateLimit(getClientIp(req), "webhook");
  if (limited) return limited;

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing or invalid Authorization header" }, { status: 401 });
  }
  const providedToken = authHeader.slice(7);
  const tokenHash = hashToken(providedToken);

  const apiToken = await prisma.apiToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true },
  });

  if (!apiToken) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // Update lastUsedAt async (don't await — don't block the request)
  void prisma.apiToken.update({
    where: { id: apiToken.id },
    data: { lastUsedAt: new Date() },
  });

  const body = await req.json().catch(() => null);
  const parsed = WebhookTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { externalId, ...taskData } = parsed.data;

  const task = await prisma.task.upsert({
    where: {
      userId_externalId: {
        userId: apiToken.userId,
        externalId: externalId ?? `api-${Date.now()}`,
      },
    },
    update: {
      title: taskData.title,
      description: taskData.description,
      notes: taskData.notes,
      priority: taskData.priority,
    },
    create: {
      ...taskData,
      externalId: externalId ?? `api-${Date.now()}`,
      source: "API",
      userId: apiToken.userId,
      scheduledDate: taskData.scheduledDate ? new Date(taskData.scheduledDate) : undefined,
      status: "INBOX",
    },
  });

  return NextResponse.json(task, { status: 201 });
}
