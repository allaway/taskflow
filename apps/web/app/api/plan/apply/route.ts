/** POST /api/plan/apply — write a reviewed plan to the day and save its intent. */
import { NextRequest, NextResponse } from "next/server";
import { PlanApplySchema } from "@/lib/validate";
import { errorResponse, sessionUserId, unauthorized } from "@/lib/http";
import { applyPlan } from "@/lib/services/planner";

export async function POST(req: NextRequest) {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();

  const parsed = PlanApplySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    return NextResponse.json(await applyPlan(userId, parsed.data));
  } catch (err) {
    return errorResponse(err);
  }
}
