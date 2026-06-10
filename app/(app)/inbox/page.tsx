"use client";
import { useEffect, useState } from "react";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskForm } from "@/components/tasks/TaskForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Inbox, CheckSquare, Square, Trash2, CalendarDays, Bot, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Task } from "@prisma/client";

export default function InboxPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDate, setBulkDate] = useState("");

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ status: "INBOX" });
    if (filter !== "all") params.set("source", filter);
    fetch(`/api/tasks?${params}`).then(async (res) => {
      if (res.ok && active) setTasks(await res.json());
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [filter, refresh]);

  function fetchTasks() { setRefresh((r) => r + 1); }

  async function addTask(data: Partial<Task>) {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) { await fetchTasks(); toast.success("Task added"); }
    else toast.error("Failed to add task");
  }

  async function updateTask(id: string, updates: Partial<Task>) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) await fetchTasks();
    else toast.error("Failed to update task");
  }

  async function deleteTask(id: string) {
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (res.ok) { setTasks((prev) => prev.filter((t) => t.id !== id)); toast.success("Task deleted"); }
    else toast.error("Failed to delete task");
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
    setBulkDate("");
  }

  async function bulkAction(action: string, extra: Record<string, unknown> = {}) {
    if (selected.size === 0) return;
    const res = await fetch("/api/tasks/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected), action, ...extra }),
    });
    if (res.ok) {
      const { affected } = await res.json();
      toast.success(`${affected} task${affected === 1 ? "" : "s"} updated`);
      exitSelectMode();
      fetchTasks();
    } else {
      const err = await res.json().catch(() => null);
      toast.error(err?.error?.toString?.() ?? "Bulk action failed");
    }
  }

  const filtered = tasks
    .filter((t) => priorityFilter === "all" || t.priority === priorityFilter)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const counts = {
    HIGH: tasks.filter((t) => t.priority === "HIGH").length,
    MEDIUM: tasks.filter((t) => t.priority === "MEDIUM").length,
    LOW: tasks.filter((t) => t.priority === "LOW").length,
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-lg font-semibold">Inbox</h1>
          {tasks.length > 0 && (
            <span className="text-xs text-muted-foreground">{tasks.length} tasks</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={selectMode ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
            data-testid="bulk-select-toggle"
          >
            {selectMode ? <X className="h-3.5 w-3.5 mr-1" /> : <CheckSquare className="h-3.5 w-3.5 mr-1" />}
            {selectMode ? "Cancel" : "Select"}
          </Button>
          <Select value={filter} onValueChange={(v) => setFilter(v ?? "all")}>
            <SelectTrigger className="h-7 w-32 text-xs bg-transparent border-border/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="MANUAL">Manual</SelectItem>
              <SelectItem value="API">From API</SelectItem>
              <SelectItem value="RECURRING">Recurring</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v ?? "all")}>
            <SelectTrigger className="h-7 w-32 text-xs bg-transparent border-border/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="HIGH">High ({counts.HIGH})</SelectItem>
              <SelectItem value="MEDIUM">Medium ({counts.MEDIUM})</SelectItem>
              <SelectItem value="LOW">Low ({counts.LOW})</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectMode && (
        <div className="flex items-center gap-2 flex-wrap rounded-xl border border-primary/30 bg-primary/5 px-3 py-2" data-testid="bulk-action-bar">
          <span className="text-xs font-medium text-muted-foreground">
            {selected.size} selected
          </span>
          <button
            className="text-xs text-primary hover:underline"
            onClick={() => setSelected(new Set(filtered.map((t) => t.id)))}
          >
            Select all
          </button>
          <div className="flex items-center gap-1.5 ml-auto flex-wrap">
            <Input
              type="date"
              value={bulkDate}
              onChange={(e) => setBulkDate(e.target.value)}
              className="h-7 w-36 text-xs bg-background"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={selected.size === 0 || !bulkDate}
              onClick={() => bulkAction("schedule", { scheduledDate: new Date(bulkDate + "T00:00:00.000Z").toISOString() })}
            >
              <CalendarDays className="h-3.5 w-3.5 mr-1" /> Schedule
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={selected.size === 0}
              onClick={() => bulkAction("delegate")}
              title="Queue selected tasks for an AI agent to pick up via MCP"
            >
              <Bot className="h-3.5 w-3.5 mr-1" /> Delegate to AI
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={selected.size === 0}
              onClick={() => bulkAction("complete")}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Complete
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs text-destructive hover:text-destructive"
              disabled={selected.size === 0}
              onClick={() => bulkAction("delete")}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
            </Button>
          </div>
        </div>
      )}

      {/* Add task */}
      {!selectMode && <TaskForm onSubmit={addTask} compact />}

      {/* List */}
      {loading ? (
        <div className="space-y-1.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 rounded-lg bg-muted/60 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="h-12 w-12 rounded-xl bg-muted/60 flex items-center justify-center">
            <Inbox className="h-5 w-5 text-muted-foreground/40" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-muted-foreground">All clear</p>
            <p className="text-xs text-muted-foreground/60">Add a task above or connect N8N to receive tasks automatically</p>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5" data-testid="task-list">
          {filtered.map((task) => (
            <div key={task.id} className={cn("flex items-start gap-2", selectMode && "cursor-pointer")}>
              {selectMode && (
                <button
                  onClick={() => toggleSelect(task.id)}
                  className="mt-3 shrink-0 text-muted-foreground hover:text-primary transition-colors"
                  data-testid="bulk-select-checkbox"
                >
                  {selected.has(task.id) ? (
                    <CheckSquare className="h-4 w-4 text-primary" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </button>
              )}
              <div className="flex-1 min-w-0" onClick={selectMode ? () => toggleSelect(task.id) : undefined}>
                <div className={cn(selectMode && "pointer-events-none")}>
                  <TaskCard
                    task={task}
                    onUpdate={updateTask}
                    onDelete={deleteTask}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
