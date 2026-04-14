import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { google } from "googleapis";

function getBaseUrl(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host  = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) return `${proto}://${host}`;
  return process.env.NEXTAUTH_URL ?? "http://localhost:3000";
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(`${getBaseUrl(req)}/login`);
  }

  const { searchParams } = new URL(req.url);
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl     = getBaseUrl(req);
  const settingsUrl = `${baseUrl}/settings?tab=calendar`;

  if (error || !code) {
    return NextResponse.redirect(`${settingsUrl}&error=access_denied`);
  }

  const storedState = req.cookies.get("google_oauth_state")?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(`${settingsUrl}&error=invalid_state`);
  }

  try {
    const redirectUri  = `${baseUrl}/api/auth/google/callback`;
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri,
    );

    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      return NextResponse.redirect(`${settingsUrl}&error=missing_tokens`);
    }

    // Fetch the existing refresh token if Google didn't return a new one
    // (happens when prompt=consent is omitted and user already granted offline access)
    let refreshToken = tokens.refresh_token;
    if (!refreshToken) {
      const existing = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { googleRefreshToken: true },
      });
      refreshToken = existing?.googleRefreshToken
        ? existing.googleRefreshToken  // already encrypted, re-use as-is
        : null;
      // If we truly have no refresh token, we need re-consent
      if (!refreshToken) {
        return NextResponse.redirect(`${settingsUrl}&error=missing_tokens`);
      }
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        googleAccessToken:  encrypt(tokens.access_token),
        // Only overwrite refresh token if Google issued a new one
        ...(tokens.refresh_token ? { googleRefreshToken: encrypt(tokens.refresh_token) } : {}),
        googleTokenExpiry:  tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        googleEmail:        null,
      },
    });

    const response = NextResponse.redirect(`${settingsUrl}&connected=1`);
    response.cookies.set("google_oauth_state", "", { maxAge: 0, path: "/" });
    return response;
  } catch (err) {
    console.error("[google-oauth] Callback error:", err);
    return NextResponse.redirect(`${settingsUrl}&error=server_error`);
  }
}
