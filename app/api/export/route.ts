import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * GET /api/export?format=json|csv — export all tasks (and projects in JSON).
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const format = new URL(req.url).searchParams.get("format") ?? "json";

  const [tasks, projects] = await Promise.all([
    prisma.task.findMany({
      where: { userId: session.user.id },
      include: { project: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.project.findMany({ where: { userId: session.user.id } }),
  ]);

  if (format === "csv") {
    const header = [
      "title", "description", "notes", "status", "priority", "project",
      "scheduledDate", "startTime", "duration", "labels", "completedAt", "createdAt",
    ];
    const rows = tasks.map((t) =>
      [
        t.title, t.description, t.notes, t.status, t.priority, t.project?.name,
        t.scheduledDate?.toISOString(), t.startTime, t.duration, t.labels,
        t.completedAt?.toISOString(), t.createdAt.toISOString(),
      ].map(csvEscape).join(",")
    );
    const csv = [header.join(","), ...rows].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="taskflow-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    projects: projects.map((p) => ({ name: p.name, color: p.color, archived: p.archived })),
    tasks: tasks.map((t) => ({
      title: t.title,
      description: t.description,
      notes: t.notes,
      status: t.status,
      priority: t.priority,
      project: t.project?.name ?? null,
      scheduledDate: t.scheduledDate?.toISOString() ?? null,
      startTime: t.startTime,
      duration: t.duration,
      labels: t.labels ? JSON.parse(t.labels) : [],
      recurringRule: t.recurringRule,
      completedAt: t.completedAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
    })),
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="taskflow-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
