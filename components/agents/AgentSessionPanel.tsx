"use client";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AgentBadge } from "./AgentBadge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Brain,
  Wrench,
  HelpCircle,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { AgentSessionDetail, AgentActivityEntry } from "@/lib/types";

const ACTIVITY_ICON: Record<AgentActivityEntry["type"], React.ReactNode> = {
  THOUGHT: <Brain className="h-3.5 w-3.5 text-muted-foreground/60" />,
  ACTION: <Wrench className="h-3.5 w-3.5 text-primary/70" />,
  QUESTION: <HelpCircle className="h-3.5 w-3.5 text-amber-600" />,
  ANSWER: <MessageSquare className="h-3.5 w-3.5 text-blue-600" />,
  RESULT: <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />,
  ERROR: <AlertCircle className="h-3.5 w-3.5 text-rose-600" />,
};

export function SessionCard({
  session,
  onChanged,
  titlePrefix,
}: {
  session: AgentSessionDetail;
  onChanged: () => void;
  titlePrefix?: string;
}) {
  const [expanded, setExpanded] = useState(
    ["ACTIVE", "AWAITING_INPUT", "NEEDS_REVIEW"].includes(session.status)
  );
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [sendingBack, setSendingBack] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resuming, setResuming] = useState(false);

  // In-app sessions don't run anywhere after an answer/send-back — the loop
  // must be re-invoked. Streams in the background; the polling thread shows progress.
  async function resumeInApp() {
    setResuming(true);
    try {
      const res = await fetch(`/api/tasks/${session.taskId}/run-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id }),
      });
      if (!res.ok) {
        toast.error(await res.text());
      } else {
        toast.success("Agent resumed");
        // Drain the SSE stream so the server keeps running; UI updates via polling
        res.body?.pipeTo(new WritableStream()).catch(() => {});
      }
    } catch {
      toast.error("Failed to resume agent");
    }
    setResuming(false);
    onChanged();
  }

  async function submitAnswer() {
    if (!answer.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/agent-sessions/${session.id}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer: answer.trim() }),
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Answer sent to agent");
      setAnswer("");
      onChanged();
    } else {
      const err = await res.json().catch(() => null);
      toast.error(err?.error ?? "Failed to send answer");
    }
  }

  async function review(action: "accept" | "send_back") {
    setBusy(true);
    const res = await fetch(`/api/agent-sessions/${session.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, feedback: feedback.trim() || undefined }),
    });
    setBusy(false);
    if (res.ok) {
      const data = await res.json();
      if (action === "accept") {
        toast.success("Accepted — task completed");
        const failed = (data.linkSync ?? []).filter((s: { ok: boolean }) => !s.ok);
        for (const f of failed) {
          toast.error(`Could not resolve ${f.provider} link ${f.externalKey}: ${f.error}`);
        }
        const synced = (data.linkSync ?? []).filter((s: { ok: boolean }) => s.ok);
        if (synced.length > 0) toast.success(`Resolved ${synced.length} linked issue(s)`);
      } else {
        toast.success("Sent back to agent with feedback");
      }
      setSendingBack(false);
      setFeedback("");
      onChanged();
    } else {
      const err = await res.json().catch(() => null);
      toast.error(err?.error ?? "Review action failed");
    }
  }

  return (
    <div className="rounded-lg border border-border/50 bg-muted/20" data-testid="agent-session">
      {/* Header */}
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
        )}
        <AgentBadge status={session.status} />
        <span className="text-xs text-muted-foreground truncate flex-1">
          {titlePrefix && <span className="font-medium text-foreground/80">{titlePrefix} · </span>}
          {session.agentName ?? session.agentType} · {new Date(session.startedAt).toLocaleString()}
        </span>
        {session.sessionUrl && (
          <a
            href={session.sessionUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-[11px] text-primary hover:underline shrink-0"
          >
            <ExternalLink className="h-3 w-3" />
            Watch live
          </a>
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {/* Activity thread */}
          {session.activities.length > 0 && (
            <div className="space-y-1.5 max-h-64 overflow-y-auto rounded-md bg-background/60 border border-border/40 px-2.5 py-2">
              {session.activities.map((a) => (
                <div key={a.id} className="flex items-start gap-2 text-xs">
                  <span className="mt-0.5 shrink-0">{ACTIVITY_ICON[a.type]}</span>
                  <div className="min-w-0 flex-1">
                    {a.toolName && (
                      <span className="font-medium text-muted-foreground mr-1.5">{a.toolName}</span>
                    )}
                    <span
                      className={cn(
                        "whitespace-pre-wrap break-words",
                        a.type === "THOUGHT" ? "text-muted-foreground" : "text-foreground/90"
                      )}
                    >
                      {a.content.length > 600 ? a.content.slice(0, 600) + "…" : a.content}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {session.error && (
            <p className="text-xs text-rose-600 flex items-start gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {session.error}
            </p>
          )}

          {/* In-app session waiting to be re-run after an answer or send-back */}
          {session.agentType === "in-app" &&
            ["ACTIVE", "STALE"].includes(session.status) &&
            (session.answer || session.reviewFeedback) && (
              <Button size="sm" variant="outline" onClick={resumeInApp} disabled={resuming}>
                {resuming ? "Resuming…" : "Resume agent"}
              </Button>
            )}

          {/* Awaiting input: answer box */}
          {session.status === "AWAITING_INPUT" && session.question && (
            <div className="rounded-md border border-amber-300 bg-amber-50/60 dark:bg-amber-950/20 p-2.5 space-y-2">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                The agent is asking:
              </p>
              <p className="text-sm whitespace-pre-wrap">{session.question}</p>
              <Textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type your answer…"
                rows={2}
                className="text-sm bg-background"
                data-testid="agent-answer-input"
              />
              <Button size="sm" onClick={submitAnswer} disabled={busy || !answer.trim()}>
                Send answer
              </Button>
            </div>
          )}

          {/* Needs review: accept / send back */}
          {session.status === "NEEDS_REVIEW" && (
            <div className="rounded-md border border-orange-300 bg-orange-50/60 dark:bg-orange-950/20 p-2.5 space-y-2">
              <p className="text-xs font-medium text-orange-800 dark:text-orange-300">
                The agent submitted its work for your review:
              </p>
              {session.resultSummary && (
                <p className="text-sm whitespace-pre-wrap">{session.resultSummary}</p>
              )}
              {sendingBack ? (
                <>
                  <Textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="What should the agent change?"
                    rows={2}
                    className="text-sm bg-background"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => review("send_back")} disabled={busy}>
                      Send back with feedback
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setSendingBack(false)}>
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => review("accept")} disabled={busy} data-testid="accept-agent-work">
                    Accept &amp; complete task
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setSendingBack(true)} disabled={busy}>
                    Send back
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The agent thread for a task: every delegation session with its typed
 * activity feed, plus the human-in-the-loop controls (answer questions,
 * accept or send back submitted work).
 */
export function AgentSessionPanel({
  taskId,
  onTaskChanged,
}: {
  taskId: string;
  onTaskChanged?: () => void;
}) {
  const [sessions, setSessions] = useState<AgentSessionDetail[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/agent-sessions?taskId=${taskId}`);
    if (res.ok) setSessions(await res.json());
    setLoaded(true);
  }, [taskId]);

  useEffect(() => {
    refresh();
    // Light polling while a session is live so progress appears without reload
    const interval = setInterval(() => {
      refresh();
    }, 10000);
    return () => clearInterval(interval);
  }, [refresh]);

  if (!loaded || sessions.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
        Agent activity
      </p>
      {sessions.map((s) => (
        <SessionCard
          key={s.id}
          session={s}
          onChanged={() => {
            refresh();
            onTaskChanged?.();
          }}
        />
      ))}
    </div>
  );
}
