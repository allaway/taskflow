/**
 * GET  /api/plan?date=YYYY-MM-DD — the saved intent and summary for a day.
 * POST /api/plan — propose a plan for the day from the user's intent. Read-only:
 *                  nothing changes until the proposal is sent to /api/plan/apply.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PlanRequestSchema } from "@/lib/validate";
import { callAi, resolveAiConfig } from "@/lib/ai";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { errorResponse, sessionUserId, unauthorized } from "@/lib/http";
import {
  buildPlanPrompt,
  fallbackPlan,
  gatherPlanContext,
  getDayPlan,
  parsePlan,
} from "@/lib/services/planner";

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();
  const date = new URL(req.url).searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }
  return NextResponse.json({ plan: await getDayPlan(userId, date) });
}

export async function POST(req: NextRequest) {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();

  const limited = await rateLimit(getClientIp(req), "api");
  if (limited) return limited;

  const parsed = PlanRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { date, intent, workStartTime, workEndTime, timezone } = parsed.data;

  try {
    const ctx = await gatherPlanContext(userId, {
      date,
      timezone,
      workStart: workStartTime,
      workEnd: workEndTime,
    });
    const candidates = [...ctx.dayTasks, ...ctx.inboxTasks];
    const tasks = Object.fromEntries(
      candidates.map((t) => [t.id, { title: t.title, priority: t.priority, onDay: ctx.dayTasks.includes(t) }])
    );

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { aiProvider: true, aiApiKey: true, aiModel: true, aiSchedulingModel: true },
    });
    const aiConfigured = !!(user?.aiProvider && user.aiApiKey && user.aiModel);
    if (!aiConfigured) {
      return NextResponse.json({ proposal: fallbackPlan(ctx), tasks, usedAi: false });
    }

    let raw: string;
    try {
      raw = await callAi(resolveAiConfig(user!, true), buildPlanPrompt(ctx, intent));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "AI call failed";
      return NextResponse.json({ error: `AI error: ${msg}` }, { status: 502 });
    }

    try {
      const proposal = parsePlan(raw, new Set(candidates.map((t) => t.id)));
      return NextResponse.json({ proposal, tasks, usedAi: true });
    } catch {
      return NextResponse.json({ error: "AI returned an unexpected format" }, { status: 502 });
    }
  } catch (err) {
    return errorResponse(err);
  }
}
