/** Relations included with task list/detail responses for the UI. */
export const TASK_INCLUDE = {
  project: { select: { id: true, name: true, color: true } },
  links: {
    select: { id: true, provider: true, url: true, externalKey: true, syncOnComplete: true, lastSyncStatus: true },
  },
  agentSessions: {
    select: { id: true, status: true, agentType: true, agentName: true, sessionUrl: true, question: true, resultSummary: true },
    orderBy: { startedAt: "desc" as const },
    take: 1,
  },
  _count: { select: { subtasks: true, comments: true } },
} as const;
