export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/tokens";

/**
 * OAuth 2.0 token endpoint — client credentials grant.
 * client_id: anything (ignored)
 * client_secret: a TaskFlow API token (tf_…)
 *
 * Returns the validated token as the access_token so the MCP endpoint
 * can verify it using the same API token lookup.
 */
export async function POST(req: NextRequest) {
  let body: URLSearchParams | null = null;

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    body = new URLSearchParams(text);
  } else {
    // Some clients send JSON
    const json = await req.json().catch(() => null);
    if (json) {
      body = new URLSearchParams(json as Record<string, string>);
    }
  }

  if (!body) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "Could not parse request body" },
      { status: 400 }
    );
  }

  const grantType = body.get("grant_type");
  if (grantType !== "client_credentials") {
    return NextResponse.json(
      { error: "unsupported_grant_type" },
      { status: 400 }
    );
  }

  const clientSecret = body.get("client_secret");
  if (!clientSecret) {
    return NextResponse.json(
      { error: "invalid_client", error_description: "client_secret is required" },
      { status: 401 }
    );
  }

  // Validate the client_secret as a TaskFlow API token
  const hash = hashToken(clientSecret);
  const record = await prisma.apiToken.findUnique({
    where: { tokenHash: hash },
    select: { userId: true },
  });

  if (!record) {
    return NextResponse.json(
      { error: "invalid_client", error_description: "Invalid client_secret" },
      { status: 401 }
    );
  }

  // The token IS the access_token — no need for a separate JWT layer
  return NextResponse.json({
    access_token: clientSecret,
    token_type: "bearer",
    expires_in: 86400 * 365, // effectively non-expiring; the underlying API token controls access
  });
}
