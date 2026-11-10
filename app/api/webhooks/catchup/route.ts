/**
 * POST /api/webhooks/catchup — push things into the catch-up inbox from any
 * integration (n8n, Zapier, a script). Authenticated with an API token.
 *
 * Body: one item, or { "items": [ … up to 50 ] }
 *   { "source": "email", "title": "…", "body": "…", "url": "…", "author": "…",
 *     "externalId": "stable-id-for-dedup", "occurredAt": "ISO datetime" }
 */
import { NextRequest, NextResponse } from "next/server";
import { userIdFromBearer } from "@/lib/apiAuth";
import { CatchUpWebhookSchema } from "@/lib/validate";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { errorResponse } from "@/lib/http";
import { ingestCatchUp } from "@/lib/services/catchup";

export async function POST(req: NextRequest) {
  const limited = await rateLimit(getClientIp(req), "webhook");
  if (limited) return limited;

  const userId = await userIdFromBearer(req);
  if (!userId) {
    return NextResponse.json({ error: "Missing or invalid Authorization header" }, { status: 401 });
  }

  const parsed = CatchUpWebhookSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const inputs = "items" in parsed.data ? parsed.data.items : [parsed.data];

  try {
    const items = await ingestCatchUp(userId, inputs);
    return NextResponse.json({ received: items.length, items }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
