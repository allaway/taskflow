export const runtime = "nodejs";

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

export interface CalendarEventsResponse {
  events: CalendarEvent[];
  feedErrors: { name: string; error: string }[];
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
  if (feeds.length === 0) return NextResponse.json({ events: [], feedErrors: [] });

  const allEvents: CalendarEvent[] = [];
  const feedErrors: { name: string; error: string }[] = [];

  await Promise.allSettled(
    feeds.map(async (feed) => {
      try {
        // webcal:// is just http(s):// under a different scheme; node's http client won't accept it
        const normalizedUrl = feed.url.replace(/^webcal:\/\//i, "https://");

        // Enforce a per-feed timeout so one slow feed can't hang the entire request
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15_000);
        let rawIcal: string;
        try {
          const fetchRes = await fetch(normalizedUrl, { signal: controller.signal });
          clearTimeout(timeout);
          if (!fetchRes.ok) throw new Error(`HTTP ${fetchRes.status} ${fetchRes.statusText}`);
          rawIcal = await fetchRes.text();
        } catch (fetchErr) {
          clearTimeout(timeout);
          throw fetchErr instanceof Error && fetchErr.name === "AbortError"
            ? new Error("Timed out after 15 s")
            : fetchErr;
        }
        const data = ical.sync.parseICS(rawIcal);

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

          // Handle recurring events
          if (event.rrule) {
            const occurrences = event.rrule.between(rangeStart, rangeEnd, true);

            for (const occStart of occurrences) {
              const occStartStr = occStart.toISOString().replace("T", "T").split(".")[0];
              const dateKey = occStartStr.slice(0, 10);
              const dateTimeKey = occStart.toISOString();

              // Check if this occurrence is cancelled (exdate)
              if (event.exdate) {
                const exdates = Object.values(event.exdate) as Date[];
                const isCancelled = exdates.some(
                  (ex) => Math.abs(new Date(ex).getTime() - occStart.getTime()) < 1000
                );
                if (isCancelled) continue;
              }

              // Check for per-occurrence overrides (modified instances)
              const override = event.recurrences?.[dateKey] ?? event.recurrences?.[dateTimeKey];
              const effectiveStart: Date = (override?.start as Date | undefined) ?? occStart;
              const effectiveEnd: Date   = (override?.end as Date | undefined) ?? new Date(occStart.getTime() + durationMs);
              const effectiveTitle = override?.summary
                ? (typeof override.summary === "string" ? override.summary : (override.summary as { val?: string })?.val ?? title)
                : title;

              allEvents.push({
                id: `${feed.url}::${String(event.uid ?? key)}::${occStart.toISOString()}`,
                title: effectiveTitle,
                start: effectiveStart.toISOString(),
                end:   effectiveEnd.toISOString(),
                allDay,
                calendarName: feed.name,
                color: feed.color,
              });
            }
            continue; // Don't also add the base event below
          }

          // Non-recurring event
          const eventStart = new Date(event.start);
          const eventEnd   = event.end ? new Date(event.end) : new Date(eventStart.getTime() + durationMs);

          if (eventEnd < rangeStart || eventStart > rangeEnd) continue;

          allEvents.push({
            id: `${feed.url}::${String(event.uid ?? key)}`,
            title,
            start: eventStart.toISOString(),
            end:   eventEnd.toISOString(),
            allDay,
            calendarName: feed.name,
            color: feed.color,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[calendar] Failed to fetch feed "${feed.name}" (${feed.url}):`, message);
        feedErrors.push({ name: feed.name, error: message });
      }
    })
  );

  allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return NextResponse.json({ events: allEvents, feedErrors });
}
