/** GET /api/catchup?status=NEW — the catch-up inbox, most relevant first. */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sessionUserId, unauthorized } from "@/lib/http";
import { listCatchUp } from "@/lib/services/catchup";

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
  return NextResponse.json({ items, lastWorkDay: lastPlan?.date ?? null });
}
