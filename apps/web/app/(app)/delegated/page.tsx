"use client";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Bot, CheckCircle2, ExternalLink, SquarePen } from "lucide-react";
import { toast } from "sonner";
import type { Task } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { TaskEditModal } from "@/components/tasks/TaskEditModal";
import { ThreadDialog } from "@/components/threads/ThreadDialog";
import { providerLabel, ThreadStatusBadge } from "@/components/threads/threadMeta";

interface DelegatedThread {
  id: string;
  title: string;
  provider: string;
  status: "ACTIVE" | "WAITING" | "DONE";
  url: string | null;
  summary: string | null;
  createdAt: string;
  lastActivityAt: string;
  task: { id: string; title: string; status: string } | null;
  _count: { messages: number };
}

const SECTIONS: { status: DelegatedThread["status"]; label: string; hint: string }[] = [
  { status: "WAITING", label: "Needs you", hint: "The agent stopped and is waiting for your reply or review." },
  { status: "ACTIVE", label: "In progress", hint: "Handed off and being worked on." },
  { status: "DONE", label: "Done", hint: "Finished threads, most recent first." },
];
const DONE_LIMIT = 15;

/** Everything you've handed to an agent, from the moment it's delegated. */
export default function DelegatedPage() {
  const [threads, setThreads] = useState<DelegatedThread[] | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [threadOpen, setThreadOpen] = useState(false);
  const [reviewTask, setReviewTask] = useState<Task | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/threads")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: DelegatedThread[]) => {
        if (active) setThreads(rows);
      })
      .catch(() => {
        if (active) setThreads([]);
      });
    return () => {
      active = false;
    };
  }, [refresh]);

  // Agents report in while this page is in the background; pick that up on return.
  useEffect(() => {
    const reload = () => {
      if (document.visibilityState === "visible") setRefresh((r) => r + 1);
    };
    document.addEventListener("visibilitychange", reload);
    const timer = setInterval(reload, 60_000);
    return () => {
      document.removeEventListener("visibilitychange", reload);
      clearInterval(timer);
    };
  }, []);

  const reload = () => setRefresh((r) => r + 1);

  async function openTask(taskId: string) {
    const res = await fetch(`/api/tasks/${taskId}`);
    if (!res.ok) {
      toast.error("Couldn't load that task");
      return;
    }
    setReviewTask(await res.json());
    setReviewOpen(true);
  }

  async function completeTask(thread: DelegatedThread) {
    if (!thread.task) return;
    const json = { method: "PATCH", headers: { "Content-Type": "application/json" } };
    const res = await fetch(`/api/tasks/${thread.task.id}`, { ...json, body: JSON.stringify({ status: "COMPLETED" }) });
    if (!res.ok) {
      toast.error("Failed to complete the task");
      return;
    }
    await fetch(`/api/threads/${thread.id}`, { ...json, body: JSON.stringify({ status: "DONE" }) });
    toast.success("Task completed");
    reload();
  }

  async function saveTask(id: string, updates: Partial<Task>) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) toast.error("Failed to update task");
    reload();
  }

  async function removeTask(id: string) {
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (!res.ok) toast.error("Failed to delete task");
    reload();
  }

  const open = threads?.filter((t) => t.status !== "DONE").length ?? 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2.5 px-6 h-14 border-b border-border/60 shrink-0">
        <h1 className="text-sm font-semibold">Delegated</h1>
        <span className="text-xs text-muted-foreground">
          {threads === null ? "" : open > 0 ? `${open} in flight` : "Nothing in flight"}
        </span>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto p-6 space-y-6" data-testid="delegated-list">
          {threads === null ? (
            <div className="space-y-1.5">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-lg bg-muted/60 animate-pulse" />)}
            </div>
          ) : threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="h-12 w-12 rounded-xl bg-muted/60 flex items-center justify-center">
                <Bot className="h-5 w-5 text-muted-foreground/40" />
              </div>
              <div className="text-center space-y-1 max-w-sm">
                <p className="text-sm font-medium text-muted-foreground">Nothing delegated yet</p>
                <p className="text-xs text-muted-foreground/60">
                  Open a task and choose Delegate to AI. It shows up here straight away and stays until it&apos;s done.
                </p>
              </div>
            </div>
          ) : (
            SECTIONS.map((section) => {
              const all = threads.filter((t) => t.status === section.status);
              if (all.length === 0) return null;
              const rows = section.status === "DONE" ? all.slice(0, DONE_LIMIT) : all;
              return (
                <section key={section.status} className="space-y-1.5">
                  <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wide px-1" title={section.hint}>
                    {section.label} · {all.length}
                  </p>
                  {rows.map((t) => {
                    const taskOpen = !!t.task && t.task.status !== "COMPLETED" && t.task.status !== "CANCELLED";
                    return (
                      <div
                        key={t.id}
                        className="group/row flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-2.5 hover:border-border transition-colors"
                      >
                        <button
                          className="flex-1 min-w-0 text-left"
                          onClick={() => { setThreadId(t.id); setThreadOpen(true); }}
                          title="Open the thread"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[13.5px] font-medium truncate">{t.task?.title ?? t.title}</span>
                            <ThreadStatusBadge status={t.status} />
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {t.summary ??
                              (t._count.messages === 0
                                ? "Handed off — no update from the agent yet"
                                : "No summary yet")}
                          </p>
                          <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                            {providerLabel(t.provider)} · delegated {formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}
                            {t._count.messages > 0 && ` · last update ${formatDistanceToNow(new Date(t.lastActivityAt), { addSuffix: true })}`}
                          </p>
                        </button>
                        <div className="flex items-center gap-1 shrink-0">
                          {taskOpen && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground" onClick={() => completeTask(t)} title="Mark the task done">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                            </Button>
                          )}
                          {t.task && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openTask(t.task!.id)} title="Open the task">
                              <SquarePen className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {t.url && /^https?:\/\//i.test(t.url) && (
                            <a
                              href={t.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-primary"
                              title={`Open in ${providerLabel(t.provider)}`}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {all.length > rows.length && (
                    <p className="text-[11px] text-muted-foreground/50 px-1">{all.length - rows.length} older not shown</p>
                  )}
                </section>
              );
            })
          )}
        </div>
      </div>

      <ThreadDialog threadId={threadId} open={threadOpen} onOpenChange={setThreadOpen} onChanged={reload} />
      <TaskEditModal task={reviewTask} open={reviewOpen} onOpenChange={setReviewOpen} onUpdate={saveTask} onDelete={removeTask} />
    </div>
  );
}
