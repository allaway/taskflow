export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getOAuth2Client } from "@/lib/googleAuth";
import { decrypt, encrypt } from "@/lib/crypto";
import { google } from "googleapis";

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;       // ISO string
  end: string;         // ISO string
  allDay: boolean;
  calendarName: string;
  color: string;
}

export interface CalendarEventsResponse {
  events: CalendarEvent[];
  feedErrors: { name: string; error: string }[];
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const startParam = searchParams.get("start"); // YYYY-MM-DD
  const endParam   = searchParams.get("end");   // YYYY-MM-DD

  if (!startParam || !endParam) {
    return NextResponse.json({ error: "start and end are required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      googleAccessToken: true,
      googleRefreshToken: true,
      googleTokenExpiry: true,
    },
  });

  if (!user?.googleAccessToken || !user?.googleRefreshToken) {
    return NextResponse.json({ events: [], feedErrors: [] });
  }

  try {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      access_token:  decrypt(user.googleAccessToken),
      refresh_token: decrypt(user.googleRefreshToken),
      expiry_date:   user.googleTokenExpiry?.getTime(),
    });

    // Persist refreshed tokens automatically
    const userId = session.user!.id!;
    oauth2Client.on("tokens", async (tokens) => {
      await prisma.user.update({
        where: { id: userId },
        data: {
          ...(tokens.access_token  ? { googleAccessToken:  encrypt(tokens.access_token)  } : {}),
          ...(tokens.refresh_token ? { googleRefreshToken: encrypt(tokens.refresh_token) } : {}),
          ...(tokens.expiry_date   ? { googleTokenExpiry:  new Date(tokens.expiry_date)  } : {}),
        },
      });
    });

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    // Fetch all calendars the user has
    const calListRes = await calendar.calendarList.list({ minAccessRole: "reader" });
    const calendars  = calListRes.data.items ?? [];

    const allEvents: CalendarEvent[] = [];
    const feedErrors: { name: string; error: string }[] = [];

    await Promise.allSettled(
      calendars.map(async (cal) => {
        try {
          const eventsRes = await calendar.events.list({
            calendarId:    cal.id!,
            timeMin:       `${startParam}T00:00:00Z`,
            timeMax:       `${endParam}T23:59:59Z`,
            singleEvents:  true,  // expands recurring events — no rrule handling needed
            orderBy:       "startTime",
            maxResults:    500,
          });

          const color = cal.backgroundColor ?? "#6366f1";
          const name  = cal.summary ?? "Calendar";

          for (const event of eventsRes.data.items ?? []) {
            if (!event.start) continue;
            const allDay = !event.start.dateTime;
            allEvents.push({
              id:           event.id ?? `${cal.id}-${Math.random()}`,
              title:        event.summary ?? "(No title)",
              start:        event.start.dateTime ?? `${event.start.date}T00:00:00`,
              end:          event.end?.dateTime ?? (event.end?.date ? `${event.end.date}T00:00:00` : null) ?? event.start.dateTime ?? "",
              allDay,
              calendarName: name,
              color,
            });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          feedErrors.push({ name: cal.summary ?? cal.id ?? "Calendar", error: msg });
        }
      })
    );

    allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    return NextResponse.json({ events: allEvents, feedErrors });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[calendar] Google Calendar API error:", msg);
    return NextResponse.json({ events: [], feedErrors: [{ name: "Google Calendar", error: msg }] });
  }
}
