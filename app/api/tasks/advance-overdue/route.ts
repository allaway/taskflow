import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * POST /api/tasks/advance-overdue
 * Reschedule overdue incomplete tasks to today so they surface on the current day view.
 * daysOverdue tracks how many times a task has been slid.
 * After 5 slides it returns to inbox.
 * Called once per day from the Today page (gated by localStorage).
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  // Find all scheduled incomplete tasks with a past scheduledDate
  const overdue = await prisma.task.findMany({
    where: {
      userId,
      status: "SCHEDULED",
      scheduledDate: { lt: todayStart },
    },
  });

  const MAX_SLIDES = 5;

  await Promise.all(
    overdue.map((task) => {
      if (task.daysOverdue >= MAX_SLIDES) {
        // Returned to inbox after too many slides
        return prisma.task.update({
          where: { id: task.id },
          data: { status: "INBOX", scheduledDate: null, startTime: null, daysOverdue: 0 },
        });
      } else {
        // Reschedule to today so the task appears in the current day view
        return prisma.task.update({
          where: { id: task.id },
          data: { scheduledDate: todayStart, daysOverdue: task.daysOverdue + 1 },
        });
      }
    })
  );

  return NextResponse.json({ advanced: overdue.length });
}
