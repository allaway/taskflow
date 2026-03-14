import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { N8NWebhookSchema } from "@/lib/validate";
import { decrypt } from "@/lib/crypto";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const limited = await rateLimit(getClientIp(req), "webhook");
  if (limited) return limited;

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing or invalid Authorization header" }, { status: 401 });
  }
  const providedSecret = authHeader.slice(7);

  const users = await prisma.user.findMany({
    where: { n8nWebhookSecret: { not: null } },
    select: { id: true, n8nWebhookSecret: true },
  });

  let matchedUserId: string | null = null;
  for (const u of users) {
    try {
      const decrypted = decrypt(u.n8nWebhookSecret!);
      if (decrypted === providedSecret) {
        matchedUserId = u.id;
        break;
      }
    } catch {
      continue;
    }
  }

  if (!matchedUserId) {
    return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = N8NWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { externalId, ...taskData } = parsed.data;

  const task = await prisma.task.upsert({
    where: {
      userId_externalId: {
        userId: matchedUserId,
        externalId: externalId ?? `n8n-${Date.now()}`,
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
      externalId: externalId ?? `n8n-${Date.now()}`,
      source: "N8N",
      userId: matchedUserId,
      scheduledDate: taskData.scheduledDate ? new Date(taskData.scheduledDate) : undefined,
      status: taskData.scheduledDate ? "SCHEDULED" : "INBOX",
    },
  });

  return NextResponse.json(task, { status: 201 });
}
