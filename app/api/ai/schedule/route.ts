import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AiScheduleSchema } from "@/lib/validate";
import { resolveAiConfig, callAi, buildSchedulePrompt } from "@/lib/ai";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimit(getClientIp(req), "api");
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const parsed = AiScheduleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { date, workStartTime, workEndTime, timezone } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { aiProvider: true, aiApiKey: true, aiModel: true, aiSchedulingModel: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let config;
  try {
    config = resolveAiConfig(user, true);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "AI not configured";
    return NextResponse.json({ error: msg }, { status: 422 });
  }

  const tasks = await prisma.task.findMany({
    where: { userId: session.user.id, status: "INBOX" },
    select: { id: true, title: true, description: true, priority: true, duration: true },
    orderBy: { priority: "desc" },
  });

  if (tasks.length === 0) {
    return NextResponse.json({ schedule: [] });
  }

  // Fetch calendar events for the day to use as blocked slots
  const rangeStart = new Date(`${date}T00:00:00.000Z`);
  const rangeEnd   = new Date(`${date}T23:59:59.999Z`);
  const calendarEvents = await prisma.cachedCalendarEvent.findMany({
    where: {
      userId: session.user.id,
      allDay: false,
      start: { lte: rangeEnd },
      end:   { gte: rangeStart },
    },
    orderBy: { start: "asc" },
  });

  // Fetch already-scheduled tasks for the day (tasks that already have a time slot)
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd   = new Date(`${date}T23:59:59.999Z`);
  const scheduledTasks = await prisma.task.findMany({
    where: {
      userId: session.user.id,
      status: "SCHEDULED",
      scheduledDate: { gte: dayStart, lte: dayEnd },
      startTime: { not: null },
    },
    select: { title: true, startTime: true, duration: true },
  });

  // Convert calendar event UTC times to the user's local timezone
  function toLocalHHMM(utcDate: Date, tz: string): string {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(utcDate);
      const h = parts.find((p) => p.type === "hour")?.value ?? "00";
      const m = parts.find((p) => p.type === "minute")?.value ?? "00";
      return `${h}:${m}`;
    } catch {
      // Fallback to UTC if timezone is invalid
      return utcDate.toISOString().slice(11, 16);
    }
  }

  const blockedSlots: { start: string; end: string; label: string }[] = [
    ...calendarEvents.map((ev) => ({
      start: toLocalHHMM(ev.start, timezone),
      end:   toLocalHHMM(ev.end,   timezone),
      label: ev.title,
    })),
    ...scheduledTasks
      .filter((t) => t.startTime)
      .map((t) => {
        const [h, m] = t.startTime!.split(":").map(Number);
        const endMins = h * 60 + m + (t.duration ?? 30);
        const endH = Math.floor(endMins / 60).toString().padStart(2, "0");
        const endM = (endMins % 60).toString().padStart(2, "0");
        return {
          start: t.startTime!,
          end:   `${endH}:${endM}`,
          label: `${t.title} (already scheduled)`,
        };
      }),
  ].sort((a, b) => a.start.localeCompare(b.start));

  const prompt = buildSchedulePrompt(tasks, date, workStartTime, workEndTime, blockedSlots);

  let raw: string;
  try {
    raw = await callAi(config, prompt);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "AI call failed";
    return NextResponse.json({ error: `AI error: ${msg}` }, { status: 502 });
  }

  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return NextResponse.json({ error: "AI returned an unexpected format" }, { status: 502 });
  }

  let schedule: { taskId: string; startTime: string; duration: number }[];
  try {
    schedule = JSON.parse(jsonMatch[0]);
  } catch {
    return NextResponse.json({ error: "Failed to parse AI schedule response" }, { status: 502 });
  }

  const validTaskIds = new Set(tasks.map((t) => t.id));
  const validated = schedule.filter(
    (s) =>
      validTaskIds.has(s.taskId) &&
      typeof s.startTime === "string" &&
      /^\d{2}:\d{2}$/.test(s.startTime) &&
      typeof s.duration === "number"
  );

  return NextResponse.json({ schedule: validated, date });
}
