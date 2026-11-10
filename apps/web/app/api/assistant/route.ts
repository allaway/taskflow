/**
 * The daily assistant chat.
 * GET  /api/assistant?date=YYYY-MM-DD — that day's conversation so far.
 * POST /api/assistant — send a message; streams the assistant's turn as SSE.
 */
import { NextRequest, NextResponse } from "next/server";
import { AssistantMessageSchema } from "@/lib/validate";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { sessionUserId, unauthorized } from "@/lib/http";
import { agentEventStream } from "@/lib/sse";
import { getAssistantThread } from "@/lib/services/threads";
import { runThreadTurn } from "@/lib/services/threadRunner";

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();
  const date = new URL(req.url).searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }
  const thread = await getAssistantThread(userId, date, false);
  return NextResponse.json({ messages: thread?.messages ?? [] });
}

export async function POST(req: NextRequest) {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();

  const limited = await rateLimit(getClientIp(req), "api");
  if (limited) return limited;

  const parsed = AssistantMessageSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { date, timezone, content } = parsed.data;

  return agentEventStream(async (send) => {
    const thread = await getAssistantThread(userId, date, true);
    await runThreadTurn(userId, thread!.id, content, { timezone }, send);
  });
}
