export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;       // ISO string
  end: string;         // ISO string
  allDay: boolean;
  calendarName: string;
  color: string;
  description?: string;
  location?: string;
  meetLink?: string;
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

  const rangeStart = new Date(`${startParam}T00:00:00Z`);
  const rangeEnd   = new Date(`${endParam}T23:59:59Z`);

  const rows = await prisma.cachedCalendarEvent.findMany({
    where: {
      userId: session.user.id,
      start:  { lte: rangeEnd },
      end:    { gte: rangeStart },
    },
    orderBy: { start: "asc" },
  });

  const events: CalendarEvent[] = rows.map((row) => ({
    id:           row.id,
    title:        row.title,
    start:        row.start.toISOString(),
    end:          row.end.toISOString(),
    allDay:       row.allDay,
    calendarName: row.calendarName,
    color:        row.color,
    description:  row.description ?? undefined,
    location:     row.location    ?? undefined,
    meetLink:     row.meetLink    ?? undefined,
  }));

  return NextResponse.json({ events, feedErrors: [] });
}
