"use client";
import { useEffect, useState } from "react";
import { format, startOfWeek, endOfWeek, addDays, subWeeks, addWeeks, startOfDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, MoveRight, Inbox, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Task } from "@prisma/client";
import { TaskEditModal } from "@/components/tasks/TaskEditModal";

const priorityColor: Record<string, string> = {
  HIGH:   "bg-rose-500",
  MEDIUM: "bg-amber-500",
  LOW:    "bg-slate-400",
};

export default function ReviewPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [triaging, setTriaging] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

  useEffect(() => {
    let active = true;
    setLoading(true);
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const weekEndDate = addDays(weekStart, 7);
    Promise.all([
      ...days.map((day) =>
        fetch(`/api/tasks?date=${format(day, "yyyy-MM-dd")}`)
          .then((r) => r.ok ? r.json() : [])
      ),
      fetch(`/api/tasks?completedFrom=${format(weekStart, "yyyy-MM-dd")}&completedTo=${format(weekEndDate, "yyyy-MM-dd")}`)
        .then((r) => r.ok ? r.json() : []),
    ]).then((results: Task[][]) => {
      if (!active) return;
      // Deduplicate by id
      const seen = new Set<string>();
      const all: Task[] = [];
      results.flat().forEach((t) => { if (!seen.has(t.id)) { seen.add(t.id); all.push(t); } });
      setTasks(all);
      setLoading(false);
    });
    return () => { active = false; };
  }, [weekStart, refresh]);

  const completed = tasks.filter((t) => t.status === "COMPLETED");
  const incomplete = tasks.filter((t) => t.status !== "COMPLETED" && t.status !== "CANCELLED");
  const completedMins = completed.reduce((acc, t) => acc + (t.duration ?? 30), 0);

  async function deferAll() {
    if (incomplete.length === 0) return;
    setTriaging(true);
    const nextWeekStart = startOfDay(addWeeks(weekStart, 1)).toISOString();
    await Promise.all(incomplete.map((task) =>
      fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledDate: nextWeekStart }),
      })
    ));
    setTriaging(false);
    setRefresh((r) => r + 1);
    toast.success(`${incomplete.length} tasks deferred to next week`);
  }

  async function inboxAll() {
    if (incomplete.length === 0) return;
    setTriaging(true);
    await Promise.all(incomplete.map((task) =>
      fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledDate: null, startTime: null, status: "INBOX" }),
      })
    ));
    setTriaging(false);
    setRefresh((r) => r + 1);
    toast.success(`${incomplete.length} tasks moved to inbox`);
  }

  async function deferTask(task: Task) {
    const nextWeekStart = startOfDay(addWeeks(weekStart, 1)).toISOString();
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledDate: nextWeekStart }),
    });
    setRefresh((r) => r + 1);
  }

  async function inboxTask(task: Task) {
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledDate: null, startTime: null, status: "INBOX" }),
    });
    setRefresh((r) => r + 1);
  }

  async function updateTask(id: string, updates: Partial<Task>) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) setRefresh((r) => r + 1);
    else toast.error("Failed to update task");
  }

  async function deleteTask(id: string) {
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (res.ok) {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      setTaskModalOpen(false);
      toast.success("Task deleted");
    } else toast.error("Failed to delete task");
  }

  function openTask(task: Task) {
    setSelectedTask(task);
    setTaskModalOpen(true);
  }

  const thisWeek = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd") === format(weekStart, "yyyy-MM-dd");
  const completionPct = tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : 0;

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Header */}
      <div className="flex items-center gap-2 px-6 h-14 border-b border-border/60 shrink-0">
        <BarChart2 className="h-4 w-4 text-muted-foreground" />
        <h1 className="text-sm font-semibold mr-2">Weekly Review</h1>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWeekStart((w) => subWeeks(w, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground">
          {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWeekStart((w) => addWeeks(w, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        {!thisWeek && (
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
            This week
          </Button>
        )}
      </div>

      <div className="flex-1 p-6 space-y-6 max-w-2xl mx-auto w-full">
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />)}
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
                <p className="text-2xl font-bold text-emerald-400">{completed.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Completed</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
                <p className="text-2xl font-bold">{completionPct}%</p>
                <p className="text-xs text-muted-foreground mt-0.5">Completion rate</p>
                <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${completionPct}%` }} />
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
                <p className="text-2xl font-bold">
                  {Math.floor(completedMins / 60)}
                  <span className="text-sm font-normal text-muted-foreground">h</span>
                  {completedMins % 60 > 0 && <>{completedMins % 60}<span className="text-sm font-normal text-muted-foreground">m</span></>}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Time completed</p>
              </div>
            </div>

            {/* Completed list */}
            {completed.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  Completed ({completed.length})
                </p>
                <div className="space-y-1">
                  {completed.map((task) => (
                    <button
                      key={task.id}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-muted/20 border border-border/30 hover:bg-muted/40 hover:border-border/50 transition-colors text-left"
                      onClick={() => openTask(task)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <div className={cn("h-1 w-1 rounded-full shrink-0", priorityColor[task.priority])} />
                      <span className="text-sm text-muted-foreground line-through truncate">{task.title}</span>
                      {task.scheduledDate && (
                        <span className="ml-auto text-[11px] text-muted-foreground/40 shrink-0">
                          {format(new Date(task.scheduledDate), "EEE")}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Incomplete list with triage */}
            {incomplete.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Circle className="h-3.5 w-3.5" />
                    Unfinished ({incomplete.length})
                  </p>
                  <div className="flex gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[11px] border-border/60 bg-transparent gap-1"
                      onClick={deferAll}
                      disabled={triaging}
                    >
                      <MoveRight className="h-3 w-3" /> Defer all to next week
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[11px] border-border/60 bg-transparent gap-1"
                      onClick={inboxAll}
                      disabled={triaging}
                    >
                      <Inbox className="h-3 w-3" /> All to inbox
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  {incomplete.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-muted/30 border border-border/40 hover:bg-muted/50 hover:border-border/60 transition-colors cursor-pointer"
                      onClick={() => openTask(task)}
                    >
                      <Circle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                      <div className={cn("h-1 w-1 rounded-full shrink-0", priorityColor[task.priority])} />
                      <span className="text-sm truncate">{task.title}</span>
                      {task.scheduledDate && (
                        <span className="text-[11px] text-muted-foreground/40 shrink-0">
                          {format(new Date(task.scheduledDate), "EEE")}
                        </span>
                      )}
                      <div className="ml-auto flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground/50 hover:text-sky-600"
                          title="Defer to next week"
                          onClick={() => deferTask(task)}
                        >
                          <MoveRight className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground/50 hover:text-violet-600"
                          title="Back to inbox"
                          onClick={() => inboxTask(task)}
                        >
                          <Inbox className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tasks.length === 0 && (
              <div className="text-center py-16">
                <p className="text-muted-foreground text-sm">No tasks scheduled this week.</p>
              </div>
            )}
          </>
        )}
      </div>
      <TaskEditModal
        task={selectedTask}
        open={taskModalOpen}
        onOpenChange={setTaskModalOpen}
        onUpdate={updateTask}
        onDelete={deleteTask}
      />
    </div>
  );
}
