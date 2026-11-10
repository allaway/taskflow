/** POST /api/catchup/rank — re-rank open catch-up items against current work. */
import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { errorResponse, sessionUserId, unauthorized } from "@/lib/http";
import { rankCatchUp } from "@/lib/services/catchup";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();
  const limited = await rateLimit(getClientIp(req), "api");
  if (limited) return limited;
  try {
    return NextResponse.json(await rankCatchUp(userId));
  } catch (err) {
    return errorResponse(err);
  }
}
