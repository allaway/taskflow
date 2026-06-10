import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ProjectSchema } from "@/lib/validate";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    include: { _count: { select: { tasks: { where: { status: { notIn: ["COMPLETED", "CANCELLED"] } } } } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = ProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.project.findFirst({
    where: { userId: session.user.id, name: parsed.data.name },
  });
  if (existing) {
    return NextResponse.json({ error: "A project with that name already exists" }, { status: 409 });
  }

  const project = await prisma.project.create({
    data: { ...parsed.data, userId: session.user.id },
  });

  return NextResponse.json(project, { status: 201 });
}
