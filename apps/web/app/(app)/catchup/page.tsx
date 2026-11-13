"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Archive, CheckCircle2, ExternalLink, ListPlus, Loader2, MessageSquare, Rss, Sparkles, SquarePen,
} from "lucide-react";
import { toast } from "sonner";
import type { CatchUpItem as CatchUpRow, Task } from "@prisma/client";
import type { CatchUpRelated } from "@/lib/services/catchup";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { untrustedMarkdown } from "@/lib/safeMarkdown";
import { TaskEditModal } from "@/components/tasks/TaskEditModal";
import { ThreadDialog } from "@/components/threads/ThreadDialog";
import { providerLabel, ThreadStatusBadge } from "@/components/threads/threadMeta";

type CatchUpItem = CatchUpRow & { related: CatchUpRelated | null };

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

type SectionId = "needs" | "finished" | "other" | "progress";

/**
 * One line in the list. Delegated work appears as its thread from the moment
 * it is handed off; updates the agent posts are folded into that row. Things
 * from other tools, and reports from threads that have finished, are items.
 */
interface Row {
  key: string;
  section: SectionId;
  title: string;
  subtitle: string | null;
  at: string;
  badge: string;
  thread: DelegatedThread | null;
  /** Catch-up items behind this row (a thread can have several updates). */
  items: CatchUpItem[];
}

const SECTIONS: { id: SectionId; label: string; hint: string }[] = [
  { id: "needs", label: "Needs you", hint: "An agent stopped and is waiting for your reply or review." },
  { id: "finished", label: "Finished — review", hint: "Delegated work that has been reported as done." },
  { id: "other", label: "From your other tools", hint: "Email, chat and anything else sent to catch-up, most relevant first." },
  { id: "progress", label: "In progress", hint: "Handed off and being worked on. Nothing for you to do yet." },
];

const SOURCE_STYLE: Record<string, string> = {
  agent: "text-violet-600 bg-violet-500/10",
  email: "text-sky-600 bg-sky-500/10",
  slack: "text-emerald-600 bg-emerald-500/10",
  calendar: "text-amber-600 bg-amber-500/10",
};

const isWebUrl = (url: string | null | undefined): url is string => !!url && /^https?:\/\//i.test(url);
const isOpenStatus = (status: string | null | undefined) => !!status && status !== "COMPLETED" && status !== "CANCELLED";

function buildRows(items: CatchUpItem[], threads: DelegatedThread[]): Row[] {
  const rows: Row[] = [];
  const live = threads.filter((t) => t.status !== "DONE");
  const liveIds = new Set(live.map((t) => t.id));

  for (const t of live) {
    const updates = items.filter((i) => i.related?.threadId === t.id);
    rows.push({
      key: `t:${t.id}`,
      section: t.status === "WAITING" ? "needs" : "progress",
      title: t.task?.title ?? t.title,
      subtitle:
        t.summary ?? (t._count.messages === 0 ? "Handed off — no update from the agent yet" : null),
      at: t._count.messages > 0 ? t.lastActivityAt : t.createdAt,
      badge: "agent",
      thread: t,
      items: updates,
    });
  }
  for (const item of items) {
    if (item.related && liveIds.has(item.related.threadId)) continue; // folded into its thread
    rows.push({
      key: `i:${item.id}`,
      section: item.related ? "finished" : "other",
      title: item.related?.taskTitle ?? item.title,
      subtitle: item.reason ?? item.author,
      at: String(item.occurredAt),
      badge: item.source,
      thread: null,
      items: [item],
    });
  }
  const order = SECTIONS.map((s) => s.id);
  return rows.sort((a, b) => order.indexOf(a.section) - order.indexOf(b.section));
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border/60">
      {children}
    </kbd>
  );
}

const PATCH = { method: "PATCH", headers: { "Content-Type": "application/json" } };

