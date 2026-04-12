/**
 * Client-side calendar fetching.
 *
 * Google Calendar (and others) block server-side requests from cloud hosting IPs.
 * The fix: the browser fetches the raw ICS, then POSTs it to /api/calendar/parse
 * where the server does the parsing. The user's own IP downloads the file.
 */

import type { CalendarEvent } from "@/app/api/calendar/events/route";

export interface CalendarFeed {
  url: string;
  name: string;
  color: string;
}

export interface CalendarResult {
  events: CalendarEvent[];
  feedErrors: { name: string; error: string }[];
}

export async function fetchCalendarEvents(
  feeds: CalendarFeed[],
  start: string,
  end: string,
): Promise<CalendarResult> {
  if (feeds.length === 0) return { events: [], feedErrors: [] };

  const results = await Promise.allSettled(
    feeds.map(async (feed): Promise<CalendarEvent[]> => {
      const normalizedUrl = feed.url.replace(/^webcal:\/\//i, "https://");

      const fetchRes = await fetch(normalizedUrl);
      if (!fetchRes.ok) throw new Error(`HTTP ${fetchRes.status} ${fetchRes.statusText}`);
      const icsText = await fetchRes.text();

      const parseRes = await fetch("/api/calendar/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icsText, feedName: feed.name, feedColor: feed.color, start, end }),
      });
      if (!parseRes.ok) {
        const d = await parseRes.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? `Parse failed (${parseRes.status})`);
      }
      const d = await parseRes.json() as { events: CalendarEvent[] };
      return d.events;
    })
  );

  const events: CalendarEvent[] = [];
  const feedErrors: { name: string; error: string }[] = [];

  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      events.push(...result.value);
    } else {
      const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.warn(`[calendar] Feed "${feeds[i].name}" failed:`, message);
      feedErrors.push({ name: feeds[i].name, error: message });
    }
  });

  events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  return { events, feedErrors };
}

/** Fetch the user's saved feed list from settings */
export async function loadCalendarFeeds(): Promise<CalendarFeed[]> {
  const res = await fetch("/api/user/settings");
  if (!res.ok) return [];
  const data = await res.json() as { calendarFeeds?: CalendarFeed[] };
  return data.calendarFeeds ?? [];
}
