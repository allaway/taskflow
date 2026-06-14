"use client";
import { useEffect, useState } from "react";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskForm } from "@/components/tasks/TaskForm";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Inbox } from "lucide-react";
import { toast } from "sonner";
import type { Task } from "@prisma/client";

export default function InboxPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

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

      {/* Add task */}
      <TaskForm onSubmit={addTask} compact />

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
            <TaskCard
              key={task.id}
              task={task}
              onUpdate={updateTask}
              onDelete={deleteTask}
            />
          ))}
        </div>
      )}
    </div>
  );
}
