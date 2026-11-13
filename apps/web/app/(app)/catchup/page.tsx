"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Archive, CheckCircle2, ExternalLink, ListPlus, Loader2, MessageSquare, Rss, Sparkles, SquarePen } from "lucide-react";
import { toast } from "sonner";
import type { CatchUpItem as CatchUpRow, Task } from "@prisma/client";
import type { CatchUpRelated } from "@/lib/services/catchup";
import { TaskEditModal } from "@/components/tasks/TaskEditModal";
import { ThreadDialog } from "@/components/threads/ThreadDialog";
import { providerLabel } from "@/components/threads/threadMeta";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { untrustedMarkdown } from "@/lib/safeMarkdown";

type CatchUpItem = CatchUpRow & { related: CatchUpRelated | null };
type Action = "task" | "archive" | "complete";

const SOURCE_STYLE: Record<string, string> = {
  agent: "text-violet-600 bg-violet-500/10",
  email: "text-sky-600 bg-sky-500/10",
  slack: "text-emerald-600 bg-emerald-500/10",
  calendar: "text-amber-600 bg-amber-500/10",
};

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border/60">
      {children}
    </kbd>
  );
}

export default function CatchUpPage() {
  const [items, setItems] = useState<CatchUpItem[]>([]);
  const [lastWorkDay, setLastWorkDay] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [ranking, setRanking] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const [reviewTask, setReviewTask] = useState<Task | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [replyThreadId, setReplyThreadId] = useState<string | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/catchup")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items: CatchUpItem[]; lastWorkDay: string | null }) => {
        if (!active) return;
        setItems(d.items ?? []);
        setLastWorkDay(d.lastWorkDay ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refresh]);

  const selectedIndex = Math.max(0, items.findIndex((i) => i.id === selectedId));
  const selected: CatchUpItem | undefined = items[selectedIndex];
  // Defence in depth: never link to or open anything but a web URL.
  const selectedUrl = selected?.url && /^https?:\/\//i.test(selected.url) ? selected.url : null;

  const triage = useCallback(
    async (item: CatchUpItem, action: Action) => {
      // Optimistic: drop it and move the selection to the next item.
      setItems((prev) => {
        const idx = prev.findIndex((i) => i.id === item.id);
        const next = prev.filter((i) => i.id !== item.id);
        setSelectedId(next[Math.min(idx, next.length - 1)]?.id ?? null);
        return next;
      });
      const res = await fetch(`/api/catchup/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        toast.error("That didn't save — restoring the item");
        setRefresh((r) => r + 1);
        return;
      }
      const data = (await res.json().catch(() => null)) as { task?: { id: string } } | null;
      const done = { task: "Added to your task inbox", archive: "Archived", complete: "Task completed" }[action];
      toast.success(done, {
        action: {
          label: "Undo",
          onClick: async () => {
            if (action === "complete" && item.related?.taskId) {
              // Reopen the task as it was before.
              await fetch(`/api/tasks/${item.related.taskId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: item.related.taskStatus ?? "INBOX" }),
              });
            }
            if (action === "task" && data?.task?.id) await fetch(`/api/tasks/${data.task.id}`, { method: "DELETE" });
            await fetch(`/api/catchup/${item.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "restore" }),
            });
            setRefresh((r) => r + 1);
          },
        },
      });
    },
    []
  );

  // What the item is about. An agent update points at the task the agent worked on.
  const related = selected?.related ?? null;
  const taskOpen = !!related?.taskId && related.taskStatus !== "COMPLETED" && related.taskStatus !== "CANCELLED";
  const needsReply = related?.threadStatus === "WAITING";

  async function openTask(taskId: string) {
    const res = await fetch(`/api/tasks/${taskId}`);
    if (!res.ok) {
      toast.error("Couldn't load that task");
      return;
    }
    setReviewTask(await res.json());
    setReviewOpen(true);
  }

  function openReply(threadId: string) {
    setReplyThreadId(threadId);
    setReplyOpen(true);
  }

  async function saveTask(id: string, updates: Partial<Task>) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) toast.error("Failed to update task");
    setRefresh((r) => r + 1);
  }

  async function removeTask(id: string) {
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (!res.ok) toast.error("Failed to delete task");
    setRefresh((r) => r + 1);
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
    setRefresh((r) => r + 1);
  }

  // Keyboard triage: j/k move, c → complete the task, r → reply, t → new task, e → archive, o → open the source.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey || items.length === 0) return;
      if (document.querySelector('[role="dialog"]')) return;
      const key = e.key.toLowerCase();
      if (key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedId(items[Math.min(selectedIndex + 1, items.length - 1)].id);
      } else if (key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedId(items[Math.max(selectedIndex - 1, 0)].id);
      } else if (key === "c" && selected && taskOpen) {
        e.preventDefault();
        triage(selected, "complete");
      } else if (key === "r" && related) {
        e.preventDefault();
        openReply(related.threadId);
      } else if (key === "t" && selected) {
        e.preventDefault();
        triage(selected, "task");
      } else if (key === "e" && selected) {
        e.preventDefault();
        triage(selected, "archive");
      } else if ((key === "o" || e.key === "Enter") && selectedUrl) {
        e.preventDefault();
        window.open(selectedUrl, "_blank", "noopener,noreferrer");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [items, selected, selectedUrl, selectedIndex, triage, related, taskOpen]);

  useEffect(() => {
    listRef.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 h-14 border-b border-border/60 shrink-0 gap-3">
        <div className="flex items-baseline gap-2.5 min-w-0">
          <h1 className="text-sm font-semibold">Catch-up</h1>
          <span className="text-xs text-muted-foreground truncate">
            {items.length > 0
              ? `${items.length} to triage${lastWorkDay ? ` · since ${format(new Date(`${lastWorkDay}T12:00:00`), "EEE, MMM d")}` : ""}`
              : "What happened while you were away"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
            <Kbd>j</Kbd><Kbd>k</Kbd> move <Kbd>c</Kbd> complete <Kbd>r</Kbd> reply <Kbd>t</Kbd> new task <Kbd>e</Kbd> archive <Kbd>o</Kbd> open
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
      ) : items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6">
          <div className="h-12 w-12 rounded-xl bg-muted/60 flex items-center justify-center">
            <Rss className="h-5 w-5 text-muted-foreground/40" />
          </div>
          <div className="text-center space-y-1 max-w-sm">
            <p className="text-sm font-medium text-muted-foreground">You&apos;re caught up</p>
            <p className="text-xs text-muted-foreground/60">
              Agent threads that finish or need you show up here. To bring in email, Slack and the rest, post to the
              catch-up endpoint in Settings → API Tokens.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0">
          <div ref={listRef} className="w-full md:w-[44%] md:max-w-xl overflow-y-auto border-r border-border/60 p-3 space-y-1" data-testid="catchup-list">
            {items.map((item) => {
              const isSelected = item.id === selected?.id;
              return (
                <div
                  key={item.id}
                  data-selected={isSelected}
                  onClick={() => setSelectedId(item.id)}
                  className={cn(
                    "group/item rounded-lg border px-3 py-2.5 cursor-pointer transition-colors",
                    isSelected ? "border-primary/40 bg-primary/[0.06]" : "border-transparent hover:bg-muted/40"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-md shrink-0", SOURCE_STYLE[item.source] ?? "text-muted-foreground bg-muted")}>
                      {item.source}
                    </span>
                    <span className="text-[13.5px] font-medium truncate flex-1">{item.title}</span>
                    <span className="text-[10px] text-muted-foreground/60 shrink-0">
                      {formatDistanceToNow(new Date(item.occurredAt), { addSuffix: true })}
                    </span>
                  </div>
                  {(item.reason || item.author) && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {item.reason ?? item.author}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="hidden md:flex flex-1 flex-col min-w-0">
            {selected && (
              <>
                <div className="px-6 py-4 border-b border-border/40 space-y-1.5 shrink-0">
                  <h2 className="text-base font-semibold leading-snug break-words">{selected.title}</h2>
                  <p className="text-xs text-muted-foreground">
                    {[selected.author, selected.source, format(new Date(selected.occurredAt), "EEE MMM d, h:mm a")]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {selected.reason && (
                    <p className="text-xs text-primary/90 flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3 shrink-0" /> {selected.reason}
                    </p>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-4 text-sm leading-relaxed break-words [&_p]:mb-2 [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_a]:text-primary [&_a]:underline [&_pre]:overflow-x-auto [&_code]:font-mono [&_code]:text-[12px]">
                  {selected.body ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={untrustedMarkdown}>
                      {selected.body}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-muted-foreground/50">No preview available.</p>
                  )}
                </div>
                {related?.taskId && (
                  <div className="flex items-center gap-2 px-6 py-2.5 border-t border-border/40 bg-muted/30 text-xs shrink-0">
                    <span className="text-muted-foreground shrink-0">For task</span>
                    <button
                      className="font-medium truncate hover:underline text-left"
                      onClick={() => openTask(related.taskId!)}
                      title="Open the task"
                    >
                      {related.taskTitle}
                    </button>
                    <span className="ml-auto text-muted-foreground shrink-0">
                      {taskOpen ? "still open" : related.taskStatus === "COMPLETED" ? "already completed" : "cancelled"}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 px-6 py-3 border-t border-border/40 shrink-0">
                  {related ? (
                    <>
                      {/* Agent update: act on the work it reports, not on the notification. */}
                      {needsReply ? (
                        <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => openReply(related.threadId)}>
                          <MessageSquare className="h-3.5 w-3.5" /> Reply to agent
                        </Button>
                      ) : taskOpen ? (
                        <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => triage(selected, "complete")} data-testid="catchup-complete">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Complete task
                        </Button>
                      ) : (
                        <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => triage(selected, "archive")}>
                          <Archive className="h-3.5 w-3.5" /> Got it
                        </Button>
                      )}
                      {related.taskId && (
                        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-border/60 bg-transparent" onClick={() => openTask(related.taskId!)}>
                          <SquarePen className="h-3.5 w-3.5" /> Review task
                        </Button>
                      )}
                      {needsReply && taskOpen && (
                        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-border/60 bg-transparent" onClick={() => triage(selected, "complete")}>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Complete task
                        </Button>
                      )}
                      {!needsReply && (
                        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-muted-foreground" onClick={() => openReply(related.threadId)}>
                          <MessageSquare className="h-3.5 w-3.5" /> Reply
                        </Button>
                      )}
                      {(needsReply || taskOpen) && (
                        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-muted-foreground" onClick={() => triage(selected, "archive")} title="Dismiss this update and leave the task as it is">
                          <Archive className="h-3.5 w-3.5" /> Dismiss
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-muted-foreground" onClick={() => triage(selected, "task")} title="Create a separate follow-up task from this update">
                        <ListPlus className="h-3.5 w-3.5" /> Follow-up task
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => triage(selected, "task")}>
                        <ListPlus className="h-3.5 w-3.5" /> Make it a task
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-border/60 bg-transparent" onClick={() => triage(selected, "archive")}>
                        <Archive className="h-3.5 w-3.5" /> Archive
                      </Button>
                    </>
                  )}
                  {selectedUrl && (
                    <a
                      href={selectedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Open in {selected.source === "agent" ? providerLabel(selected.author ?? "other") : selected.source} <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <TaskEditModal
        task={reviewTask}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        onUpdate={saveTask}
        onDelete={removeTask}
      />
      <ThreadDialog
        threadId={replyThreadId}
        open={replyOpen}
        onOpenChange={setReplyOpen}
        onChanged={() => setRefresh((r) => r + 1)}
      />
    </div>
  );
}
