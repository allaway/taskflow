import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const UpdateLinkSchema = z.object({
  syncOnComplete: z.boolean(),
});

async function getOwnedLink(taskId: string, linkId: string, userId: string) {
  return prisma.taskLink.findFirst({
    where: { id: linkId, taskId, task: { userId } },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, linkId } = await params;
  const link = await getOwnedLink(id, linkId, session.user.id);
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = UpdateLinkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.taskLink.update({
    where: { id: linkId },
    data: { syncOnComplete: parsed.data.syncOnComplete },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, linkId } = await params;
  const link = await getOwnedLink(id, linkId, session.user.id);
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.taskLink.delete({ where: { id: linkId } });
  return new NextResponse(null, { status: 204 });
}
