/**
 * Agent threads — delegated work grouped under tasks.
 * GET  /api/threads?taskId=&status= — list.
 * POST /api/threads — start an in-app thread or link one that lives elsewhere.
 */
import { NextRequest, NextResponse } from "next/server";
import { CreateThreadSchema, ThreadStatusEnum } from "@/lib/validate";
import { errorResponse, sessionUserId, unauthorized } from "@/lib/http";
import { createAgentThread, listThreads } from "@/lib/services/threads";

export async function GET(req: NextRequest) {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();
  const p = new URL(req.url).searchParams;
  const status = ThreadStatusEnum.safeParse(p.get("status"));
  return NextResponse.json(
    await listThreads(userId, { taskId: p.get("taskId"), status: status.success ? status.data : null })
  );
}

export async function POST(req: NextRequest) {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();

  const parsed = CreateThreadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    return NextResponse.json(await createAgentThread(userId, parsed.data), { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
