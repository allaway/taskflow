import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const SCOPES = "https://www.googleapis.com/auth/calendar.readonly";

function getBaseUrl(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host  = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) return `${proto}://${host}`;
  return process.env.NEXTAUTH_URL ?? "http://localhost:3000";
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId    = process.env.GOOGLE_CLIENT_ID;
  const baseUrl     = getBaseUrl(req);
  const redirectUri = `${baseUrl}/api/auth/google/callback`;
  const state       = randomBytes(32).toString("hex");

  if (!clientId) {
    return NextResponse.json({ error: "GOOGLE_CLIENT_ID not configured" }, { status: 500 });
  }

  // Only force consent re-approval (which issues a fresh refresh token) when
  // the user has no refresh token stored. Forcing it unconditionally triggers a
  // Google-side error ("Something went wrong") on testing-mode apps with
  // sensitive scopes when the user has previously authorized the app.
  const existing = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { googleRefreshToken: true },
  });
  const hasRefreshToken = !!existing?.googleRefreshToken;

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: "code",
    scope:         SCOPES,
    access_type:   "offline",
    state,
    // prompt=consent forces Google to issue a new refresh token, but causes
    // "Something went wrong" when re-authorizing with testing-mode apps.
    // Only use it on first connect (no stored refresh token).
    ...(hasRefreshToken ? {} : { prompt: "consent" }),
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  console.log("[google-oauth] redirect_uri:", redirectUri);
  console.log("[google-oauth] auth url:", authUrl);

  // Return URL as JSON — client navigates directly to avoid Next.js stripping redirect params
  const res = NextResponse.json({ url: authUrl });
  res.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    maxAge:   600,
    path:     "/",
    sameSite: "lax",
  });
  return res;
}
