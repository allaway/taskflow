/**
 * POST /api/threads/[id]/messages — reply in a thread. Streams SSE.
 *
 * In-app threads run the agent and stream its turn. For threads that live in
 * another tool the reply is saved, and the agent there reads it over MCP
 * (get_thread) the next time it checks in.
 */
import { NextRequest, NextResponse } from "next/server";
import { ThreadMessageSchema } from "@/lib/validate";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { sessionUserId, unauthorized } from "@/lib/http";
import { agentEventStream } from "@/lib/sse";
import { runThreadTurn } from "@/lib/services/threadRunner";

export const maxDuration = 120;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();

  const limited = await rateLimit(getClientIp(req), "api");
  if (limited) return limited;

  const parsed = ThreadMessageSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { id } = await params;

  return agentEventStream((send) =>
    runThreadTurn(userId, id, parsed.data.content, { timezone: parsed.data.timezone }, send)
  );
}
