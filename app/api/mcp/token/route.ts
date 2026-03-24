export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/tokens";

/**
 * OAuth 2.0 token endpoint — client credentials grant.
 * client_id: anything (ignored)
 * client_secret: a TaskFlow API token (tf_…)
 *
 * Supports three auth methods:
 *  1. HTTP Basic auth header: Authorization: Basic base64(client_id:client_secret)
 *  2. Form body: client_id=...&client_secret=tf_...
 *  3. JSON body: { "client_id": "...", "client_secret": "tf_..." }
 */
export async function POST(req: NextRequest) {
  let clientSecret: string | null = null;
  let grantType: string | null = null;

  // Method 1: HTTP Basic auth (RFC 6749 §2.3.1) — most common for Cowork
  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader.startsWith("Basic ")) {
    const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf-8");
    // Format is client_id:client_secret — secret is everything after the first colon
    const colonIdx = decoded.indexOf(":");
    if (colonIdx !== -1) {
      clientSecret = decoded.slice(colonIdx + 1) || null;
    } else {
      // No colon — treat the whole value as the secret
      clientSecret = decoded || null;
    }
  }

  // Parse body regardless (to get grant_type and fallback secret)
  const contentType = req.headers.get("content-type") ?? "";
  let body: URLSearchParams | null = null;

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await req.text().catch(() => "");
    body = new URLSearchParams(text);
  } else {
    const json = await req.json().catch(() => null);
    if (json && typeof json === "object") {
      body = new URLSearchParams(json as Record<string, string>);
    }
  }

  if (body) {
    grantType = body.get("grant_type");
    // Method 2 & 3: secret in body (if not already found in Basic header)
    if (!clientSecret) {
      clientSecret = body.get("client_secret");
    }
  }

  // grant_type defaults to client_credentials if not specified
  if (grantType && grantType !== "client_credentials") {
    return NextResponse.json(
      { error: "unsupported_grant_type" },
      { status: 400 }
    );
  }

  if (!clientSecret) {
    return NextResponse.json(
      { error: "invalid_client", error_description: "client_secret is required (set it to your TaskFlow API token)" },
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

  return NextResponse.json({
    access_token: clientSecret,
    token_type: "bearer",
    expires_in: 86400 * 365,
  });
}
