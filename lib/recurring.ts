import { prisma } from "@/lib/db";
import { addDays, startOfDay, format } from "date-fns";

/**
 * Parses a simple cron-like rule and returns the next N occurrence dates.
 * Supports a subset of cron: "DAILY", "WEEKLY:MON", "WEEKLY:TUE", etc.
 * and ISO weekday numbers for weekly patterns.
 *
 * Examples:
 *   "DAILY"      → every day
 *   "WEEKLY:1"   → every Monday (1=Mon, 7=Sun)
 *   "WEEKLY:MON" → every Monday
 */
export function getNextOccurrences(rule: string, from: Date, count: number): Date[] {
  const dates: Date[] = [];
  const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  let current = startOfDay(from);

  if (rule === "DAILY") {
    for (let i = 0; i < count; i++) {
      current = addDays(current, 1);
      dates.push(current);
    }
    return dates;
  }

  if (rule.startsWith("WEEKLY:")) {
    const dayPart = rule.split(":")[1].toUpperCase();
    let targetDay: number;

    if (/^\d$/.test(dayPart)) {
      targetDay = parseInt(dayPart) % 7;
    } else {
      targetDay = dayNames.indexOf(dayPart);
      if (targetDay === -1) return dates;
    }

    let attempts = 0;
    while (dates.length < count && attempts < 365) {
      current = addDays(current, 1);
      attempts++;
      if (current.getDay() === targetDay) {
        dates.push(current);
      }
    }
    return dates;
  }

  return dates;
}

/**
 * Generates upcoming task instances for all recurring tasks.
 * Called daily by a cron job or API route.
 */
export async function generateRecurringTasks(daysAhead = 7): Promise<number> {
  const recurringTasks = await prisma.task.findMany({
    where: { recurringRule: { not: null }, source: "RECURRING" },
    select: { id: true, title: true, description: true, notes: true, priority: true, duration: true, recurringRule: true, userId: true, startTime: true },
  });

  let created = 0;

  for (const template of recurringTasks) {
    if (!template.recurringRule) continue;

    const occurrences = getNextOccurrences(template.recurringRule, new Date(), daysAhead);

    for (const date of occurrences) {
      const dateStr = format(date, "yyyy-MM-dd");
      const externalId = `recurring-${template.id}-${dateStr}`;

      try {
        await prisma.task.create({
          data: {
            title: template.title,
            description: template.description,
            notes: template.notes,
            priority: template.priority,
            duration: template.duration,
            startTime: template.startTime,
            scheduledDate: date,
            status: template.startTime ? "SCHEDULED" : "INBOX",
            source: "RECURRING",
            externalId,
            userId: template.userId,
          },
        });
        created++;
      } catch {
        // Unique constraint violation = already created, skip
      }
    }
  }

  return created;
}
