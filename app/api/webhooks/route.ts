import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/tokens";
import { WebhookTaskSchema } from "@/lib/validate";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { parseLinkUrl } from "@/lib/integrations/links";

export async function POST(req: NextRequest) {
  const limited = await rateLimit(getClientIp(req), "webhook");
  if (limited) return limited;

  const authHeader = req.headers.get("authorization");
  const providedToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!providedToken) {
    return NextResponse.json({ error: "Missing or invalid Authorization header" }, { status: 401 });
  }
  const tokenHash = hashToken(providedToken);

  const apiToken = await prisma.apiToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true },
  });

  if (!apiToken || (apiToken.expiresAt && apiToken.expiresAt < new Date())) {
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

  const { externalId, link, ...taskData } = parsed.data;

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

  // Optional issue link (e.g. the GitHub/Jira item that spawned this task) —
  // enables resolution sync back to the tracker on completion.
  if (link) {
    const parsedLink = parseLinkUrl(link);
    const existing = await prisma.taskLink.findFirst({
      where: { taskId: task.id, url: parsedLink.url },
    });
    if (!existing) {
      await prisma.taskLink.create({
        data: {
          taskId: task.id,
          provider: parsedLink.provider,
          externalKey: parsedLink.externalKey,
          url: parsedLink.url,
          syncOnComplete: parsedLink.provider !== "URL",
        },
      });
    }
  }

  return NextResponse.json(task, { status: 201 });
}
