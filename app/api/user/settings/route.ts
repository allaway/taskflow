import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserSettingsSchema } from "@/lib/validate";
import { decryptNullable, maskSecret, encryptNullable } from "@/lib/crypto";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      aiProvider: true,
      aiApiKey: true,
      aiModel: true,
      aiSchedulingModel: true,
      calendarFeeds: true,
      dailyBudgetHours: true,
      labelPalette: true,
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const decryptedApiKey = decryptNullable(user.aiApiKey);

  return NextResponse.json({
    ...user,
    aiApiKey: decryptedApiKey ? maskSecret(decryptedApiKey) : null,
    calendarFeeds: user.calendarFeeds ? JSON.parse(user.calendarFeeds) : [],
    labelPalette: user.labelPalette ? JSON.parse(user.labelPalette) : [],
  });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = UserSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updates: Record<string, string | null | undefined> = {};

  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.aiProvider !== undefined) updates.aiProvider = parsed.data.aiProvider;
  if (parsed.data.aiModel !== undefined) updates.aiModel = parsed.data.aiModel || null;
  if (parsed.data.aiSchedulingModel !== undefined) updates.aiSchedulingModel = parsed.data.aiSchedulingModel || null;

  if (parsed.data.calendarFeeds !== undefined) {
    updates.calendarFeeds = JSON.stringify(parsed.data.calendarFeeds);
  }
  if (parsed.data.dailyBudgetHours !== undefined) {
    (updates as Record<string, unknown>).dailyBudgetHours = parsed.data.dailyBudgetHours;
  }
  if (parsed.data.labelPalette !== undefined) {
    updates.labelPalette = JSON.stringify(parsed.data.labelPalette);
  }

  if (parsed.data.aiApiKey !== undefined && parsed.data.aiApiKey) {
    const existing = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { aiApiKey: true },
    });
    const isMasked = parsed.data.aiApiKey.includes("...");
    if (!isMasked) {
      updates.aiApiKey = encryptNullable(parsed.data.aiApiKey);
    } else {
      updates.aiApiKey = existing?.aiApiKey ?? null;
    }
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: updates,
    select: { id: true, name: true, email: true, aiProvider: true, aiModel: true, aiSchedulingModel: true, calendarFeeds: true, dailyBudgetHours: true, labelPalette: true },
  });

  return NextResponse.json({
    ...user,
    calendarFeeds: user.calendarFeeds ? JSON.parse(user.calendarFeeds) : [],
    labelPalette: user.labelPalette ? JSON.parse(user.labelPalette) : [],
  });
}
