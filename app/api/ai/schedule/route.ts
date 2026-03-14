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

  const { date, workStartTime, workEndTime } = parsed.data;

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

  const prompt = buildSchedulePrompt(tasks, date, workStartTime, workEndTime);

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
