/**
 * Threads: conversations that belong to the user. AGENT threads hang off a task
 * and collect delegated work wherever it runs; the ASSISTANT thread is the
 * daily in-app chat. Running a model turn lives in threadRunner.ts.
 */
import { prisma } from "@/lib/db";
import type { Thread, ThreadMessage } from "@prisma/client";
import { ServiceError } from "@/lib/services/tasks";

export type ThreadWithMessages = Thread & {
  messages: ThreadMessage[];
  task: { id: string; title: string } | null;
};

export const THREAD_PROVIDERS = ["taskflow", "claude", "claude-code", "codex", "gemini", "other"] as const;

export async function listThreads(
  userId: string,
  filter: { taskId?: string | null; status?: Thread["status"] | null } = {}
) {
  return prisma.thread.findMany({
    where: {
      userId,
      kind: "AGENT",
      ...(filter.taskId ? { taskId: filter.taskId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
    },
    include: { task: { select: { id: true, title: true } }, _count: { select: { messages: true } } },
    orderBy: { lastActivityAt: "desc" },
    take: 100,
  });
}

export async function getThread(userId: string, id: string): Promise<ThreadWithMessages> {
  const thread = await prisma.thread.findFirst({
    where: { id, userId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      task: { select: { id: true, title: true } },
    },
  });
  if (!thread) throw new ServiceError("Thread not found", 404);
  return thread;
}

export interface AgentThreadInput {
  taskId: string;
  title?: string | null;
  provider?: string | null;
  url?: string | null;
  externalId?: string | null;
  status?: Thread["status"];
}

export async function createAgentThread(userId: string, input: AgentThreadInput): Promise<Thread> {
  const task = await prisma.task.findFirst({ where: { id: input.taskId, userId }, select: { title: true } });
  if (!task) throw new ServiceError("Task not found", 404);
  if (input.url && !/^https?:\/\//i.test(input.url)) {
    throw new ServiceError("url must start with http:// or https://");
  }
  return prisma.thread.create({
    data: {
      kind: "AGENT",
      provider: (input.provider || "taskflow").toLowerCase().slice(0, 40),
      title: (input.title?.trim() || task.title).slice(0, 300),
      url: input.url || null,
      externalId: input.externalId || null,
      status: input.status ?? "ACTIVE",
      taskId: input.taskId,
      userId,
    },
  });
}

export async function updateThread(
  userId: string,
  id: string,
  patch: { title?: string; url?: string | null; status?: Thread["status"]; summary?: string | null }
): Promise<Thread> {
  const existing = await prisma.thread.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) throw new ServiceError("Thread not found", 404);
  if (patch.url && !/^https?:\/\//i.test(patch.url)) {
    throw new ServiceError("url must start with http:// or https://");
  }
  return prisma.thread.update({
    where: { id },
    data: {
      ...(patch.title !== undefined ? { title: patch.title.slice(0, 300) } : {}),
      ...(patch.url !== undefined ? { url: patch.url || null } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.summary !== undefined ? { summary: patch.summary?.slice(0, 500) || null } : {}),
    },
  });
}

export async function deleteThread(userId: string, id: string): Promise<void> {
  const existing = await prisma.thread.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) throw new ServiceError("Thread not found", 404);
  await prisma.thread.delete({ where: { id } });
}

export async function addMessage(
  threadId: string,
  role: "user" | "agent" | "system",
  content: string,
  threadPatch: { status?: Thread["status"]; summary?: string | null } = {}
): Promise<ThreadMessage> {
  const [message] = await prisma.$transaction([
    prisma.threadMessage.create({ data: { threadId, role, content: content.slice(0, 50000) } }),
    prisma.thread.update({
      where: { id: threadId },
      data: { lastActivityAt: new Date(), ...threadPatch },
    }),
  ]);
  return message;
}

/**
 * An agent working somewhere else (Claude Code, Codex, a routine…) reports into
 * its thread. When it finishes or needs the user, that surfaces in Catch-up.
 */
export async function postAgentUpdate(
  userId: string,
  threadId: string,
  update: { content: string; status?: Thread["status"]; summary?: string | null }
): Promise<Thread> {
  const thread = await getThread(userId, threadId);
  if (thread.kind !== "AGENT") throw new ServiceError("Not an agent thread");
  const message = await addMessage(threadId, "agent", update.content, {
    ...(update.status ? { status: update.status } : {}),
    ...(update.summary !== undefined
      ? { summary: update.summary?.slice(0, 500) || null }
      : { summary: update.content.replace(/\s+/g, " ").slice(0, 200) }),
  });

  if (update.status === "WAITING" || update.status === "DONE") {
    await prisma.catchUpItem.create({
      data: {
        userId,
        source: "agent",
        title:
          update.status === "WAITING"
            ? `Needs you: ${thread.title}`
            : `Finished: ${thread.title}`,
        body: update.content.slice(0, 20000),
        url: thread.url,
        author: thread.provider,
        externalId: `thread-${threadId}-${message.id}`,
        relevance: update.status === "WAITING" ? 85 : 65,
        reason:
          update.status === "WAITING"
            ? "An agent is blocked until you reply"
            : "An agent finished work you delegated",
      },
    });
  }
  return prisma.thread.findUniqueOrThrow({ where: { id: threadId } });
}

/** The assistant chat for a given day, created on first use. */
export async function getAssistantThread(
  userId: string,
  date: string,
  create: boolean
): Promise<ThreadWithMessages | null> {
  const include = {
    messages: { orderBy: { createdAt: "asc" as const } },
    task: { select: { id: true, title: true } },
  };
  const where = { userId_kind_date: { userId, kind: "ASSISTANT" as const, date } };
  const existing = await prisma.thread.findUnique({ where, include });
  if (existing || !create) return existing;
  return prisma.thread.upsert({
    where,
    update: {},
    create: { userId, kind: "ASSISTANT", date, title: `Assistant — ${date}` },
    include,
  });
}
