export const runtime = "nodejs";

/**
 * OAuth 2.0 Authorization endpoint (RFC 6749 §4.1 + PKCE RFC 7636).
 * Cowork redirects here to start the auth flow.
 *
 * Flow:
 *  1. Cowork → GET /authorize?response_type=code&code_challenge=…&redirect_uri=…
 *  2. We check the user's session. If not logged in, redirect to /login first.
 *  3. We create a dedicated "Claude Cowork" API token and embed it in a signed,
 *     short-lived code (5 min) that also stores the PKCE challenge.
 *  4. We redirect to redirect_uri?code=…&state=…
 *  5. Cowork exchanges the code at /api/mcp/token (authorization_code grant).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateToken } from "@/lib/tokens";
import { createHmac } from "crypto";
// getOrigin imported for future use — authorize redirects use redirect_uri from the client

const secret = () => process.env.NEXTAUTH_SECRET ?? "dev-secret";

export function signCode(payload: object): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyCode(code: string): Record<string, unknown> | null {
  const dot = code.lastIndexOf(".");
  if (dot === -1) return null;
  const data = code.slice(0, dot);
  const sig = code.slice(dot + 1);
  const expected = createHmac("sha256", secret()).update(data).digest("base64url");
  // Constant-time compare
  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return null;
  const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as Record<string, unknown>;
  if (typeof payload.exp === "number" && payload.exp < Date.now() / 1000) return null;
  return payload;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const responseType = searchParams.get("response_type");
  const redirectUri = searchParams.get("redirect_uri");
  const state = searchParams.get("state");
  const codeChallenge = searchParams.get("code_challenge");
  const codeChallengeMethod = searchParams.get("code_challenge_method") ?? "S256";

  if (responseType !== "code" || !redirectUri) {
    return new NextResponse("Missing response_type=code or redirect_uri", { status: 400 });
  }

  // Require the user to be logged in
  const session = await auth();
  if (!session?.user?.id) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(loginUrl);
  }

  // Replace any existing "Claude Cowork" token so we don't accumulate them
  await prisma.apiToken.deleteMany({
    where: { userId: session.user.id, name: "Claude Cowork" },
  });

  const { token, tokenHash, tokenPrefix } = generateToken();
  await prisma.apiToken.create({
    data: { name: "Claude Cowork", tokenHash, tokenPrefix, userId: session.user.id },
  });

  // Pack token + PKCE challenge into a short-lived signed code
  const code = signCode({
    token,
    codeChallenge,
    codeChallengeMethod,
    exp: Math.floor(Date.now() / 1000) + 300, // 5 minutes
  });

  const callbackUrl = new URL(redirectUri);
  callbackUrl.searchParams.set("code", code);
  if (state) callbackUrl.searchParams.set("state", state);

  return NextResponse.redirect(callbackUrl);
}
