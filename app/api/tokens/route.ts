import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateToken } from "@/lib/tokens";
import { z } from "zod";

const CreateTokenSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tokens = await prisma.apiToken.findMany({
    where: { userId: session.user.id },
    select: { id: true, name: true, tokenPrefix: true, createdAt: true, lastUsedAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(tokens);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = CreateTokenSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { token, tokenHash, tokenPrefix } = generateToken();

  const record = await prisma.apiToken.create({
    data: {
      name: parsed.data.name,
      tokenHash,
      tokenPrefix,
      userId: session.user.id,
    },
    select: { id: true, name: true, tokenPrefix: true, createdAt: true },
  });

  return NextResponse.json({ ...record, token }, { status: 201 });
}
