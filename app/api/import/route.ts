import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { z } from "zod";

const ImportTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).nullish(),
  notes: z.string().max(10000).nullish(),
  status: z.enum(["INBOX", "SCHEDULED", "NEEDS_REVIEW", "COMPLETED", "CANCELLED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  project: z.string().max(100).nullish(),
  scheduledDate: z.string().datetime().nullish(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullish(),
  duration: z.number().int().min(5).max(480).nullish(),
  labels: z.array(z.string().max(50)).optional(),
});

const ImportSchema = z.object({
  projects: z
    .array(z.object({ name: z.string().min(1).max(100), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() }))
    .optional()
    .default([]),
  tasks: z.array(ImportTaskSchema).max(2000),
});

/**
 * POST /api/import — bulk import tasks (and projects) from a TaskFlow JSON export.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const limited = await rateLimit(`user:${userId}`, "api");
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const parsed = ImportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Upsert projects by name, building a name → id map
  const projectNames = new Set<string>(parsed.data.projects.map((p) => p.name));
  for (const t of parsed.data.tasks) if (t.project) projectNames.add(t.project);

  const projectIdByName = new Map<string, string>();
  for (const name of projectNames) {
    const declared = parsed.data.projects.find((p) => p.name === name);
    const project = await prisma.project.upsert({
      where: { userId_name: { userId, name } },
      update: {},
      create: { userId, name, color: declared?.color ?? "#6366f1" },
    });
    projectIdByName.set(name, project.id);
  }

  const created = await prisma.task.createMany({
    data: parsed.data.tasks.map((t) => ({
      title: t.title,
      description: t.description ?? null,
      notes: t.notes ?? null,
      status: t.status ?? (t.scheduledDate ? "SCHEDULED" : "INBOX"),
      priority: t.priority ?? "MEDIUM",
      source: "API" as const,
      projectId: t.project ? projectIdByName.get(t.project) ?? null : null,
      scheduledDate: t.scheduledDate ? new Date(t.scheduledDate) : null,
      startTime: t.startTime ?? null,
      duration: t.duration ?? null,
      labels: t.labels?.length ? JSON.stringify(t.labels) : null,
      userId,
    })),
  });

  return NextResponse.json(
    { imported: created.count, projects: projectIdByName.size },
    { status: 201 }
  );
}
