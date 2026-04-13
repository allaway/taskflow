import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";

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

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: "code",
    scope:         SCOPES,
    access_type:   "offline",
    prompt:        "consent",
    state,
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
