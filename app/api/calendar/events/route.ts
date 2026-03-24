import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import * as ical from "node-ical";
import type { VEvent } from "node-ical";
import type { CalendarFeed } from "@/lib/validate";

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;       // ISO string
  end: string;         // ISO string
  allDay: boolean;
  calendarName: string;
  color: string;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const startParam = searchParams.get("start"); // YYYY-MM-DD
  const endParam = searchParams.get("end");     // YYYY-MM-DD

  if (!startParam || !endParam) {
    return NextResponse.json({ error: "start and end are required" }, { status: 400 });
  }

  const rangeStart = new Date(startParam + "T00:00:00");
  const rangeEnd   = new Date(endParam   + "T23:59:59");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { calendarFeeds: true },
  });

  const feeds: CalendarFeed[] = user?.calendarFeeds ? JSON.parse(user.calendarFeeds) : [];
  if (feeds.length === 0) return NextResponse.json([]);

  const allEvents: CalendarEvent[] = [];

  await Promise.allSettled(
    feeds.map(async (feed) => {
      try {
        const data = await ical.async.fromURL(feed.url);

        for (const key in data) {
          const component = data[key];
          if (!component || component.type !== "VEVENT") continue;
          const event = component as VEvent;

          const start = event.start;
          const end   = event.end ?? event.start;
          if (!start) continue;

          const eventStart = new Date(start);
          const eventEnd   = new Date(end);

          // Detect all-day: node-ical sets datetype="date" for VALUE=DATE
          const allDay = (event as { datetype?: string }).datetype === "date";

          // Skip events outside the requested range
          if (eventEnd < rangeStart || eventStart > rangeEnd) continue;

          allEvents.push({
            id: `${feed.url}::${String(event.uid ?? key)}`,
            title: typeof event.summary === "string" ? event.summary : (event.summary as { val?: string })?.val ?? "(No title)",
            start: eventStart.toISOString(),
            end:   eventEnd.toISOString(),
            allDay,
            calendarName: feed.name,
            color: feed.color,
          });
        }
      } catch {
        // Silently skip feeds that fail (bad URL, network error, etc.)
      }
    })
  );

  // Sort by start time
  allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return NextResponse.json(allEvents);
}
