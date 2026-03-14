import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserSettingsSchema } from "@/lib/validate";
import { encryptNullable, decryptNullable, maskSecret } from "@/lib/crypto";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      n8nWebhookSecret: true,
      n8nOutboundUrl: true,
      aiProvider: true,
      aiApiKey: true,
      aiModel: true,
      aiSchedulingModel: true,
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const decryptedSecret = decryptNullable(user.n8nWebhookSecret);
  const decryptedApiKey = decryptNullable(user.aiApiKey);
  const decryptedOutboundUrl = decryptNullable(user.n8nOutboundUrl);

  return NextResponse.json({
    ...user,
    n8nWebhookSecret: decryptedSecret ? maskSecret(decryptedSecret) : null,
    n8nOutboundUrl: decryptedOutboundUrl,
    aiApiKey: decryptedApiKey ? maskSecret(decryptedApiKey) : null,
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

  if (parsed.data.n8nWebhookSecret !== undefined) {
    updates.n8nWebhookSecret = parsed.data.n8nWebhookSecret
      ? encryptNullable(parsed.data.n8nWebhookSecret)
      : null;
  }
  if (parsed.data.n8nOutboundUrl !== undefined) {
    updates.n8nOutboundUrl = parsed.data.n8nOutboundUrl
      ? encryptNullable(parsed.data.n8nOutboundUrl)
      : null;
  }
  if (parsed.data.aiApiKey !== undefined && parsed.data.aiApiKey) {
    const existing = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { aiApiKey: true },
    });
    const currentDecrypted = decryptNullable(existing?.aiApiKey);
    const isMasked = parsed.data.aiApiKey.includes("...");
    if (!isMasked) {
      updates.aiApiKey = encryptNullable(parsed.data.aiApiKey);
    } else {
      updates.aiApiKey = existing?.aiApiKey ?? null;
      void currentDecrypted;
    }
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: updates,
    select: { id: true, name: true, email: true, aiProvider: true, aiModel: true, aiSchedulingModel: true },
  });

  return NextResponse.json(user);
}
