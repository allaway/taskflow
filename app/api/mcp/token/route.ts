export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/tokens";
import { verifyCode } from "@/app/authorize/route";
import { createHash } from "crypto";

/**
 * OAuth 2.0 token endpoint.
 *
 * Supports two grant types:
 *  - authorization_code (PKCE): Cowork exchanges a signed code for an access token.
 *  - client_credentials: direct token exchange for Claude Code CLI / API use.
 *
 * In both cases the access_token is a TaskFlow API token (tf_…).
 */

async function parseBody(req: NextRequest): Promise<URLSearchParams | null> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/x-www-form-urlencoded")) {
    return new URLSearchParams(await req.text().catch(() => ""));
  }
  const json = await req.json().catch(() => null);
  if (json && typeof json === "object") return new URLSearchParams(json as Record<string, string>);
  return null;
}

function extractBasicSecret(req: NextRequest): string | null {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Basic ")) return null;
  const decoded = Buffer.from(auth.slice(6), "base64").toString("utf-8");
  const colon = decoded.indexOf(":");
  return colon !== -1 ? decoded.slice(colon + 1) || null : decoded || null;
}

export async function POST(req: NextRequest) {
  const body = await parseBody(req);
  const grantType = body?.get("grant_type") ?? "client_credentials";

  // ── Authorization Code + PKCE ────────────────────────────────────────────
  if (grantType === "authorization_code") {
    const code = body?.get("code");
    const codeVerifier = body?.get("code_verifier");

    if (!code) {
      return NextResponse.json({ error: "invalid_request", error_description: "code is required" }, { status: 400 });
    }

    const payload = verifyCode(code);
    if (!payload) {
      return NextResponse.json({ error: "invalid_grant", error_description: "Code is invalid or expired" }, { status: 401 });
    }

    // Verify PKCE
    if (payload.codeChallenge && codeVerifier) {
      const challenge = createHash("sha256").update(codeVerifier).digest("base64url");
      if (challenge !== payload.codeChallenge) {
        return NextResponse.json({ error: "invalid_grant", error_description: "PKCE verification failed" }, { status: 401 });
      }
    }

    return NextResponse.json({
      access_token: payload.token as string,
      token_type: "bearer",
      expires_in: 86400 * 365,
    });
  }

  // ── Client Credentials ───────────────────────────────────────────────────
  if (grantType === "client_credentials") {
    const clientSecret = extractBasicSecret(req) ?? body?.get("client_secret") ?? null;

    if (!clientSecret) {
      return NextResponse.json(
        { error: "invalid_client", error_description: "client_secret is required (set it to your TaskFlow API token)" },
        { status: 401 }
      );
    }

    const hash = hashToken(clientSecret);
    const record = await prisma.apiToken.findUnique({ where: { tokenHash: hash }, select: { userId: true } });
    if (!record) {
      return NextResponse.json({ error: "invalid_client", error_description: "Invalid client_secret" }, { status: 401 });
    }

    return NextResponse.json({ access_token: clientSecret, token_type: "bearer", expires_in: 86400 * 365 });
  }

  return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400 });
}
