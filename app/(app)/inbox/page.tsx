"use client";
import { useEffect, useState } from "react";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskForm } from "@/components/tasks/TaskForm";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Inbox, Filter } from "lucide-react";
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
    if (res.ok) {
      await fetchTasks();
      toast.success("Task added");
    } else {
      toast.error("Failed to add task");
    }
  }

  async function updateTask(id: string, updates: Partial<Task>) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      await fetchTasks();
    } else {
      toast.error("Failed to update task");
    }
  }

  async function deleteTask(id: string) {
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (res.ok) {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      toast.success("Task deleted");
    } else {
      toast.error("Failed to delete task");
    }
  }

  const filtered = tasks
    .filter((t) => priorityFilter === "all" || t.priority === priorityFilter)
    .sort((a, b) => {
      const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return order[a.priority] - order[b.priority];
    });

  const counts = { HIGH: tasks.filter((t) => t.priority === "HIGH").length, MEDIUM: tasks.filter((t) => t.priority === "MEDIUM").length, LOW: tasks.filter((t) => t.priority === "LOW").length };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Inbox className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Inbox</h1>
          {tasks.length > 0 && (
            <Badge variant="secondary" className="text-xs">{tasks.length}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filter} onValueChange={(v) => setFilter(v ?? "all")}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="MANUAL">Manual</SelectItem>
              <SelectItem value="N8N">From N8N</SelectItem>
              <SelectItem value="RECURRING">Recurring</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v ?? "all")}>
            <SelectTrigger className="h-8 w-32 text-xs">
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

      <TaskForm onSubmit={addTask} compact />

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Inbox className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Your inbox is empty</p>
          <p className="text-xs mt-1">Add tasks above or connect N8N to receive tasks automatically</p>
        </div>
      ) : (
        <div className="space-y-2" data-testid="task-list">
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
