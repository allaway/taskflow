import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getOAuth2Client } from "@/lib/googleAuth";
import { encrypt } from "@/lib/crypto";
import { google } from "googleapis";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/login`);
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // User denied or something went wrong on Google's side
  if (error || !code) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/settings?tab=calendar&error=access_denied`);
  }

  // Validate state to prevent CSRF
  const storedState = req.cookies.get("google_oauth_state")?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/settings?tab=calendar&error=invalid_state`);
  }

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/settings?tab=calendar&error=missing_tokens`);
    }

    // Fetch the Google account email
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const googleEmail = userInfo.data.email ?? null;

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        googleAccessToken: encrypt(tokens.access_token),
        googleRefreshToken: encrypt(tokens.refresh_token),
        googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        googleEmail,
      },
    });

    const response = NextResponse.redirect(`${process.env.NEXTAUTH_URL}/settings?tab=calendar&connected=1`);
    // Clear the state cookie
    response.cookies.set("google_oauth_state", "", { maxAge: 0, path: "/" });
    return response;
  } catch (err) {
    console.error("[google-oauth] Callback error:", err);
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/settings?tab=calendar&error=server_error`);
  }
}