export default function CatchUpPage() {
  const [items, setItems] = useState<CatchUpItem[]>([]);
  const [threads, setThreads] = useState<DelegatedThread[]>([]);
  const [lastWorkDay, setLastWorkDay] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [ranking, setRanking] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const [reviewTask, setReviewTask] = useState<Task | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [replyThreadId, setReplyThreadId] = useState<string | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);

  const reload = useCallback(() => setRefresh((r) => r + 1), []);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/catchup").then((r) => (r.ok ? r.json() : { items: [] })),
      fetch("/api/threads").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([c, t]: [{ items: CatchUpItem[]; lastWorkDay: string | null }, DelegatedThread[]]) => {
        if (!active) return;
        setItems(c.items ?? []);
        setLastWorkDay(c.lastWorkDay ?? null);
        setThreads(Array.isArray(t) ? t : []);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refresh]);

  // Agents report in while this page is in the background; pick that up on return.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(onVisible, 60_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [reload]);

  const rows = buildRows(items, threads);
  const selectedIndex = Math.max(0, rows.findIndex((r) => r.key === selectedKey));
  const row: Row | undefined = rows[selectedIndex];
  const item = row?.items[0] ?? null;

  // The work a row is about: its thread, and the task that thread is for.
  const threadId = row?.thread?.id ?? item?.related?.threadId ?? null;
  const taskId = row?.thread?.task?.id ?? item?.related?.taskId ?? null;
  const taskTitle = row?.thread?.task?.title ?? item?.related?.taskTitle ?? null;
  const taskStatus = row?.thread?.task?.status ?? item?.related?.taskStatus ?? null;
  const taskOpen = !!taskId && isOpenStatus(taskStatus);
  const needsReply = row?.section === "needs";
  const provider = row?.thread?.provider ?? (item?.source === "agent" ? item.author ?? "other" : null);
  const url = [row?.thread?.url, item?.url].find(isWebUrl) ?? null;
  const body = item?.body ?? row?.thread?.summary ?? null;

  const attention = rows.filter((r) => r.section !== "progress").length;
  const inProgress = rows.length - attention;

  const patchItem = (id: string, action: string) =>
    fetch(`/api/catchup/${id}`, { ...PATCH, body: JSON.stringify({ action }) });

  /** Triage a row that is a catch-up item: make a task from it, archive it, or complete its task. */
  const triage = useCallback(
    async (target: Row, action: "task" | "archive" | "complete") => {
      const first = target.items[0];
      if (!first) return;
      // Optimistic: drop the row's items and move the selection to the next row.
      const ids = new Set(target.items.map((i) => i.id));
      const idx = rows.findIndex((r) => r.key === target.key);
      const remaining = rows.filter((r) => r.key !== target.key);
      setItems((prev) => prev.filter((i) => !ids.has(i.id)));
      if (!target.thread) setSelectedKey(remaining[Math.min(idx, remaining.length - 1)]?.key ?? null);

      const res = await patchItem(first.id, action);
      if (!res.ok) {
        toast.error("That didn't save — restoring it");
        reload();
        return;
      }
      // Other updates from the same thread are cleared along with it.
      await Promise.all(target.items.slice(1).map((i) => patchItem(i.id, "archive")));
      const data = (await res.json().catch(() => null)) as { task?: { id: string } } | null;
      const done = { task: "Added to your task inbox", archive: "Archived", complete: "Task completed" }[action];
      toast.success(done, {
        action: {
          label: "Undo",
          onClick: async () => {
            if (action === "complete" && first.related?.taskId) {
              // Reopen the task as it was before.
              await fetch(`/api/tasks/${first.related.taskId}`, {
                ...PATCH,
                body: JSON.stringify({ status: first.related.taskStatus ?? "INBOX" }),
              });
            }
            if (action === "task" && data?.task?.id) await fetch(`/api/tasks/${data.task.id}`, { method: "DELETE" });
            await Promise.all(target.items.map((i) => patchItem(i.id, "restore")));
            reload();
          },
        },
      });
      reload();
    },
    [rows, reload]
  );

  /** Mark the task behind a row done, whether or not the agent has reported on it. */
  async function completeWork(target: Row) {
    if (target.items.length > 0) return triage(target, "complete");
    const t = target.thread;
    if (!t?.task) return;
    const res = await fetch(`/api/tasks/${t.task.id}`, { ...PATCH, body: JSON.stringify({ status: "COMPLETED" }) });
    if (!res.ok) {
      toast.error("Failed to complete the task");
      return;
    }
    await fetch(`/api/threads/${t.id}`, { ...PATCH, body: JSON.stringify({ status: "DONE" }) });
    toast.success("Task completed");
    reload();
  }

  async function openTask(id: string) {
    const res = await fetch(`/api/tasks/${id}`);
    if (!res.ok) {
      toast.error("Couldn't load that task");
      return;
    }
    setReviewTask(await res.json());
    setReviewOpen(true);
  }

  function openThread(id: string) {
    setReplyThreadId(id);
    setReplyOpen(true);
  }

  async function saveTask(id: string, updates: Partial<Task>) {
    const res = await fetch(`/api/tasks/${id}`, { ...PATCH, body: JSON.stringify(updates) });
    if (!res.ok) toast.error("Failed to update task");
    reload();
  }

  async function removeTask(id: string) {
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (!res.ok) toast.error("Failed to delete task");
    reload();
  }

  async function rank() {
    setRanking(true);
    const res = await fetch("/api/catchup/rank", { method: "POST" });
    setRanking(false);
    if (!res.ok) {
      toast.error("Couldn't re-rank");
      return;
    }
    const data = (await res.json()) as { usedAi: boolean };
    toast.success(data.usedAi ? "Ranked against your current work" : "Ranked by keyword match (no AI provider configured)");
    reload();
  }

  // Keyboard: j/k move, c → complete the task, r → open/reply to the thread,
  // t → new task, e → archive, o → open the source.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey || rows.length === 0 || !row) return;
      if (document.querySelector('[role="dialog"]')) return;
      const key = e.key.toLowerCase();
      if (key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedKey(rows[Math.min(selectedIndex + 1, rows.length - 1)].key);
      } else if (key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedKey(rows[Math.max(selectedIndex - 1, 0)].key);
      } else if (key === "c" && taskOpen) {
        e.preventDefault();
        completeWork(row);
      } else if (key === "r" && threadId) {
        e.preventDefault();
        openThread(threadId);
      } else if (key === "t" && item) {
        e.preventDefault();
        triage(row, "task");
      } else if (key === "e" && item && !row.thread) {
        e.preventDefault();
        triage(row, "archive");
      } else if ((key === "o" || e.key === "Enter") && url) {
        e.preventDefault();
        window.open(url, "_blank", "noopener,noreferrer");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // completeWork is recreated every render; the values it reads are all listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, row, selectedIndex, taskOpen, threadId, item, url, triage]);

  useEffect(() => {
    listRef.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 h-14 border-b border-border/60 shrink-0 gap-3">
        <div className="flex items-baseline gap-2.5 min-w-0">
          <h1 className="text-sm font-semibold">Catch-up</h1>
          <span className="text-xs text-muted-foreground truncate">
            {rows.length === 0
              ? "Delegated work and what happened while you were away"
              : [
                  attention > 0 ? `${attention} for you` : null,
                  inProgress > 0 ? `${inProgress} in progress` : null,
                  attention > 0 && lastWorkDay ? `since ${format(new Date(`${lastWorkDay}T12:00:00`), "EEE, MMM d")}` : null,
                ].filter(Boolean).join(" · ")}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
            <Kbd>j</Kbd><Kbd>k</Kbd> move <Kbd>c</Kbd> complete <Kbd>r</Kbd> thread <Kbd>t</Kbd> new task <Kbd>e</Kbd> archive <Kbd>o</Kbd> open
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5 border-border/60 bg-transparent"
            onClick={rank}
            disabled={ranking || items.length === 0}
            title="Re-rank against your tasks and today's intention"
          >
            {ranking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Re-rank
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="p-6 space-y-1.5 max-w-xl">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 rounded-lg bg-muted/60 animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6">
          <div className="h-12 w-12 rounded-xl bg-muted/60 flex items-center justify-center">
            <Rss className="h-5 w-5 text-muted-foreground/40" />
          </div>
          <div className="text-center space-y-1 max-w-sm">
            <p className="text-sm font-medium text-muted-foreground">You&apos;re caught up</p>
            <p className="text-xs text-muted-foreground/60">
              Tasks you delegate to an agent show up here as soon as you hand them off, and stay until they&apos;re done. To
              bring in email, Slack and the rest, post to the catch-up endpoint in Settings → API Tokens.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0">
          <div ref={listRef} className="w-full md:w-[44%] md:max-w-xl overflow-y-auto border-r border-border/60 p-3" data-testid="catchup-list">
            {SECTIONS.map((section) => {
              const sectionRows = rows.filter((r) => r.section === section.id);
              if (sectionRows.length === 0) return null;
              return (
                <div key={section.id} className="mb-3 last:mb-0 space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wide px-1 pt-1" title={section.hint}>
                    {section.label} · {sectionRows.length}
                  </p>
                  {sectionRows.map((r) => {
                    const isSelected = r.key === row?.key;
                    return (
                      <div
                        key={r.key}
                        data-selected={isSelected}
                        onClick={() => setSelectedKey(r.key)}
                        className={cn(
                          "rounded-lg border px-3 py-2.5 cursor-pointer transition-colors",
                          isSelected ? "border-primary/40 bg-primary/[0.06]" : "border-transparent hover:bg-muted/40"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-md shrink-0", SOURCE_STYLE[r.badge] ?? "text-muted-foreground bg-muted")}>
                            {r.badge}
                          </span>
                          <span className="text-[13.5px] font-medium truncate flex-1">{r.title}</span>
                          <span className="text-[10px] text-muted-foreground/60 shrink-0">
                            {formatDistanceToNow(new Date(r.at), { addSuffix: true })}
                          </span>
                        </div>
                        {r.subtitle && <p className="text-xs text-muted-foreground truncate mt-0.5">{r.subtitle}</p>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <div className="hidden md:flex flex-1 flex-col min-w-0">
            {row && (
              <>
                <div className="px-6 py-4 border-b border-border/40 space-y-1.5 shrink-0">
                  <h2 className="text-base font-semibold leading-snug break-words">{item?.title ?? row.title}</h2>
                  <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                    {row.thread ? (
                      <>
                        <ThreadStatusBadge status={row.thread.status} />
                        <span>
                          {providerLabel(row.thread.provider)} · delegated{" "}
                          {formatDistanceToNow(new Date(row.thread.createdAt), { addSuffix: true })}
                        </span>
                      </>
                    ) : (
                      [
                        item?.source === "agent" ? providerLabel(item.author ?? "other") : item?.author,
                        item?.source,
                        item ? format(new Date(item.occurredAt), "EEE MMM d, h:mm a") : null,
                      ].filter(Boolean).join(" · ")
                    )}
                  </p>
                  {item?.reason && (
                    <p className="text-xs text-primary/90 flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3 shrink-0" /> {item.reason}
                    </p>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4 text-sm leading-relaxed break-words [&_p]:mb-2 [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_a]:text-primary [&_a]:underline [&_pre]:overflow-x-auto [&_code]:font-mono [&_code]:text-[12px]">
                  {body ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={untrustedMarkdown}>
                      {body}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-muted-foreground/60">
                      {row.thread
                        ? "Handed off. The agent hasn't reported back yet — its updates will appear here."
                        : "No preview available."}
                    </p>
                  )}
                </div>

                {taskId && (
                  <div className="flex items-center gap-2 px-6 py-2.5 border-t border-border/40 bg-muted/30 text-xs shrink-0">
                    <span className="text-muted-foreground shrink-0">For task</span>
                    <button className="font-medium truncate hover:underline text-left" onClick={() => openTask(taskId)} title="Open the task">
                      {taskTitle}
                    </button>
                    <span className="ml-auto text-muted-foreground shrink-0">
                      {taskOpen ? "still open" : taskStatus === "COMPLETED" ? "already completed" : "cancelled"}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 px-6 py-3 border-t border-border/40 shrink-0 flex-wrap">
                  {threadId ? (
                    <>
                      {/* Delegated work: act on the task and its thread, not on the notification. */}
                      {needsReply ? (
                        <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => openThread(threadId)}>
                          <MessageSquare className="h-3.5 w-3.5" /> Reply to agent
                        </Button>
                      ) : row.section === "progress" ? (
                        <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => openThread(threadId)}>
                          <MessageSquare className="h-3.5 w-3.5" /> Open thread
                        </Button>
                      ) : taskOpen ? (
                        <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => completeWork(row)} data-testid="catchup-complete">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Complete task
                        </Button>
                      ) : (
                        <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => triage(row, "archive")}>
                          <Archive className="h-3.5 w-3.5" /> Got it
                        </Button>
                      )}
                      {taskId && (
                        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-border/60 bg-transparent" onClick={() => openTask(taskId)}>
                          <SquarePen className="h-3.5 w-3.5" /> Review task
                        </Button>
                      )}
                      {taskOpen && row.section !== "finished" && (
                        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-border/60 bg-transparent" onClick={() => completeWork(row)}>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Complete task
                        </Button>
                      )}
                      {row.section === "finished" && (
                        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-muted-foreground" onClick={() => openThread(threadId)}>
                          <MessageSquare className="h-3.5 w-3.5" /> Reply
                        </Button>
                      )}
                      {row.section === "finished" && taskOpen && (
                        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-muted-foreground" onClick={() => triage(row, "archive")} title="Dismiss this update and leave the task as it is">
                          <Archive className="h-3.5 w-3.5" /> Dismiss
                        </Button>
                      )}
                      {item && (
                        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-muted-foreground" onClick={() => triage(row, "task")} title="Create a separate follow-up task from this update">
                          <ListPlus className="h-3.5 w-3.5" /> Follow-up task
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => triage(row, "task")}>
                        <ListPlus className="h-3.5 w-3.5" /> Make it a task
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-border/60 bg-transparent" onClick={() => triage(row, "archive")}>
                        <Archive className="h-3.5 w-3.5" /> Archive
                      </Button>
                    </>
                  )}
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Open in {provider ? providerLabel(provider) : item?.source} <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <TaskEditModal task={reviewTask} open={reviewOpen} onOpenChange={setReviewOpen} onUpdate={saveTask} onDelete={removeTask} />
      <ThreadDialog threadId={replyThreadId} open={replyOpen} onOpenChange={setReplyOpen} onChanged={reload} />
    </div>
  );
}
