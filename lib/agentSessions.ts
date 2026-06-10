import { prisma } from "@/lib/db";
import type { AgentActivityType, AgentSessionStatus } from "@prisma/client";

/**
 * Agent session lifecycle:
 *
 *   PENDING ──► ACTIVE ──► NEEDS_REVIEW ──► COMPLETE   (user accepts)
 *                 │  ▲           │
 *                 │  └───────────┘ (user sends work back → ACTIVE)
 *                 ├──► AWAITING_INPUT ──► ACTIVE       (user answers)
 *                 ├──► ERROR
 *                 └──► STALE  (no activity for STALE_AFTER_MS)
 *
 * Agents never complete tasks directly — they submit a result, the task moves
 * to NEEDS_REVIEW, and only the human accepting it completes the task.
 */

export const STALE_AFTER_MS = 30 * 60 * 1000; // 30 minutes without activity

const ACTIVITY_MAX = 20000;

export async function createAgentSession(opts: {
  taskId: string;
  userId: string;
  agentType: "in-app" | "claude-code" | "mcp";
  agentName?: string;
  sessionUrl?: string;
  externalSessionId?: string;
  status?: AgentSessionStatus;
}) {
  return prisma.agentSession.create({
    data: {
      taskId: opts.taskId,
      userId: opts.userId,
      agentType: opts.agentType,
      agentName: opts.agentName,
      sessionUrl: opts.sessionUrl,
      externalSessionId: opts.externalSessionId,
      status: opts.status ?? "PENDING",
    },
  });
}

/** Records a typed activity and bumps the session's liveness timestamp. */
export async function addActivity(
  sessionId: string,
  type: AgentActivityType,
  content: string,
  toolName?: string
) {
  const [activity] = await prisma.$transaction([
    prisma.agentActivity.create({
      data: { sessionId, type, content: content.slice(0, ACTIVITY_MAX), toolName },
    }),
    prisma.agentSession.update({
      where: { id: sessionId },
      data: { lastActivityAt: new Date() },
    }),
  ]);
  return activity;
}

/**
 * Agent submits its proposed result. The session and the task both move to
 * NEEDS_REVIEW — the task is NOT completed until the user accepts.
 */
export async function submitResult(sessionId: string, taskId: string, summary: string) {
  await prisma.$transaction([
    prisma.agentSession.update({
      where: { id: sessionId },
      data: { status: "NEEDS_REVIEW", resultSummary: summary.slice(0, ACTIVITY_MAX), lastActivityAt: new Date() },
    }),
    prisma.agentActivity.create({
      data: { sessionId, type: "RESULT", content: summary.slice(0, ACTIVITY_MAX) },
    }),
    prisma.task.update({
      where: { id: taskId },
      data: { status: "NEEDS_REVIEW", agentQueued: false },
    }),
  ]);
}

/** Agent asks the user a blocking question. */
export async function requestInput(sessionId: string, question: string) {
  await prisma.$transaction([
    prisma.agentSession.update({
      where: { id: sessionId },
      data: { status: "AWAITING_INPUT", question: question.slice(0, 5000), answer: null, lastActivityAt: new Date() },
    }),
    prisma.agentActivity.create({
      data: { sessionId, type: "QUESTION", content: question.slice(0, 5000) },
    }),
  ]);
}

/** User answers a pending question; session resumes. */
export async function answerQuestion(sessionId: string, answer: string) {
  await prisma.$transaction([
    prisma.agentSession.update({
      where: { id: sessionId },
      data: { status: "ACTIVE", answer: answer.slice(0, 5000), lastActivityAt: new Date() },
    }),
    prisma.agentActivity.create({
      data: { sessionId, type: "ANSWER", content: answer.slice(0, 5000) },
    }),
  ]);
}

export async function failSession(sessionId: string, message: string) {
  await prisma.$transaction([
    prisma.agentSession.update({
      where: { id: sessionId },
      data: { status: "ERROR", error: message.slice(0, 5000), endedAt: new Date() },
    }),
    prisma.agentActivity.create({
      data: { sessionId, type: "ERROR", content: message.slice(0, 5000) },
    }),
  ]);
}

/**
 * Lazily marks running sessions as STALE when they have gone quiet.
 * Called from read paths instead of a background job so it works on
 * serverless deploys without a scheduler.
 */
export async function sweepStaleSessions(userId: string) {
  const cutoff = new Date(Date.now() - STALE_AFTER_MS);
  await prisma.agentSession.updateMany({
    where: { userId, status: "ACTIVE", lastActivityAt: { lt: cutoff } },
    data: { status: "STALE" },
  });
}

/** Valid state transitions, enforced for externally-driven (MCP) updates. */
export function canTransition(from: AgentSessionStatus, to: AgentSessionStatus): boolean {
  const allowed: Record<AgentSessionStatus, AgentSessionStatus[]> = {
    PENDING: ["ACTIVE", "ERROR"],
    ACTIVE: ["AWAITING_INPUT", "NEEDS_REVIEW", "ERROR", "STALE"],
    AWAITING_INPUT: ["ACTIVE", "ERROR"],
    NEEDS_REVIEW: ["COMPLETE", "ACTIVE"],
    STALE: ["ACTIVE", "ERROR"],
    COMPLETE: [],
    ERROR: [],
  };
  return allowed[from]?.includes(to) ?? false;
}
