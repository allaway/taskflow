/** GET /api/catchup?status=NEW — the catch-up inbox, most relevant first. */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sessionUserId, unauthorized } from "@/lib/http";
import { listCatchUp, relatedWork } from "@/lib/services/catchup";

export async function GET(req: NextRequest) {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();
  const raw = new URL(req.url).searchParams.get("status");
  const status = raw === "ARCHIVED" || raw === "TASKED" ? raw : "NEW";

  const [items, lastPlan] = await Promise.all([
    listCatchUp(userId, status),
    // "Since your last work day": the most recent day the user planned before today.
    prisma.dayPlan.findFirst({
      where: { userId, date: { lt: new Date().toISOString().slice(0, 10) } },
      orderBy: { date: "desc" },
      select: { date: true },
    }),
  ]);
  // Agent updates carry the task they were for, so it can be resolved from here.
  const related = await relatedWork(userId, items);
  return NextResponse.json({
    items: items.map((item) => ({ ...item, related: related[item.id] ?? null })),
    lastWorkDay: lastPlan?.date ?? null,
  });
}
