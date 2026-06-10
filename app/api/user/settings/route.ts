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
      dailyBudgetHours: true,
      labelPalette: true,
      googleAccessToken: true,
      googleEmail: true,
      claudeCodeRoutineId: true,
      claudeCodeRoutineToken: true,
      githubToken: true,
      jiraSiteUrl: true,
      jiraEmail: true,
      jiraApiToken: true,
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const decryptedApiKey = decryptNullable(user.aiApiKey);
  const decryptedRoutineToken = decryptNullable(user.claudeCodeRoutineToken);
  const decryptedGithubToken = decryptNullable(user.githubToken);
  const decryptedJiraToken = decryptNullable(user.jiraApiToken);

  return NextResponse.json({
    ...user,
    aiApiKey: decryptedApiKey ? maskSecret(decryptedApiKey) : null,
    googleAccessToken: undefined, // never expose
    googleCalendarConnected: !!user.googleAccessToken,
    labelPalette: user.labelPalette ? JSON.parse(user.labelPalette) : [],
    claudeCodeRoutineToken: decryptedRoutineToken ? maskSecret(decryptedRoutineToken) : null,
    hasClaudeCodeRoutine: !!(user.claudeCodeRoutineId && user.claudeCodeRoutineToken),
    githubToken: decryptedGithubToken ? maskSecret(decryptedGithubToken) : null,
    jiraApiToken: decryptedJiraToken ? maskSecret(decryptedJiraToken) : null,
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

  if (parsed.data.dailyBudgetHours !== undefined) {
    (updates as Record<string, unknown>).dailyBudgetHours = parsed.data.dailyBudgetHours;
  }
  if (parsed.data.labelPalette !== undefined) {
    updates.labelPalette = JSON.stringify(parsed.data.labelPalette);
  }

  if (parsed.data.aiApiKey !== undefined && parsed.data.aiApiKey) {
    const existing = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { aiApiKey: true, claudeCodeRoutineToken: true },
    });
    const isMasked = parsed.data.aiApiKey.includes("...");
    if (!isMasked) {
      updates.aiApiKey = encryptNullable(parsed.data.aiApiKey);
    } else {
      updates.aiApiKey = existing?.aiApiKey ?? null;
    }

    if (parsed.data.claudeCodeRoutineToken !== undefined) {
      if (parsed.data.claudeCodeRoutineToken === null) {
        updates.claudeCodeRoutineToken = null;
      } else {
        const isMaskedToken = parsed.data.claudeCodeRoutineToken.includes("...");
        if (!isMaskedToken) {
          updates.claudeCodeRoutineToken = encryptNullable(parsed.data.claudeCodeRoutineToken);
        } else {
          updates.claudeCodeRoutineToken = existing?.claudeCodeRoutineToken ?? null;
        }
      }
    }
  }

  if (parsed.data.claudeCodeRoutineToken !== undefined && parsed.data.aiApiKey === undefined) {
    const existing = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { claudeCodeRoutineToken: true },
    });
    if (parsed.data.claudeCodeRoutineToken === null) {
      updates.claudeCodeRoutineToken = null;
    } else {
      const isMaskedToken = parsed.data.claudeCodeRoutineToken.includes("...");
      if (!isMaskedToken) {
        updates.claudeCodeRoutineToken = encryptNullable(parsed.data.claudeCodeRoutineToken);
      } else {
        updates.claudeCodeRoutineToken = existing?.claudeCodeRoutineToken ?? null;
      }
    }
  }

  if (parsed.data.claudeCodeRoutineId !== undefined) {
    updates.claudeCodeRoutineId = parsed.data.claudeCodeRoutineId || null;
  }

  // Issue tracker credentials (encrypted; masked values mean "keep existing")
  for (const field of ["githubToken", "jiraApiToken"] as const) {
    const value = parsed.data[field];
    if (value === undefined) continue;
    if (value === null || value === "") {
      updates[field] = null;
    } else if (!value.includes("...")) {
      updates[field] = encryptNullable(value);
    }
    // masked value → leave unchanged
  }
  if (parsed.data.jiraSiteUrl !== undefined) updates.jiraSiteUrl = parsed.data.jiraSiteUrl || null;
  if (parsed.data.jiraEmail !== undefined) updates.jiraEmail = parsed.data.jiraEmail || null;

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: updates,
    select: { id: true, name: true, email: true, aiProvider: true, aiModel: true, aiSchedulingModel: true, dailyBudgetHours: true, labelPalette: true, claudeCodeRoutineId: true },
  });

  return NextResponse.json({
    ...user,
    labelPalette: user.labelPalette ? JSON.parse(user.labelPalette) : [],
  });
}
