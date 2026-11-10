import type { CalendarEvent } from "@/app/api/calendar/events/route";

export interface CalendarResult {
  events: CalendarEvent[];
  feedErrors: { name: string; error: string }[];
}

/** Fetch calendar events from the DB-backed cache. Fast — no Google API call. */
export async function fetchCalendarEvents(start: string, end: string): Promise<CalendarResult> {
  try {
    const res = await fetch(`/api/calendar/events?start=${start}&end=${end}`);
    if (!res.ok) return { events: [], feedErrors: [] };
    return res.json();
  } catch {
    return { events: [], feedErrors: [] };
  }
}
