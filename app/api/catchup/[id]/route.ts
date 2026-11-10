/** PATCH /api/catchup/[id] — triage one item: { action: "task" | "archive" | "restore" }. */
import { NextRequest, NextResponse } from "next/server";
import { CatchUpTriageSchema } from "@/lib/validate";
import { errorResponse, sessionUserId, unauthorized } from "@/lib/http";
import { triageCatchUp } from "@/lib/services/catchup";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();
  const parsed = CatchUpTriageSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    return NextResponse.json(await triageCatchUp(userId, (await params).id, parsed.data.action));
  } catch (err) {
    return errorResponse(err);
  }
}
