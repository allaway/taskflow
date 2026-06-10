import type { Task, AgentSessionStatus, TaskLinkProvider } from "@prisma/client";

/** Shape returned by the tasks API — Task plus the relations the UI renders. */
export interface TaskMeta {
  project?: { id: string; name: string; color: string } | null;
  links?: {
    id: string;
    provider: TaskLinkProvider;
    url: string;
    externalKey: string;
    syncOnComplete: boolean;
    lastSyncStatus: string | null;
  }[];
  agentSessions?: {
    id: string;
    status: AgentSessionStatus;
    agentType: string;
    agentName: string | null;
    sessionUrl: string | null;
    question: string | null;
    resultSummary: string | null;
  }[];
  _count?: { subtasks: number; comments: number };
}

export type TaskWithMeta = Task & TaskMeta;

export interface AgentActivityEntry {
  id: string;
  type: "THOUGHT" | "ACTION" | "QUESTION" | "ANSWER" | "RESULT" | "ERROR";
  content: string;
  toolName: string | null;
  createdAt: string;
}

export interface AgentSessionDetail {
  id: string;
  taskId: string;
  status: AgentSessionStatus;
  agentType: string;
  agentName: string | null;
  sessionUrl: string | null;
  question: string | null;
  answer: string | null;
  resultSummary: string | null;
  reviewFeedback: string | null;
  error: string | null;
  startedAt: string;
  lastActivityAt: string;
  activities: AgentActivityEntry[];
  task?: { id: string; title: string; status: string };
}
