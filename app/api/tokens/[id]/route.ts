import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const token = await prisma.apiToken.findFirst({ where: { id, userId: session.user.id } });
  if (!token) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.apiToken.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
