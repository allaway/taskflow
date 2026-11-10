export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getOAuth2Client } from "@/lib/googleAuth";
import { decrypt, encrypt } from "@/lib/crypto";
import { google } from "googleapis";
import { addDays, subDays, startOfDay } from "date-fns";

const SYNC_STALENESS_MS = 15 * 60 * 1000; // 15 minutes
const SYNC_RANGE_PAST_DAYS   = 7;
const SYNC_RANGE_FUTURE_DAYS = 90;

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      googleAccessToken:  true,
      googleRefreshToken: true,
      googleTokenExpiry:  true,
      calendarSyncedAt:   true,
    },
  });

  if (!user?.googleAccessToken || !user?.googleRefreshToken) {
    return NextResponse.json({ skipped: true, reason: "not_connected" });
  }

  // Skip if synced recently
  if (user.calendarSyncedAt && Date.now() - user.calendarSyncedAt.getTime() < SYNC_STALENESS_MS) {
    return NextResponse.json({ skipped: true, reason: "fresh" });
  }

  const userId = session.user.id;

  try {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      access_token:  decrypt(user.googleAccessToken),
      refresh_token: decrypt(user.googleRefreshToken),
      expiry_date:   user.googleTokenExpiry?.getTime(),
    });

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

    const calListRes = await calendar.calendarList.list({ minAccessRole: "reader" });
    const calendars  = calListRes.data.items ?? [];

    const rangeStart = subDays(startOfDay(new Date()), SYNC_RANGE_PAST_DAYS);
    const rangeEnd   = addDays(startOfDay(new Date()), SYNC_RANGE_FUTURE_DAYS);

    const allEvents: {
      id: string;
      userId: string;
      title: string;
      start: Date;
      end: Date;
      allDay: boolean;
      calendarName: string;
      color: string;
      description?: string;
      location?: string;
      meetLink?: string;
    }[] = [];

    await Promise.allSettled(
      calendars.map(async (cal) => {
        try {
          const eventsRes = await calendar.events.list({
            calendarId:   cal.id!,
            timeMin:      rangeStart.toISOString(),
            timeMax:      rangeEnd.toISOString(),
            singleEvents: true,
            orderBy:      "startTime",
            maxResults:   500,
          });

          const color = cal.backgroundColor ?? "#6366f1";
          const name  = cal.summary ?? "Calendar";

          for (const event of eventsRes.data.items ?? []) {
            if (!event.start) continue;
            const allDay   = !event.start.dateTime;
            const startStr = event.start.dateTime ?? `${event.start.date}T00:00:00Z`;
            const endStr   = event.end?.dateTime  ?? (event.end?.date ? `${event.end.date}T00:00:00Z` : startStr);

            const meetLink = event.conferenceData?.entryPoints
              ?.find((ep) => ep.entryPointType === "video")
              ?.uri ?? undefined;

            const rawDesc   = event.description ?? undefined;
            const description = rawDesc
              ? rawDesc.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim() || undefined
              : undefined;

            const googleEventId = event.id ?? `${cal.id}-${Math.random()}`;

            allEvents.push({
              id:           `${userId}:${googleEventId}`,
              userId,
              title:        event.summary ?? "(No title)",
              start:        new Date(startStr),
              end:          new Date(endStr),
              allDay,
              calendarName: name,
              color,
              description,
              location:     event.location ?? undefined,
              meetLink,
            });
          }
        } catch {
          // Skip calendars that fail; don't abort the whole sync
        }
      })
    );

    // Replace all cached events for this user with the fresh data
    await prisma.$transaction([
      prisma.cachedCalendarEvent.deleteMany({ where: { userId } }),
      prisma.cachedCalendarEvent.createMany({ data: allEvents, skipDuplicates: true }),
      prisma.user.update({
        where: { id: userId },
        data:  { calendarSyncedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ synced: allEvents.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[calendar-sync] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
