export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import * as ical from "node-ical";
import type { VEvent } from "node-ical";
import type { CalendarEvent } from "@/app/api/calendar/events/route";

interface ParseFeedBody {
  icsText: string;
  feedName: string;
  feedColor: string;
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: ParseFeedBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { icsText, feedName, feedColor, start, end } = body;
  if (!icsText || !start || !end) {
    return NextResponse.json({ error: "icsText, start, end are required" }, { status: 400 });
  }

  const rangeStart = new Date(start + "T00:00:00");
  const rangeEnd   = new Date(end   + "T23:59:59");

  try {
    const data = ical.sync.parseICS(icsText);
    const events: CalendarEvent[] = [];

    for (const key in data) {
      const component = data[key];
      if (!component || component.type !== "VEVENT") continue;
      const event = component as VEvent;
      if (!event.start) continue;

      const allDay = (event as { datetype?: string }).datetype === "date";
      const title = typeof event.summary === "string"
        ? event.summary
        : (event.summary as { val?: string })?.val ?? "(No title)";

      const durationMs = event.end
        ? new Date(event.end).getTime() - new Date(event.start).getTime()
        : 0;

      if (event.rrule) {
        const occurrences = event.rrule.between(rangeStart, rangeEnd, true);
        for (const occStart of occurrences) {
          const dateKey     = occStart.toISOString().slice(0, 10);
          const dateTimeKey = occStart.toISOString();

          if (event.exdate) {
            const exdates = Object.values(event.exdate) as Date[];
            if (exdates.some((ex) => Math.abs(new Date(ex).getTime() - occStart.getTime()) < 1000)) continue;
          }

          const override = event.recurrences?.[dateKey] ?? event.recurrences?.[dateTimeKey];
          const effectiveStart: Date = (override?.start as Date | undefined) ?? occStart;
          const effectiveEnd: Date   = (override?.end   as Date | undefined) ?? new Date(occStart.getTime() + durationMs);
          const effectiveTitle = override?.summary
            ? (typeof override.summary === "string" ? override.summary : (override.summary as { val?: string })?.val ?? title)
            : title;

          events.push({
            id: `${feedName}::${String(event.uid ?? key)}::${occStart.toISOString()}`,
            title: effectiveTitle,
            start: effectiveStart.toISOString(),
            end:   effectiveEnd.toISOString(),
            allDay,
            calendarName: feedName,
            color: feedColor,
          });
        }
        continue;
      }

      const eventStart = new Date(event.start);
      const eventEnd   = event.end ? new Date(event.end) : new Date(eventStart.getTime() + durationMs);
      if (eventEnd < rangeStart || eventStart > rangeEnd) continue;

      events.push({
        id: `${feedName}::${String(event.uid ?? key)}`,
        title,
        start: eventStart.toISOString(),
        end:   eventEnd.toISOString(),
        allDay,
        calendarName: feedName,
        color: feedColor,
      });
    }

    return NextResponse.json({ events });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to parse ICS: ${message}` }, { status: 422 });
  }
}
