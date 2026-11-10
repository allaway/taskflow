/**
 * Task service — the one place task rules live. The REST routes, the tool
 * registry (MCP + in-app assistant) and the planner all go through here.
 */
import { prisma } from "@/lib/db";
import type { Prisma, Task } from "@prisma/client";

export class ServiceError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Accepts "YYYY-MM-DD" or a full ISO datetime. A bare day is stored at noon UTC
 * so it falls inside that day's UTC range whatever the caller's timezone.
 */
export function parseScheduledDate(value: string): Date {
  const d = new Date(DAY_RE.test(value) ? `${value}T12:00:00.000Z` : value);
  if (Number.isNaN(d.getTime())) throw new ServiceError(`Invalid date: ${value}`);
  return d;
}

export function dayRange(day: string): { gte: Date; lt: Date } {
  const gte = new Date(`${day}T00:00:00.000Z`);
  if (!DAY_RE.test(day) || Number.isNaN(gte.getTime())) {
    throw new ServiceError("date must be YYYY-MM-DD");
  }
  return { gte, lt: new Date(gte.getTime() + 24 * 60 * 60 * 1000) };
}

function assertNotPast(date: Date) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (date < today) throw new ServiceError("scheduledDate cannot be in the past");
}

export interface TaskFilter {
  status?: string | null;
  date?: string | null;
  source?: string | null;
  completedDate?: string | null;
  completedFrom?: string | null;
  completedTo?: string | null;
  q?: string | null;
  agentQueued?: boolean;
}

export async function listTasks(userId: string, filter: TaskFilter = {}): Promise<Task[]> {
  const where: Prisma.TaskWhereInput = { userId };
  if (filter.status) where.status = filter.status as Task["status"];
  if (filter.source) where.source = filter.source as Task["source"];
  if (filter.date) where.scheduledDate = dayRange(filter.date);
  if (filter.completedDate) where.completedAt = dayRange(filter.completedDate);
  if (filter.completedFrom || filter.completedTo) {
    where.completedAt = {
      ...(filter.completedFrom ? { gte: dayRange(filter.completedFrom).gte } : {}),
      ...(filter.completedTo ? { lt: dayRange(filter.completedTo).gte } : {}),
    };
  }
  if (filter.agentQueued !== undefined) where.agentQueued = filter.agentQueued;
  if (filter.q) {
    where.OR = [
      { title: { contains: filter.q, mode: "insensitive" } },
      { description: { contains: filter.q, mode: "insensitive" } },
      { notes: { contains: filter.q, mode: "insensitive" } },
    ];
  }
  return prisma.task.findMany({ where, orderBy: [{ priority: "desc" }, { createdAt: "asc" }] });
}

export async function getTask(userId: string, id: string): Promise<Task> {
  const task = await prisma.task.findFirst({ where: { id, userId } });
  if (!task) throw new ServiceError("Task not found", 404);
  return task;
}

export interface TaskInput {
  title: string;
  description?: string | null;
  notes?: string | null;
  priority?: Task["priority"];
  scheduledDate?: string | null;
  startTime?: string | null;
  duration?: number | null;
  parallel?: boolean;
  recurringRule?: string | null;
}

export interface WriteOptions {
  /** Reject scheduling into the past (callers that take dates from outside). */
  rejectPast?: boolean;
}

export async function createTask(
  userId: string,
  input: TaskInput,
  source: Task["source"] = "MANUAL",
  opts: WriteOptions = {}
): Promise<Task> {
  const scheduledDate = input.scheduledDate ? parseScheduledDate(input.scheduledDate) : null;
  if (scheduledDate && opts.rejectPast) assertNotPast(scheduledDate);
  return prisma.task.create({
    data: {
      title: input.title.slice(0, 500),
      description: input.description || null,
      notes: input.notes || null,
      priority: input.priority ?? "MEDIUM",
      scheduledDate,
      startTime: input.startTime || null,
      duration: input.duration ?? null,
      parallel: input.parallel ?? false,
      recurringRule: input.recurringRule || null,
      status: scheduledDate ? "SCHEDULED" : "INBOX",
      source,
      userId,
    },
  });
}

export interface TaskPatch {
  title?: string;
  description?: string | null;
  notes?: string | null;
  priority?: Task["priority"];
  status?: Task["status"];
  scheduledDate?: string | null;
  startTime?: string | null;
  duration?: number | null;
  parallel?: boolean;
  recurringRule?: string | null;
  labels?: string[] | null;
  agentQueued?: boolean;
}

export async function updateTask(
  userId: string,
  id: string,
  patch: TaskPatch,
  opts: WriteOptions = {}
): Promise<Task> {
  const existing = await getTask(userId, id);

  // Explicit allowlist — callers can never touch userId, source, completedAt, etc.
  const data: Prisma.TaskUpdateInput = {};
  if (patch.title !== undefined) data.title = patch.title.slice(0, 500);
  if (patch.description !== undefined) data.description = patch.description || null;
  if (patch.notes !== undefined) data.notes = patch.notes || null;
  if (patch.priority !== undefined) data.priority = patch.priority;
  if (patch.startTime !== undefined) data.startTime = patch.startTime || null;
  if (patch.duration !== undefined) data.duration = patch.duration ?? null;
  if (patch.parallel !== undefined) data.parallel = patch.parallel;
  if (patch.recurringRule !== undefined) data.recurringRule = patch.recurringRule || null;
  if (patch.agentQueued !== undefined) data.agentQueued = patch.agentQueued;
  if (patch.labels !== undefined) {
    data.labels = patch.labels && patch.labels.length > 0 ? JSON.stringify(patch.labels) : null;
  }

  let scheduledDate = existing.scheduledDate;
  if (patch.scheduledDate !== undefined) {
    scheduledDate = patch.scheduledDate ? parseScheduledDate(patch.scheduledDate) : null;
    if (scheduledDate && opts.rejectPast) assertNotPast(scheduledDate);
    data.scheduledDate = scheduledDate;
  }

  if (patch.status !== undefined) {
    if (patch.status === "SCHEDULED" && !scheduledDate) {
      throw new ServiceError("scheduledDate required when setting status to SCHEDULED");
    }
    data.status = patch.status;
    if (patch.status === "COMPLETED" && existing.status !== "COMPLETED") {
      data.completedAt = new Date();
      data.agentQueued = false;
    } else if (patch.status !== "COMPLETED" && existing.status === "COMPLETED") {
      data.completedAt = null;
    }
  }

  return prisma.task.update({ where: { id }, data });
}

export async function deleteTask(userId: string, id: string): Promise<void> {
  await getTask(userId, id);
  await prisma.task.delete({ where: { id } });
}
