import { NextRequest, NextResponse } from "next/server";
import { CreateTaskSchema } from "@/lib/validate";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { errorResponse, sessionUserId, unauthorized } from "@/lib/http";
import { createTask, listTasks } from "@/lib/services/tasks";

export async function GET(req: NextRequest) {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();

  const p = new URL(req.url).searchParams;
  try {
    const tasks = await listTasks(userId, {
      status: p.get("status"),
      date: p.get("date"),
      source: p.get("source"),
      completedDate: p.get("completedDate"),
      completedFrom: p.get("completedFrom"),
      completedTo: p.get("completedTo"),
      q: p.get("q"),
    });
    return NextResponse.json(tasks);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();

  const limited = await rateLimit(getClientIp(req), "api");
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const parsed = CreateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const task = await createTask(userId, parsed.data);
    return NextResponse.json(task, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
