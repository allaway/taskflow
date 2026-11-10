export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

/**
 * OAuth 2.0 Dynamic Client Registration (RFC 7591)
 * Claude registers itself here before starting the authorization flow.
 * We accept any client and return a generated client_id (we don't enforce it
 * later — the user session is the real gate).
 */
export async function POST(req: NextRequest) {
  const limited = await rateLimit(getClientIp(req), "api");
  if (limited) return limited;

  const body = await req.json().catch(() => ({}));

  const clientId = randomBytes(16).toString("hex");

  return NextResponse.json(
    {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: body.client_name ?? "MCP Client",
      redirect_uris: body.redirect_uris ?? [],
      grant_types: body.grant_types ?? ["authorization_code"],
      response_types: body.response_types ?? ["code"],
      token_endpoint_auth_method: "none",
    },
    { status: 201 }
  );
}
